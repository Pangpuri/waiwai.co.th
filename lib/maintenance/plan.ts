/**
 * โหมดปิดปรับปรุง (X2.5) — **ตรรกะบริสุทธิ์** (ทดสอบได้ ไม่แตะ DB/ไม่มี I/O)
 *
 * มติการออกแบบ (2026-10-03) — ทำไม "สวิตช์" อยู่ที่ env ไม่ใช่หลังบ้าน
 * - งานนี้คือ "ปิดเว็บชั่วคราวตอนย้ายเซิร์ฟเวอร์/ซ่อมฐานข้อมูล" = การกระทำของ **ผู้ดูแลระบบ**
 *   ไม่ใช่การตลาด (ต่างจากป้ายประกาศ/เนื้อหา ที่ต้องแก้จากหลังบ้านได้)
 * - ทางเลือกคือให้ proxy อ่านฐานข้อมูลทุก request แต่ **เอกสาร Next ของรุ่นที่ติดตั้งจริงเขียนไว้ชัดว่า**
 *   *"Proxy is not intended for slow data fetching … should not be used as a full session management
 *   or authorization solution"* (`node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`)
 *   ⇒ เลือกทางที่เร็วและแน่นอน: อ่าน env (ค่าคงที่ต่อการรัน 1 ครั้ง) แล้ว **บายพาสให้แอดมิน** ผ่านลายเซ็นคุกกี้
 * - ผลที่ตามมาและยอมรับได้: เปิด/ปิดโหมดต้องรีสตาร์ต/รีดีพลอย (มีสคริปต์ `npm run maintenance:on|off` ช่วยเขียน `.env.local`)
 *
 * ข้อความบนหน้าเว็บอยู่ในพจนานุกรม (ไทย/อังกฤษ) — หน้าเว็บ static/ISR จึงเร็วเท่าเดิมตอนเปิดโหมด
 */

import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/config";

/** ชื่อตัวแปรที่เปิดโหมด — ตั้งเป็น `1` ที่โฮสต์หรือใน `.env.local` */
export const MAINTENANCE_ENV_VAR = "MAINTENANCE_MODE";

/** ชื่อ segment ของหน้าแจ้งปิดปรับปรุง (อยู่ใต้ภาษา: `/th/maintenance`) */
export const MAINTENANCE_SEGMENT = "maintenance";

/**
 * บอกเครื่องมือภายนอกว่ากลับมาเมื่อไร (ชั่วโมง) — ใช้กับ header `Retry-After`
 * ⚠️ เป็น **ค่าประมาณ** ไม่ใช่สัญญา: หน้าเว็บต้องไม่สัญญาเวลาที่เราไม่รู้
 */
export const MAINTENANCE_RETRY_AFTER_SECONDS = 3600;

/** รหัสที่ถูกต้องตามหลัก HTTP สำหรับ "ปิดชั่วคราว" (ไม่ใช่ 404/500) */
export const MAINTENANCE_STATUS = 503;

/** ค่าที่ถือว่า "เปิด" — ตั้งใจให้เข้ม (พิมพ์ผิด/ค่าว่าง = ปิด ⇒ เว็บไม่ล่มเพราะพิมพ์ผิด) */
const ON_TOKENS = ["1", "true", "on", "yes"] as const;
const OFF_TOKENS = ["", "0", "false", "off", "no"] as const;

export type MaintenanceFlag = "on" | "off" | "unclear";

/** อ่านค่าดิบ → สถานะ (**ไม่เดา**: ค่าที่ไม่รู้จักคืน "unclear" ให้หน้าหลังบ้านเตือน) */
export function maintenanceFlagOf(value: string | undefined): MaintenanceFlag {
  if (value === undefined) return "off";
  const normalized = value.trim().toLowerCase();

  if ((ON_TOKENS as readonly string[]).includes(normalized)) return "on";
  if ((OFF_TOKENS as readonly string[]).includes(normalized)) return "off";
  return "unclear";
}

/** เปิดโหมดอยู่ไหม — `unclear` ถือว่า **ปิด** (ปลอดภัยกว่าสำหรับเว็บที่ต้องขายของ) */
export function isMaintenanceEnabled(env: Record<string, string | undefined>): boolean {
  return maintenanceFlagOf(env[MAINTENANCE_ENV_VAR]) === "on";
}

/** path ของหน้าแจ้งปิดปรับปรุงสำหรับภาษานั้น */
export function maintenancePathFor(locale: Locale): string {
  return `/${locale}/${MAINTENANCE_SEGMENT}`;
}

/**
 * path ที่ต้องผ่านได้เสมอแม้เปิดโหมดปิดปรับปรุง (หลังตัด prefix ภาษาออกแล้ว)
 * - `/admin`  — ผู้ดูแลต้องเข้าไปทำงานได้ (เปิดโหมดแล้วเข้าหลังบ้านไม่ได้ = ล็อกตัวเองออก)
 * - `/maintenance` — หน้าปลายทางเอง (ถ้าบล็อกจะวนซ้ำ)
 * - `/preview` — หน้าพรีวิวฉบับร่าง (ต้องล็อกอินอยู่แล้ว จึงไม่ใช่ทางหลุด)
 */
export const MAINTENANCE_ALWAYS_ALLOWED_SEGMENTS = ["admin", MAINTENANCE_SEGMENT, "preview"] as const;

/**
 * path ระดับบนสุดที่ไม่ต้องผ่านการตรวจ (ไม่มีภาษาใน path)
 * ⚠️ `/api` — วันนี้โปรเจกต์นี้ **ไม่มี API route เลย** ที่ใส่ไว้เพื่อไม่ให้อนาคตพังเงียบ ๆ ถ้ามีการเพิ่ม API
 *    · และมีเทสต์กันไม่ให้รายการนี้หลุดจาก `PROXY_BYPASS_PREFIXES` (สองรายการต้องสอดคล้องกันเสมอ
 *    ไม่งั้นหน้าที่ควรปิดจะหลุดผ่าน proxy ไปได้)
 */
const MAINTENANCE_ALLOWED_TOP_LEVEL_PREFIXES = ["/admin", "/api", "/_next", "/media", "/icons", "/images"] as const;
const MAINTENANCE_ALLOWED_FILES = ["/robots.txt", "/sitemap.xml", "/favicon.ico"] as const;

/** แยก `/{locale}` ออกจาก pathname (`/th/products` → `{ locale: "th", rest: "/products" }`) */
export function splitLocalePrefix(pathname: string): { readonly locale: Locale | null; readonly rest: string } {
  const [first = "", ...tail] = pathname.split("/").filter(Boolean);
  if (!isLocale(first)) return { locale: null, rest: pathname };
  return { locale: first, rest: tail.length === 0 ? "/" : `/${tail.join("/")}` };
}

/** ภาษาที่ควรใช้กับหน้าแจ้งปิดปรับปรุงของ request นี้ (ไม่รู้ภาษา = ภาษาเริ่มต้น) */
export function maintenanceLocaleOf(pathname: string): Locale {
  return splitLocalePrefix(pathname).locale ?? DEFAULT_LOCALE;
}

/**
 * นามสกุลไฟล์ที่ยอมให้ผ่านได้ระหว่างปิดปรับปรุง
 *
 * ⚠️ ทำไมต้องเป็น "รายการที่รู้จัก" ไม่ใช่ "มีจุดก็ผ่าน"
 *    เคสจริงที่เทสต์จับได้ (2026-10-03): `/th/products.v2` มีจุด ⇒ ถ้าใช้กฎหลวมจะทะลุโหมดไปทั้งหน้า
 *    ⇒ ใช้ **รายการอนุญาต** (allow-list): นามสกุลที่ไม่รู้จัก = ถือว่าเป็นหน้าเว็บ ⇒ ปิด
 */
export const MAINTENANCE_ASSET_EXTENSIONS = [
  "png",
  "jpg",
  "jpeg",
  "webp",
  "avif",
  "gif",
  "svg",
  "ico",
  "css",
  "js",
  "mjs",
  "map",
  "txt",
  "xml",
  "json",
  "webmanifest",
  "woff",
  "woff2",
  "ttf",
  "otf",
  "mp4",
  "webm",
  "pdf",
] as const;

function hasAssetExtension(pathname: string): boolean {
  const match = /\.([a-z0-9]+)$/i.exec(pathname);
  if (match === null) return false;
  return (MAINTENANCE_ASSET_EXTENSIONS as readonly string[]).includes((match[1] ?? "").toLowerCase());
}

/**
 * ต้องบายพาส (ปล่อยให้เข้าเว็บจริง) ไหม
 *
 * ลำดับความสำคัญ: **คุกกี้เซสชันที่ถูกต้องของแอดมิน** มาก่อนเสมอ
 * (ระหว่างปิดปรับปรุง เจ้าของต้องเปิดดูเว็บได้ — ไม่งั้นเท่ากับปิดตาตัวเองตอนตรวจงาน)
 */
export function shouldBypassMaintenance(options: {
  readonly pathname: string;
  readonly hasAdminSession: boolean;
}): boolean {
  if (options.hasAdminSession) return true;

  const { pathname } = options;
  if (pathname === "") return false;
  if (hasAssetExtension(pathname)) return true;

  if (MAINTENANCE_ALLOWED_FILES.some((file) => pathname === file)) return true;
  if (
    MAINTENANCE_ALLOWED_TOP_LEVEL_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  ) {
    return true;
  }

  const { rest } = splitLocalePrefix(pathname);
  const [first = ""] = rest.split("/").filter(Boolean);
  return (MAINTENANCE_ALWAYS_ALLOWED_SEGMENTS as readonly string[]).includes(first);
}
