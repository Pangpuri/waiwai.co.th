import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { FOOTER_COLUMNS, HEADER_CTA, PRIMARY_NAV } from "@/features/shell/nav";
import { EMPTY_PAGE_SEO, type PageRecord } from "@/lib/pages/model";
import { PENDING_PAGE_IDS, PENDING_PAGE_PATHS, isPendingPageId, pendingPagePath } from "@/lib/pages/pending";
import { LOCALES } from "@/lib/i18n/config";
import { buildSitemapEntries } from "@/lib/site-settings/sitemap";

/**
 * เทสต์ปิดหนี้ "ลิงก์เสีย" (รอบที่ 81)
 *
 * ปัญหาจริงที่เจอ: ท้ายเว็บ (ค่าเริ่มต้นในโค้ด) ลิงก์ไป `/sustainability` · `/where-to-buy`
 * · `/cookie-policy` · `/terms` แต่ **ไม่มีหน้าปลายทาง** ⇒ ผู้ใช้กดแล้วเจอ 404
 *
 * เทสต์ชุดนี้กันไม่ให้เกิดขึ้นอีก **ทุกเส้นทาง** (ไม่ใช่แค่ 4 หน้าที่ปิดวันนี้)
 * โดยเทียบ path ในเมนู/ท้ายเว็บ/CTA กับไฟล์ route จริงใน `app/[lang]/`
 */

const ROOT = path.resolve(import.meta.dirname, "..");
const APP_LANG_DIR = path.join(ROOT, "app", "[lang]");

/**
 * path นี้มีหน้า (route) จริงไหม — รองรับ segment แบบไดนามิก (`[slug]`)
 * คืน `true` เมื่อเจอ `page.tsx` ที่ปลายทาง
 */
function routeExistsForPath(routePath: string): boolean {
  const segments = routePath.split("/").filter((segment) => segment !== "");
  let directory = APP_LANG_DIR;

  for (const segment of segments) {
    const exact = path.join(directory, segment);
    if (existsSync(exact)) {
      directory = exact;
      continue;
    }

    /* ไม่มีโฟลเดอร์ชื่อตรง → ยอมรับ segment แบบไดนามิกของ Next (`[slug]` · `[...rest]`) */
    const dynamic = readdirSync(directory, { withFileTypes: true }).find(
      (entry) => entry.isDirectory() && entry.name.startsWith("[") && entry.name.endsWith("]"),
    );
    if (dynamic === undefined) return false;
    directory = path.join(directory, dynamic.name);
  }

  return existsSync(path.join(directory, "page.tsx"));
}

test("links: ทุก path ในเมนูหลักมีหน้าปลายทางจริง", () => {
  for (const item of PRIMARY_NAV) {
    assert.ok(routeExistsForPath(item.path), `เมนู "${item.id}" ชี้ไป ${item.path} ที่ไม่มีหน้า`);
  }
});

test("links: ปุ่มหลักบนหัวเว็บ (CTA) ชี้ไปที่ที่มีจริง", () => {
  assert.ok(routeExistsForPath(HEADER_CTA.path), `CTA ชี้ไป ${HEADER_CTA.path} ที่ไม่มีหน้า`);
});

test("links: ทุก path ในท้ายเว็บ (ค่าเริ่มต้นในโค้ด) มีหน้าปลายทางจริง", () => {
  for (const column of FOOTER_COLUMNS) {
    for (const link of column.links) {
      assert.ok(
        routeExistsForPath(link.path),
        `ท้ายเว็บ คอลัมน์ "${column.id}" ลิงก์ "${link.labelKey}" ชี้ไป ${link.path} ที่ไม่มีหน้า (ลิงก์เสีย)`,
      );
    }
  }
});

/*
  รอบที่ 111 (เจ้าของสั่ง): เมนู/ท้ายเว็บ **ห้ามลิงก์ไปหน้าที่เป็น "กำลังจัดทำ"**
  เหตุผล: หน้าเหล่านั้นยังไม่มีเนื้อหาจริง ⇒ ผู้ใช้กดแล้วเจอทางตัน (เจ้าของเลือก "เอาลิงก์ออกไปก่อน")
  · หน้ายังเข้าถึงได้จากที่จำเป็น (เช่น นโยบายคุกกี้ เข้าจากแถบแจ้งคุกกี้) — เทสต์นี้คุมแค่ "เมนู/ท้ายเว็บ"
  · พอมีเนื้อหาจริง: เอาชื่อออกจาก PENDING_PAGE_IDS แล้วใส่ลิงก์กลับได้ตามปกติ
*/
test("links: เมนู/ท้ายเว็บ ต้องไม่ลิงก์ไปหน้า 'กำลังจัดทำ'", () => {
  const pendingPaths = new Set<string>(PENDING_PAGE_IDS.map((id) => pendingPagePath(id)));

  for (const item of [...PRIMARY_NAV, HEADER_CTA]) {
    assert.ok(!pendingPaths.has(item.path), `เมนู "${item.id}" ลิงก์ไป ${item.path} ซึ่งยังเป็นหน้า "กำลังจัดทำ"`);
  }

  for (const column of FOOTER_COLUMNS) {
    for (const link of column.links) {
      assert.ok(
        !pendingPaths.has(link.path),
        `ท้ายเว็บ คอลัมน์ "${column.id}" ลิงก์ "${link.labelKey}" ไป ${link.path} ซึ่งยังเป็นหน้า "กำลังจัดทำ"`,
      );
    }
  }
});

test("links: หน้าที่เคยเสียทั้ง 4 มี route จริง และอยู่ในรายการกลาง", () => {
  /* รอบที่ 112: `whereToBuy` ถูกถอดออก (ลบหน้า /where-to-buy ทิ้งตามคำสั่งเจ้าของ) */
  assert.deepEqual([...PENDING_PAGE_IDS], ["sustainability", "cookiePolicy", "terms"]);

  for (const id of PENDING_PAGE_IDS) {
    const routePath = pendingPagePath(id);
    assert.equal(routePath, PENDING_PAGE_PATHS[id], `${id}: path ต้องมาจากค่ากลาง`);
    assert.ok(routeExistsForPath(routePath), `${id}: ต้องมีไฟล์ route จริงที่ ${routePath}`);

    const directory = path.join(APP_LANG_DIR, routePath.slice(1));
    assert.ok(existsSync(path.join(directory, "page.tsx")), `${id}: ต้องมี page.tsx`);
  }

  assert.equal(isPendingPageId("sustainability"), true);
  assert.equal(isPendingPageId("home"), false);
});

test("links: หน้าที่ 'กำลังจัดทำ' ต้อง noindex และห้ามหลุดเข้า sitemap", () => {
  for (const id of PENDING_PAGE_IDS) {
    const routePath = pendingPagePath(id);
    const source = readFileSync(path.join(APP_LANG_DIR, routePath.slice(1), "page.tsx"), "utf8");
    assert.ok(source.includes("pendingPageMetadata"), `${id}: ต้องใช้ metadata กลางของหน้าที่กำลังจัดทำ`);
    assert.ok(source.includes(`id="${id}"`), `${id}: ต้องส่ง id ของตัวเองให้ component กลาง`);
  }

  const shared = readFileSync(path.join(ROOT, "features", "shell", "ui", "pending-page.tsx"), "utf8");
  assert.ok(shared.includes("robots: { index: false, follow: false }"), "หน้าที่กำลังจัดทำต้องสั่ง noindex");

  /* ตรวจจากตัวสร้าง sitemap จริง: หน้าปกติ 1 หน้า × 2 ภาษา */
  const home: PageRecord = {
    id: "home",
    nameTh: "หน้าแรก",
    nameEn: "Home",
    menuOrder: 10,
    inMenu: true,
    editor: "blocks",
    seo: EMPTY_PAGE_SEO,
  };
  const entries = buildSitemapEntries({
    siteUrl: "https://example.test/",
    pages: [home],
    locales: LOCALES,
  });

  for (const entry of entries) {
    for (const id of PENDING_PAGE_IDS) {
      assert.ok(
        !entry.url.includes(pendingPagePath(id)),
        `sitemap ห้ามมีหน้าที่กำลังจัดทำ (${entry.url}) — ยังไม่มีเนื้อหาจริง`,
      );
    }
  }
});

test("links: พจนานุกรมของหน้าที่กำลังจัดทำมีครบทุก id ทั้งสองภาษา", () => {
  for (const locale of ["th", "en"] as const) {
    const source = readFileSync(path.join(ROOT, "lib", "i18n", "messages", "areas", locale, "pendingPages.ts"), "utf8");
    for (const id of PENDING_PAGE_IDS) {
      assert.ok(source.includes(`${id}: {`), `${locale}: ขาดข้อความของ "${id}"`);
    }
    assert.ok(source.includes("title:") && source.includes("description:"), `${locale}: ต้องมีหัวข้อและคำอธิบาย`);
  }
});

test("links: หน้า 'กำลังจัดทำ' ต้องมีทางออก (กลับหน้าแรก/ติดต่อ) และไม่ผูกกับฐานข้อมูล", () => {
  const shared = readFileSync(path.join(ROOT, "features", "shell", "ui", "pending-page.tsx"), "utf8");
  assert.ok(shared.includes("PENDING_PAGE_FALLBACK_PATHS.home"), "ต้องมีลิงก์กลับหน้าแรก");
  assert.ok(shared.includes("PENDING_PAGE_FALLBACK_PATHS.contact"), "ต้องมีลิงก์ไปหน้าติดต่อ");

  /* หน้าพวกนี้เป็น static ล้วน — ไม่มี DB/ISR (หน้าที่ไม่แตะฐานข้อมูลไม่ต้องมี revalidate) */
  assert.ok(!shared.includes("revalidate"), "ห้ามตั้ง revalidate ในหน้าที่ไม่แตะฐานข้อมูล");
  assert.ok(!shared.includes("@/db/pool"), "ห้ามดึงฐานข้อมูลเข้ามาในหน้าที่ไม่ต้องใช้");
  assert.ok(!shared.includes("loadSiteSettings"), "ไม่พึ่งค่าจากฐานข้อมูล (ต้องเปิดได้แม้ DB ล่ม)");
});
