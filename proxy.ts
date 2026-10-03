import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE_NAME, isSecretUsable, parseSessionToken } from "@/lib/auth/session";
import {
  isLocale,
  resolveLocale,
  shouldBypassLocaleRouting,
} from "@/lib/i18n/config";
import {
  MAINTENANCE_RETRY_AFTER_SECONDS,
  MAINTENANCE_STATUS,
  isMaintenanceEnabled,
  maintenanceLocaleOf,
  maintenancePathFor,
  shouldBypassMaintenance,
} from "@/lib/maintenance/plan";

/**
 * Proxy (ชื่อใหม่ของ middleware ใน Next.js 16) — ทำงาน 2 อย่างตามลำดับ
 *
 * 1. **เติม prefix ภาษานำหน้า path ที่ยังไม่มี**
 *      /            → /th
 *      /products    → /th/products   (หรือ /en ถ้าเบราว์เซอร์ขออังกฤษ)
 *      /en/products → ผ่านไปเลย
 * 2. **โหมดปิดปรับปรุง (X2.5)** — เมื่อเปิด `MAINTENANCE_MODE`
 *      หน้าที่ประชาชนเห็น → เสิร์ฟหน้า `/<lang>/maintenance` **ที่ URL เดิม** + สถานะ 503 + `Retry-After`
 *      ที่ผ่านเสมอ: `/admin` · `/<lang>/maintenance` · `/<lang>/preview` · `/media/*` · robots/sitemap
 *      และ **ผู้ดูแลที่คุกกี้เซสชันยังใช้ได้ → ผ่านทุกหน้า** (เจ้าของต้องตรวจเว็บระหว่างปิดได้)
 *
 * ⚠️ ห้ามให้ proxy อ่านฐานข้อมูลต่อ request — เอกสาร Next รุ่นที่ติดตั้งจริงเขียนว่า
 *    *"Proxy is not intended for slow data fetching … should not be used as a full session management
 *    or authorization solution"* (`node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`)
 *    ⇒ ที่นี่อ่านแค่ env + ตรวจลายเซ็นคุกกี้ (คำนวณในเครื่อง ไม่มี I/O) · มีเทสต์สแกนซอร์สกันการเผลอ import DB
 */

/** ผู้ดูแลที่ถือคุกกี้เซสชันลายเซ็นถูกต้องและยังไม่หมดอายุ (ตรวจในเครื่องทั้งหมด — ไม่แตะ DB) */
function hasValidAdminSession(request: NextRequest): boolean {
  const secret = process.env["SESSION_SECRET"];
  if (secret === undefined || !isSecretUsable(secret)) return false;

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token === undefined || token === "") return false;

  return parseSessionToken(token, secret, Date.now()) !== null;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (shouldBypassLocaleRouting(pathname)) {
    return NextResponse.next();
  }

  const [first] = pathname.split("/").filter(Boolean);
  if (isLocale(first)) {
    /* ── โหมดปิดปรับปรุง: ตรวจ *หลัง* รู้ภาษาแล้ว เพื่อให้หน้าแจ้งเตือนเป็นภาษาที่ผู้เข้าชมขอ ── */
    if (isMaintenanceEnabled(process.env)) {
      const bypass = shouldBypassMaintenance({ pathname, hasAdminSession: hasValidAdminSession(request) });
      if (!bypass) {
        const url = request.nextUrl.clone();
        url.pathname = maintenancePathFor(maintenanceLocaleOf(pathname));
        url.search = "";

        return NextResponse.rewrite(url, {
          status: MAINTENANCE_STATUS,
          headers: {
            /* บอกเสิร์ชเอนจิน/เครื่องมือเฝ้าระวังว่า "หายชั่วคราว" ไม่ใช่หน้าที่ถูกลบ */
            "retry-after": String(MAINTENANCE_RETRY_AFTER_SECONDS),
            "x-robots-tag": "noindex, nofollow",
            /* ห้ามแคชคำตอบ 503 ไว้ที่ CDN — ต้องกลับมาเร็วที่สุดเมื่อปิดโหมด */
            "cache-control": "no-store",
          },
        });
      }
    }

    return NextResponse.next();
  }

  const locale = resolveLocale(request.headers.get("accept-language"));

  const url = request.nextUrl.clone();
  url.pathname = pathname === "/" ? `/${locale}` : `/${locale}${pathname}`;

  return NextResponse.redirect(url);
}

export const config = {
  /*
    ทำงานกับทุก path ยกเว้นไฟล์ static ของ Next, API และไฟล์ที่มีนามสกุล
    (ไฟล์ใน public/ ต้องไม่ถูกเติม prefix ภาษา ไม่งั้นจะโหลดไม่เจอ)
  */
  matcher: ["/((?!_next|api|.*\\.[a-zA-Z0-9]+$).*)"],
};
