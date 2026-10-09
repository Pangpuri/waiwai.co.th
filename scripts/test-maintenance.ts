import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { codeOf } from "./source-scan.ts";

import { PROXY_BYPASS_PREFIXES } from "@/lib/i18n/config";
import {
  MAINTENANCE_BYPASS_REFRESH_MS,
  MAINTENANCE_BYPASS_TTL_MS,
  createMaintenanceBypassToken,
  nextMaintenanceBypassExpiry,
  parseMaintenanceBypassToken,
  shouldRefreshMaintenanceBypass,
} from "@/lib/maintenance/bypass";
import {
  MAINTENANCE_ENV_VAR,
  MAINTENANCE_RETRY_AFTER_SECONDS,
  MAINTENANCE_SEGMENT,
  MAINTENANCE_STATUS,
  isMaintenanceEnabled,
  maintenanceFlagOf,
  maintenanceLocaleOf,
  maintenancePathFor,
  shouldBypassMaintenance,
  splitLocalePrefix,
} from "@/lib/maintenance/plan";
import { CODE_ONLY_PAGE_PATHS } from "@/lib/pages/paths";
import { buildMaintenanceRobots, buildRobots } from "@/lib/site-settings/sitemap";

/**
 * เทสต์ X2.5 — โหมดปิดปรับปรุง (ตรรกะบริสุทธิ์ + กฎสถาปัตยกรรม)
 *
 * 3 เรื่องที่พลาดแล้วเจ็บ
 * 1. **ล็อกตัวเองออก** — เปิดโหมดแล้วเข้าหลังบ้าน/ตรวจเว็บตัวเองไม่ได้
 * 2. **ปิดไม่จริง** — บาง path หลุดผ่านไปได้ (เช่นลืมกันไว้ในรายการบายพาสของ proxy)
 * 3. **เปิดแล้วไม่รู้ตัว / ตั้งค่าผิดแล้วเงียบ** — ต้องเห็นสถานะบนหลังบ้าน ไม่ใช่เดา
 */

function sourceOf(relativePath: string): string {
  /* รอบที่ 243: ค่าเริ่มต้น = โค้ดจริง (ตัดคอมเมนต์) — กันด่าน "มีโค้ด X" ผ่านเพราะคอมเมนต์ */

  return codeOf(relativePath);
}

/* ── 1) อ่านค่าสวิตช์ ───────────────────────────────────────────────────────── */

test("maintenance: ค่าที่ถือว่าเปิด/ปิด ต้องชัดเจน และค่าที่ไม่รู้จักต้องไม่เดา", () => {
  for (const on of ["1", "true", "on", "yes", "TRUE", "  On  "]) {
    assert.equal(maintenanceFlagOf(on), "on", `${on} ต้องเป็นเปิด`);
  }
  for (const off of [undefined, "", "0", "false", "off", "no", " FALSE "]) {
    assert.equal(maintenanceFlagOf(off), "off", `${String(off)} ต้องเป็นปิด`);
  }
  /* พิมพ์ผิด/ค่าประหลาด = "unclear" (ไม่เดา) แต่การทำงานจริงถือว่าปิด ⇒ เว็บไม่ล่มเพราะพิมพ์ผิด */
  for (const weird of ["maybe", "2", "yes please"]) {
    assert.equal(maintenanceFlagOf(weird), "unclear", `${weird} ต้องเป็น unclear`);
  }
  assert.equal(isMaintenanceEnabled({ [MAINTENANCE_ENV_VAR]: "maybe" }), false, "unclear = ปิด (ปลอดภัยกว่า)");
});

test("maintenance: อ่านจาก env เท่านั้น และไม่มีค่าตั้งต้นที่เปิดโหมดเอง", () => {
  assert.equal(isMaintenanceEnabled({}), false, "ไม่ตั้งอะไร = เว็บเปิด");
  assert.equal(isMaintenanceEnabled({ OTHER: "1" }), false, "คีย์อื่นไม่เกี่ยว");
  assert.equal(isMaintenanceEnabled({ [MAINTENANCE_ENV_VAR]: "1" }), true);
});

/* ── 2) path ────────────────────────────────────────────────────────────────── */

test("maintenance: หน้าแจ้งเตือนอยู่ใต้ภาษาเสมอ", () => {
  /* ทุกหน้าสาธารณะอยู่ใต้ /{lang} (แม้ภาษาเริ่มต้น) ⇒ หน้าแจ้งเตือนก็ต้องอยู่ใต้ภาษาเช่นกัน */
  assert.equal(maintenancePathFor("th"), `/th/${MAINTENANCE_SEGMENT}`);
  assert.equal(maintenancePathFor("en"), `/en/${MAINTENANCE_SEGMENT}`);
});

test("maintenance: แยก prefix ภาษาได้ถูกต้อง", () => {
  assert.deepEqual(splitLocalePrefix("/th/products"), { locale: "th", rest: "/products" });
  assert.deepEqual(splitLocalePrefix("/en"), { locale: "en", rest: "/" });
  assert.deepEqual(splitLocalePrefix("/products"), { locale: null, rest: "/products" });
  assert.deepEqual(splitLocalePrefix("/admin/login"), { locale: null, rest: "/admin/login" });
  /* `/thai` = ภาษาที่ไม่รู้จัก (ไม่ใช่ "th") — ห้ามตัด prefix มั่ว */
  assert.deepEqual(splitLocalePrefix("/thai"), { locale: null, rest: "/thai" });
});

test("maintenance: ภาษาของหน้าแจ้งเตือนตาม path (ไม่รู้ = ไทย)", () => {
  assert.equal(maintenanceLocaleOf("/en/recipes"), "en");
  assert.equal(maintenanceLocaleOf("/th/contact"), "th");
  assert.equal(maintenanceLocaleOf("/products"), "th");
});

/* ── 3) อะไรผ่านได้ / อะไรถูกปิด ───────────────────────────────────────────── */

test("maintenance: ผู้ดูแลที่ล็อกอินแล้วผ่านได้ทุกหน้า (เจ้าของต้องตรวจเว็บตัวเองได้)", () => {
  for (const pathname of ["/th", "/th/products", "/en/about", "/th/contact"]) {
    assert.equal(
      shouldBypassMaintenance({ pathname, hasAdminSession: true }),
      true,
      `${pathname} ต้องผ่านได้เมื่อมีเซสชันแอดมิน`,
    );
  }
});

test("maintenance: หน้าที่ปิดจริงต้องถูกปิด (รวมหน้าแรกทั้งสองภาษา)", () => {
  for (const pathname of ["/th", "/en", "/th/products", "/en/recipes", "/th/about", "/th/contact", "/th/news"]) {
    assert.equal(
      shouldBypassMaintenance({ pathname, hasAdminSession: false }),
      false,
      `${pathname} ต้องถูกปิดเมื่อไม่มีเซสชันแอดมิน`,
    );
  }
});

test("maintenance: หลังบ้าน/หน้าพรีวิว/หน้าแจ้งเตือน/ไฟล์ภาพ ต้องผ่านเสมอ", () => {
  const allowed = [
    "/admin",
    "/admin/login",
    "/admin/builder/home",
    "/th/maintenance",
    "/en/maintenance",
    "/maintenance",
    "/th/preview/home",
    "/en/preview/contact",
    "/media/abc123",
    "/robots.txt",
    "/sitemap.xml",
    "/favicon.ico",
    "/icons/logo.svg",
    "/_next/static/chunk.js",
  ];

  for (const pathname of allowed) {
    assert.equal(
      shouldBypassMaintenance({ pathname, hasAdminSession: false }),
      true,
      `${pathname} ต้องผ่านได้แม้ไม่ล็อกอิน`,
    );
  }
});

test("maintenance: รายการบายพาสของ proxy ต้องสอดคล้องกัน (กันหน้าที่ควรปิดหลุด)", () => {
  /*
    proxy คืน `NextResponse.next()` ตั้งแต่ต้นสำหรับ path ใน PROXY_BYPASS_PREFIXES
    ⇒ ทุกรายการนั้น **ต้อง** ผ่าน `shouldBypassMaintenance()` ด้วย ไม่งั้นโหมดปิดปรับปรุงจะไม่ทำงานกับ path นั้น
  */
  for (const prefix of PROXY_BYPASS_PREFIXES) {
    /* ไฟล์ที่มีนามสกุล = path ตรงตัว (ไม่ต่อท้าย) · prefix อื่น = ต่อท้ายด้วย segment จริง */
    const sample = /\.[a-z0-9]+$/i.test(prefix) ? prefix : `${prefix}/sample`;
    assert.equal(
      shouldBypassMaintenance({ pathname: sample, hasAdminSession: false }),
      true,
      `${sample} อยู่ใน PROXY_BYPASS_PREFIXES ⇒ ต้องผ่านการตรวจโหมดปิดปรับปรุงด้วย`,
    );
  }
});

test("maintenance: path ที่มีนามสกุลไม่รู้จัก = ถือเป็นหน้าเว็บ (ห้ามทะลุโหมด)", () => {
  /* เคสจริง: กฎ "มีจุดก็ผ่าน" ทำให้ `/th/products.v2` ทะลุโหมดไปได้ */
  for (const pathname of ["/th/products.v2", "/en/about.php", "/th/contact.html"]) {
    assert.equal(
      shouldBypassMaintenance({ pathname, hasAdminSession: false }),
      false,
      `${pathname} ต้องถูกปิด (นามสกุลไม่อยู่ในรายการไฟล์ที่อนุญาต)`,
    );
  }
  /* แต่ไฟล์ที่รู้จักต้องผ่าน (ภาพ/ฟอนต์/สไตล์ชีต) */
  for (const pathname of ["/media/abc.png", "/icons/sprite.svg", "/fonts/x.woff2", "/th/photo.webp"]) {
    assert.equal(shouldBypassMaintenance({ pathname, hasAdminSession: false }), true, `${pathname} ต้องผ่านได้`);
  }
});

/* ── 4) robots ─────────────────────────────────────────────────────────────── */

test("maintenance: robots.txt ตอนปิดปรับปรุงห้ามเก็บทั้งเว็บ และไม่ชี้ sitemap", () => {
  const maintenance = buildMaintenanceRobots();
  const normal = buildRobots({ siteUrl: "https://waiwai.co.th", locales: ["th", "en"] });

  assert.equal(maintenance.rules[0]?.disallow.join(","), "/", "ปิดทั้งเว็บ");
  assert.equal(maintenance.sitemap, null, "ไม่ชี้ sitemap (ยังไม่มีหน้าที่การันตีว่าใช้ได้)");
  assert.equal(normal.sitemap, "https://waiwai.co.th/sitemap.xml", "โหมดปกติยังชี้ sitemap เหมือนเดิม");
  assert.ok(normal.rules[0]?.disallow.includes("/admin"), "โหมดปกติยังกันหลังบ้านอยู่");
});

/* ── 5) กฎสถาปัตยกรรม (กันของหลุดแบบเงียบ ๆ) ───────────────────────────────── */

test("maintenance: proxy ห้ามอ่านฐานข้อมูล (ตามคำเตือนของเอกสาร Next)", () => {
  const proxy = sourceOf("proxy.ts");

  for (const forbidden of ['@/db/pool', 'from "pg"', "@/lib/content/", "@/lib/retention/purge"]) {
    assert.ok(!proxy.includes(forbidden), `proxy.ts ห้าม import ${forbidden} (proxy ไม่ควรมี I/O ช้า)`);
  }
  assert.ok(proxy.includes("isMaintenanceEnabled"), "proxy ต้องเรียกใช้ตรรกะโหมดปิดปรับปรุงจริง");
  assert.ok(proxy.includes("shouldBypassMaintenance"), "proxy ต้องใช้กฎบายพาสจาก lib (ไม่เขียนซ้ำ)");
  assert.ok(proxy.includes("MAINTENANCE_STATUS"), "proxy ต้องส่งสถานะ 503 ไม่ใช่ 200");
  assert.equal(MAINTENANCE_STATUS, 503);
  assert.ok(MAINTENANCE_RETRY_AFTER_SECONDS > 0, "ต้องมี Retry-After ให้เครื่องมือภายนอก");
});

test("maintenance: ชื่อตัวแปร env ถูกนิยามที่เดียว (ห้ามพิมพ์ซ้ำกระจาย)", () => {
  const files = ["proxy.ts", "app/robots.ts", "app/admin/page.tsx", "scripts/maintenance.ts", "app/[lang]/maintenance/page.tsx"];

  for (const file of files) {
    const source = sourceOf(file);
    /* ต้องอ้างผ่านค่าคงที่ ไม่ใช่สตริงดิบ (ไม่งั้นเปลี่ยนชื่อแล้วหลุดเงียบ ๆ) */
    assert.ok(
      !source.includes(`"${MAINTENANCE_ENV_VAR}"`) && !source.includes(`'${MAINTENANCE_ENV_VAR}'`),
      `${file}: ห้ามใช้สตริง "${MAINTENANCE_ENV_VAR}" ตรง ๆ — ให้ใช้ MAINTENANCE_ENV_VAR`,
    );
  }
  assert.ok(sourceOf("lib/maintenance/plan.ts").includes(`"${MAINTENANCE_ENV_VAR}"`), "นิยามต้องอยู่ใน plan.ts");
});

test("maintenance: หน้าแจ้งเตือนต้องเป็น static/ISR + noindex + ไม่สัญญาเวลา", () => {
  const page = sourceOf("app/[lang]/maintenance/page.tsx");

  assert.ok(page.includes("export const revalidate = 300"), "ต้องเป็น static/ISR (ห้าม dynamic ต่อ request)");
  assert.ok(page.includes("index: false"), "ต้อง noindex (เป็นข้อความชั่วคราว)");
  assert.ok(page.includes("loadSiteSettings"), "ช่องทางติดต่อต้องมาจากตั้งค่าจริง ไม่ใช่ hardcode");

  /* ห้ามมีเบอร์/อีเมลปลอมในโค้ด (กติกา placeholder ของโปรเจกต์) */
  assert.ok(!/@(waiwai|example)\.(co\.th|com)/i.test(page.replace(/@\/lib[^"]*/g, "")), "ห้าม hardcode อีเมล");
});

test("maintenance: หน้าแจ้งเตือนต้องไม่หลุดเข้า sitemap (เป็นหน้าชั่วคราว)", () => {
  assert.ok(!CODE_ONLY_PAGE_PATHS.some((entry) => entry.path.includes(MAINTENANCE_SEGMENT)), "ห้ามใส่ในรายการหน้าในโค้ด");
  assert.ok(!sourceOf("lib/pages/paths.ts").includes(`/${MAINTENANCE_SEGMENT}`), "paths.ts ห้ามมีหน้าแจ้งเตือน");
});

test("maintenance: การ์ดบนหลังบ้านต้องอ่านสถานะจริง ไม่ใช่ค่าคงที่", () => {
  const admin = sourceOf("app/admin/page.tsx");
  assert.ok(admin.includes("maintenanceFlagOf"), "ต้องคำนวณสถานะจาก env จริง");
  assert.ok(admin.includes("maintenanceStateUnclear"), "ต้องเตือนเมื่อค่าที่ตั้งไม่ชัดเจน");
});

test("maintenance: พจนานุกรมต้องมีข้อความครบทั้งสองภาษา", () => {
  for (const locale of ["th", "en"]) {
    const dict = sourceOf(`lib/i18n/messages/areas/${locale}/maintenance.ts`);
    for (const key of ["title", "body", "retryNote", "contactTitle", "contactPhoneLabel", "contactEmailLabel"]) {
      assert.ok(dict.includes(`${key}:`), `${locale}: ต้องมีคีย์ ${key}`);
    }
    assert.ok(!/ภายใน\s*\d+\s*(นาที|ชั่วโมง)/.test(dict), `${locale}: ห้ามสัญญาเวลาที่เราไม่รู้`);
  }
});

/* ── บัตรผ่านดูเว็บมีอายุจำกัด (X2.5 ต่อ · รอบที่ 96) ───────────────────────── */

test("maintenance: บัตรผ่านมีอายุสั้น และใช้ไม่ได้เมื่อหมดอายุ/ลายเซ็นผิด", () => {
  const secret = "m".repeat(40);
  const now = Date.now();

  const token = createMaintenanceBypassToken(nextMaintenanceBypassExpiry(now), secret);
  assert.equal(parseMaintenanceBypassToken(token, secret, now)?.expiresAt, now + MAINTENANCE_BYPASS_TTL_MS);
  assert.ok(
    MAINTENANCE_BYPASS_TTL_MS <= 30 * 60 * 1000,
    "บัตรผ่านต้องสั้น (≤30 นาที) — ไม่งั้นเพิกถอนเซสชันแล้วยังบายพาสได้นาน",
  );
  assert.ok(
    MAINTENANCE_BYPASS_REFRESH_MS < MAINTENANCE_BYPASS_TTL_MS,
    "ต้องต่ออายุก่อนหมดอายุเสมอ",
  );

  /* หมดอายุ = ใช้ไม่ได้ */
  assert.equal(parseMaintenanceBypassToken(token, secret, now + MAINTENANCE_BYPASS_TTL_MS + 1), null);
  /* ลายเซ็นผิด/แก้ payload = ใช้ไม่ได้ */
  assert.equal(parseMaintenanceBypassToken(token, "x".repeat(40), now), null);
  assert.equal(parseMaintenanceBypassToken(`${token}x`, secret, now), null);
  assert.equal(parseMaintenanceBypassToken("ไม่มีจุดคั่น", secret, now), null);
  assert.equal(parseMaintenanceBypassToken("eyJhIjoxfQ.c2ln", secret, now), null, "payload เพี้ยน = ปฏิเสธ");

  /* ต่ออายุเมื่อไม่มี/ใกล้หมดอายุเท่านั้น */
  assert.equal(shouldRefreshMaintenanceBypass(null, now), true);
  assert.equal(shouldRefreshMaintenanceBypass(now + MAINTENANCE_BYPASS_TTL_MS, now), false);
  assert.equal(shouldRefreshMaintenanceBypass(now + 1000, now), true);
});

test("maintenance: proxy ใช้บัตรผ่าน (ไม่ใช่คุกกี้เซสชัน) และยังไม่ Import DB", () => {
  const root = path.join(import.meta.dirname, "..");
  const proxy = readFileSync(path.join(root, "proxy.ts"), "utf8");
  const dal = readFileSync(path.join(root, "lib", "auth", "dal.ts"), "utf8");
  const route = readFileSync(path.join(root, "app", "admin", "bypass", "route.ts"), "utf8");

  /* proxy ต้องไม่แตะ DB/คุกกี้เซสชันตรง ๆ อีก */
  assert.ok(!proxy.includes("parseSessionToken"), "proxy ต้องไม่ตรวจคุกกี้เซสชันเองแล้ว (เพิกถอนไม่เห็น)");
  assert.ok(proxy.includes("parseMaintenanceBypassToken"), "proxy ต้องตรวจบัตรผ่าน");
  assert.ok(!/from "@\/db\/pool"/.test(proxy), "proxy ห้าม Import DB");
  assert.ok(!/from "@\/lib\/content\/repository"/.test(proxy), "proxy ห้าม Import repository ที่อ่าน DB");

  /* บัตรผ่านออกโดยจุดที่ตรวจ DB เท่านั้น */
  assert.ok(route.includes("getSessionUser()"), "route ต้องตรวจเซสชันกับ DB");
  assert.ok(route.includes('can(user.role, "content")'), "route ต้องตรวจสิทธิ์เอง (กติกา route handler)");
  assert.ok(route.includes("refreshMaintenanceBypass"), "route ต้องต่ออายุบัตรผ่าน");
  assert.ok(dal.includes("export async function refreshMaintenanceBypass"), "ต้องมีตัวต่ออายุใน DAL");
  assert.ok(dal.includes("delete(MAINTENANCE_BYPASS_COOKIE)"), "ออกจากระบบต้องลบบัตรผ่าน");

  /* หน้าหลังบ้านต้องต่ออายุเป็นระยะ (ไม่งั้นบัตรผ่านตายระหว่างใช้งาน) */
  const layout = readFileSync(path.join(root, "app", "admin", "layout.tsx"), "utf8");
  assert.ok(layout.includes("MaintenanceBypassPing"), "ต้องมีการต่ออายุเป็นระยะบนหน้าหลังบ้าน");
  assert.ok(layout.includes("isMaintenanceEnabled(process.env)"), "ต่ออายุเฉพาะเมื่อเปิดโหมดปิดปรับปรุง");
});
