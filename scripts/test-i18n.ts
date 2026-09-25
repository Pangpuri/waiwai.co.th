import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_LOCALE,
  LOCALES,
  buildAlternates,
  isLocale,
  localePath,
  resolveLocale,
  shouldBypassLocaleRouting,
  switchLocalePath,
} from "@/lib/i18n/config";

test("isLocale: รับเฉพาะภาษาที่ประกาศไว้", () => {
  assert.equal(isLocale("th"), true);
  assert.equal(isLocale("en"), true);

  // ค่าที่มาจาก URL เป็นได้ทุกอย่าง ต้องไม่ throw
  assert.equal(isLocale("de"), false);
  assert.equal(isLocale(""), false);
  assert.equal(isLocale(null), false);
  assert.equal(isLocale(undefined), false);
  assert.equal(isLocale(123), false);
  assert.equal(isLocale({}), false);
  assert.equal(isLocale("TH"), false, "ตัวพิมพ์ใหญ่ต้องไม่ผ่าน");
});

test("resolveLocale: เลือกภาษาจาก Accept-Language", () => {
  assert.equal(resolveLocale(undefined), DEFAULT_LOCALE);
  assert.equal(resolveLocale(null), DEFAULT_LOCALE);
  assert.equal(resolveLocale(""), DEFAULT_LOCALE);

  assert.equal(resolveLocale("en-US,en;q=0.9"), "en");
  assert.equal(resolveLocale("th-TH,th;q=0.9"), "th");

  // ภาษาที่ไม่รองรับ ให้ถอยไปใช้ตัวที่รองรับถัดไป
  assert.equal(resolveLocale("de-DE,de;q=0.9,en;q=0.8"), "en");

  // ไม่มีตัวไหนรองรับเลย → ภาษาหลัก
  assert.equal(resolveLocale("fr-FR,fr;q=0.9"), DEFAULT_LOCALE);

  // q=0 แปลว่าผู้ใช้ไม่ต้องการภาษานั้น
  assert.equal(resolveLocale("en;q=0,th;q=0.5"), "th");

  // ค่าเพี้ยนต้องไม่ทำให้พัง
  assert.equal(resolveLocale(";;;q=abc"), DEFAULT_LOCALE);
});

test("localePath: ต่อ prefix ภาษาโดยไม่ซ้ำ slash", () => {
  assert.equal(localePath("th", "/"), "/th");
  assert.equal(localePath("en", "/"), "/en");
  assert.equal(localePath("th", "/products"), "/th/products");
  assert.equal(localePath("en", "products"), "/en/products");
  assert.equal(localePath("en", ""), "/en");
});

test("switchLocalePath: สลับภาษาโดยคงเส้นทางเดิม", () => {
  assert.equal(switchLocalePath("/en/news/1", "th"), "/th/news/1");
  assert.equal(switchLocalePath("/th", "en"), "/en");
  assert.equal(switchLocalePath("/th/", "en"), "/en");
  assert.equal(switchLocalePath("/news", "th"), "/th/news");
  assert.equal(switchLocalePath("/", "en"), "/en");
  assert.equal(switchLocalePath("/th/products/packet-noodles", "en"), "/en/products/packet-noodles");
});

test("shouldBypassLocaleRouting: ไฟล์ static และ API ต้องไม่ถูกเติมภาษา", () => {
  assert.equal(shouldBypassLocaleRouting("/_next/static/chunk.js"), true);
  assert.equal(shouldBypassLocaleRouting("/api/newsletter"), true);
  assert.equal(shouldBypassLocaleRouting("/favicon.ico"), true);
  assert.equal(shouldBypassLocaleRouting("/images/hero.webp"), true);
  assert.equal(shouldBypassLocaleRouting("/icons/logo.svg"), true);

  // path ที่เป็นหน้าจริง ต้องถูกเติมภาษา
  assert.equal(shouldBypassLocaleRouting("/"), false);
  assert.equal(shouldBypassLocaleRouting("/products"), false);
  assert.equal(shouldBypassLocaleRouting("/about/executives"), false);

  // กันเคสชื่อหน้าอังกฤษที่ลงท้ายคล้ายนามสกุลไฟล์
  assert.equal(shouldBypassLocaleRouting("/products/hot-and-spicy"), false);
});

test("LOCALES: ต้องมีอย่างน้อยสองภาษาและมีภาษาหลักอยู่จริง", () => {
  assert.ok(LOCALES.length >= 2);
  assert.ok(LOCALES.includes(DEFAULT_LOCALE));
});

test("buildAlternates: canonical ต้องชี้หน้าของภาษานั้น ไม่ใช่หน้าแรกเสมอ", () => {
  assert.equal(buildAlternates("th").canonical, "/th");
  assert.equal(buildAlternates("en", "/about").canonical, "/en/about");

  // path ที่ไม่ขึ้นต้นด้วย / หรือมี trailing slash ต้องถูกจัดรูปให้เหมือนกัน
  assert.equal(buildAlternates("th", "about").canonical, "/th/about");
  assert.equal(buildAlternates("en", "/about/").canonical, "/en/about");
  assert.equal(buildAlternates("en", "").canonical, "/en");

  // หน้าลูกต้องไม่ถูกยุบไปเป็นหน้าแรก (บั๊กเดิมตอนตั้ง canonical ที่ layout)
  assert.notEqual(buildAlternates("th", "/about").canonical, buildAlternates("th").canonical);
});

test("buildAlternates: hreflang ต้องครบทุกภาษาที่รองรับ", () => {
  const { languages } = buildAlternates("th", "/about");

  for (const locale of LOCALES) {
    assert.ok(languages[locale], `ขาด hreflang ของ ${locale}`);
  }

  assert.equal(languages[DEFAULT_LOCALE], `/${DEFAULT_LOCALE}/about`);
  assert.equal(languages["en"], "/en/about");
});
