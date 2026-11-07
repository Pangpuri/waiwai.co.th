import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { ADMIN_SIDEBAR_STORAGE_KEY } from "@/lib/admin/ui-storage";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { COOKIE_POLICY_ITEMS, COOKIE_POLICY_ITEM_NAMES } from "@/lib/cookie-policy";
import { COOKIE_CONSENT_STORAGE_KEY } from "@/lib/cookie-consent";
import { HERO_CARD_STORAGE_KEY } from "@/lib/hero-card";
import { cookiePolicyPage as en } from "@/lib/i18n/messages/areas/en/cookiePolicy";
import { en as enMessages } from "@/lib/i18n/messages/en";
import { th } from "@/lib/i18n/messages/th";
import { cookiePolicyPage as thCookiePolicy } from "@/lib/i18n/messages/areas/th/cookiePolicy";
import { LOCALES } from "@/lib/i18n/config";
import { MAINTENANCE_BYPASS_COOKIE } from "@/lib/maintenance/bypass";
import { MOURNING_STORAGE_KEY } from "@/lib/mourning-notice";
import { CODE_ONLY_PAGE_PATHS } from "@/lib/pages/paths";
import { PENDING_PAGE_IDS } from "@/lib/pages/pending";
import { EMPTY_PAGE_SEO, type PageRecord } from "@/lib/pages/model";
import { buildSitemapEntries } from "@/lib/site-settings/sitemap";
import { THEME_STORAGE_KEY } from "@/lib/theme/theme";

import { codeOf } from "./source-scan.ts";

/**
 * ด่านของหน้า /cookie-policy (รอบ 335)
 *
 * ปิดความเสี่ยง 3 อย่าง
 * 1) หน้าเว็บกลับไปเป็นหน้า "กำลังจัดทำ" หรือหลุดจาก sitemap
 * 2) รายการคุกกี้ในหน้าเว็บไม่ตรงกับคีย์จริงในโค้ด (เพิ่มคุกกี้แล้วลืมอัปเดต)
 * 3) ถ้อยคำกลับไปบอกว่ามีคุกกี้วิเคราะห์/การตลาด ทั้งที่เว็บไม่ได้ใช้
 */

const ROOT = path.resolve(import.meta.dirname, "..");

function sourceOf(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8").replace(/\r\n/g, "\n");
}

test("cookie policy: ชื่อรายการทั้งหมดตรงกับค่าคงที่จริงในโค้ด", () => {
  assert.deepEqual(COOKIE_POLICY_ITEM_NAMES, {
    adminSession: SESSION_COOKIE_NAME,
    maintenanceBypass: MAINTENANCE_BYPASS_COOKIE,
    theme: THEME_STORAGE_KEY,
    cookieConsent: COOKIE_CONSENT_STORAGE_KEY,
    mourningNotice: MOURNING_STORAGE_KEY,
    heroCard: HERO_CARD_STORAGE_KEY,
    adminSidebar: ADMIN_SIDEBAR_STORAGE_KEY,
  });

  const names = COOKIE_POLICY_ITEMS.map((item) => item.name);
  assert.equal(new Set(names).size, names.length, "ชื่อคุกกี้/localStorage ต้องไม่ซ้ำ");
  assert.ok(names.every((name) => name.trim() !== ""), "ต้องไม่มีชื่อว่าง");
});

test("cookie policy: มีทั้งคุกกี้และ localStorage และคุกกี้ที่ตั้งมีเฉพาะของเจ้าหน้าที่", () => {
  const kinds = new Set(COOKIE_POLICY_ITEMS.map((item) => item.kind));
  assert.deepEqual([...kinds].sort(), ["cookie", "localStorage"]);

  for (const item of COOKIE_POLICY_ITEMS) {
    assert.ok(item.scope === "public" || item.scope === "staff", `${item.id}: scope ไม่ถูกต้อง`);
    assert.ok(item.kind === "cookie" || item.kind === "localStorage", `${item.id}: kind ไม่ถูกต้อง`);
    if (item.kind === "cookie") {
      assert.equal(item.scope, "staff", `${item.id}: เว็บนี้ต้องไม่ตั้งคุกกี้ให้ผู้เข้าชมทั่วไป`);
    }
  }
});

test("cookie policy: พจนานุกรม TH/EN มีคำอธิบาย/ระยะเวลาครบทุกคีย์", () => {
  for (const [locale, dict] of [
    ["th", thCookiePolicy],
    ["en", en],
  ] as const) {
    for (const item of COOKIE_POLICY_ITEMS) {
      const entry = dict.items[item.id];
      assert.ok(entry.purpose.trim() !== "", `${locale}: ${item.id} ขาด purpose`);
      assert.ok(entry.duration.trim() !== "", `${locale}: ${item.id} ขาด duration`);
    }

    assert.ok(dict.updatedBody.includes(locale === "th" ? "มีผลตั้งแต่วันที่" : "Effective"), `${locale}: ต้องมีวันที่มีผล`);
    assert.ok(dict.notUsedBody.includes("Google Analytics"), `${locale}: ต้องบอกว่าไม่มี analytics`);
    assert.ok(dict.thirdPartyBody.includes("Vercel"), `${locale}: ต้องระบุผู้ให้บริการโฮสต์`);
    assert.ok(dict.thirdPartyBody.includes("Neon"), `${locale}: ต้องระบุผู้ให้บริการฐานข้อมูล`);
    assert.ok(dict.thirdPartyYouTube.includes("youtube-nocookie"), `${locale}: ต้องบอกเรื่อง YouTube`);
  }
});

test("cookie policy: หน้าเว็บเป็นเนื้อหาจริง ไม่ใช่หน้า 'กำลังจัดทำ' และมี h1 เดียว", () => {
  const page = codeOf("app/[lang]/cookie-policy/page.tsx");

  assert.ok(page.includes("COOKIE_POLICY_ITEMS"), "หน้าเว็บต้องอ่านรายการจากโมเดลกลาง");
  assert.ok(page.includes("buildAlternates"), "ต้องมี canonical/hreflang รายหน้า");
  assert.ok(page.includes("CookieSettingsButton"), "ต้องมีปุ่มเปลี่ยนการตั้งค่าคุกกี้");
  assert.ok(page.includes("md:hidden") && page.includes("min-w-[42rem]"), "ตารางต้องมีการ์ดบนมือถือและเลื่อนแนวนอนบนจอใหญ่");
  assert.ok(!page.includes("<PendingPage"), "ห้ามกลับไปใช้หน้า PendingPage");
  assert.ok(!page.includes("pendingPageMetadata"), "ห้ามใช้ metadata ของหน้า 'กำลังจัดทำ'");
  assert.equal((page.match(/<h1[ >]/g) ?? []).length, 1, "ต้องมี h1 1 ตัว");
});

test("cookie policy: ไม่อยู่ในรายการ pending แต่มีใน CODE_ONLY_PAGE_PATHS และ sitemap", () => {
  assert.ok(!(PENDING_PAGE_IDS as readonly string[]).includes("cookiePolicy"));
  assert.ok(
    CODE_ONLY_PAGE_PATHS.some((page) => page.path === "/cookie-policy"),
    "ต้องอยู่ในรายการหน้าในโค้ดที่ควร index",
  );

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
  const urls = entries.map((entry) => entry.url);

  for (const locale of LOCALES) {
    assert.ok(urls.includes(`https://example.test/${locale}/cookie-policy`), `sitemap ขาด /${locale}/cookie-policy`);
  }
});

test("cookie policy: แถบคุกกี้ไม่บอกว่ามีการวิเคราะห์ และปุ่มตั้งค่าล้างคำตอบจริง", () => {
  assert.ok(!th.cookie.body.includes("วิเคราะห์"), "ข้อความแถบคุกกี้ต้องไม่บอกว่ามีการวิเคราะห์");
  assert.ok(
    enMessages.cookie.body.includes("do not use cookies for marketing"),
    "EN ต้องบอกว่าไม่ใช้เพื่อการตลาด",
  );

  const button = codeOf("features/shell/ui/cookie-settings-button.tsx");
  assert.ok(button.includes("COOKIE_CONSENT_STORAGE_KEY"), "ปุ่มต้องล้างคีย์คำตอบเดิม");
  assert.ok(button.includes("COOKIE_CONSENT_ATTRIBUTE"), "ปุ่มต้องถอด attribute บน <html>");
  assert.ok(button.includes("removeItem"), "ปุ่มต้องลบคำตอบใน localStorage");
  assert.ok(button.includes("role=\"status\""), "ต้องมีข้อความแจ้งผลแบบ a11y");
});

test("cookie policy: ท้ายเว็บมีลิงก์ไปหน้านี้ทั้งสองภาษา", () => {
  const footer = codeOf("features/shell/ui/site-footer.tsx");
  const footerView = codeOf("lib/chrome/footer-view.ts");

  assert.ok(footer.includes("view.cookiesHref") && footer.includes("view.labels.cookies"));
  assert.ok(footerView.includes('localePath(locale, "/cookie-policy")'));
  assert.ok(sourceOf("lib/i18n/messages/areas/th/core.ts").includes('cookies: "นโยบายคุกกี้"'));
  assert.ok(sourceOf("lib/i18n/messages/areas/en/core.ts").includes('cookies: "Cookie policy"'));
});
