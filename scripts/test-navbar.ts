import assert from "node:assert/strict";
import { test } from "node:test";

import { PRIMARY_NAV } from "@/features/shell/nav";
import { th } from "@/lib/i18n/messages/th";
import {
  MAX_NAV_BUTTONS,
  applyPageMenu,
  MAX_NAV_ITEMS,
  NAV_ICON_KEYS,
  NAVBAR_PAGE_KEY,
  defaultNavbarConfig,
  navbarErrorsOf,
  parseNavbarConfig,
  validateNavbarConfig,
} from "@/lib/chrome/navbar";

/** เทสต์ตั้งค่าแถบเมนู (ผู้ใช้สั่ง รอบที่ 53) — ต้องไม่เปลี่ยนพฤติกรรมเดิมเมื่อยังไม่ตั้งค่า */

test("navbar: ค่าเริ่มต้น = เมนูปัจจุบันในโค้ด (ไม่เปลี่ยนพฤติกรรมเดิม)", () => {
  const config = defaultNavbarConfig(th);

  assert.equal(config.items.length, PRIMARY_NAV.length);
  assert.deepEqual(config.items.map((item) => item.id), PRIMARY_NAV.map((item) => item.id));
  assert.deepEqual(config.items.map((item) => item.href), PRIMARY_NAV.map((item) => item.path));
  assert.equal(config.items[0]?.label.th, th.nav.home);

  assert.equal(config.buttons.length, 1, "ปุ่ม CTA เดิมยังอยู่");
  assert.equal(config.buttons[0]?.tone, "brand");
  assert.equal(config.buttons[0]?.position, "right");

  assert.equal(config.logo, null, "ยังไม่มีไฟล์โลโก้ ⇒ ใช้ wordmark เดิม");
  assert.equal(navbarErrorsOf(validateNavbarConfig(config)).length, 0, "ค่าเริ่มต้นต้องผ่านการตรวจ");
});

test("navbar: คีย์ในฐานข้อมูลคือ chrome-navbar (ไม่ชนกับหน้าอื่น)", () => {
  assert.equal(NAVBAR_PAGE_KEY, "chrome-navbar");
});

test("navbar: อ่านค่าที่แก้จากหน้าจอได้ + เติมค่าเริ่มต้นให้ช่องที่ไม่ได้ส่ง", () => {
  const outcome = parseNavbarConfig(
    {
      background: "brand",
      height: "tall",
      logoSize: "lg",
      logo: { path: "/media/logo1", altTh: "โลโก้ไวไว" },
      items: [{ id: "home", label: { th: "หน้าแรก", en: "Home" }, href: "/", icon: "star" }],
      buttons: [{ id: "b1", label: { th: "สั่งซื้อ", en: "Shop" }, href: "https://shop.example", icon: "cart", tone: "contrast", position: "left" }],
    },
    th,
  );

  assert.equal(outcome.ok, true);
  assert.ok(outcome.ok);
  assert.equal(outcome.config.background, "brand");
  assert.equal(outcome.config.logo?.path, "/media/logo1");
  assert.equal(outcome.config.items[0]?.icon, "star");
  assert.equal(outcome.config.buttons[0]?.tone, "contrast");
  assert.equal(outcome.config.buttons[0]?.position, "left");
});

test("navbar: ค่าที่ไม่รู้จักถูกแทนด้วยค่าเริ่มต้น (ไม่พังทั้งก้อน)", () => {
  const outcome = parseNavbarConfig({ background: "ม่วงนีออน", height: "สูงมาก", icon: "x" }, th);
  assert.equal(outcome.ok, true);
  assert.ok(outcome.ok);
  assert.equal(outcome.config.background, "surface");
  assert.equal(outcome.config.height, "normal");
});

test("navbar: เมนู/ปุ่ม ถูกตัดตามเพดาน", () => {
  const many = Array.from({ length: MAX_NAV_ITEMS + 5 }, (_unused, index) => ({
    id: `i${index}`,
    label: { th: `เมนู ${index}`, en: "" },
    href: "/x",
    icon: "none",
  }));
  const buttons = Array.from({ length: MAX_NAV_BUTTONS + 3 }, (_unused, index) => ({
    id: `b${index}`,
    label: { th: `ปุ่ม ${index}`, en: "" },
    href: "/y",
    icon: "none",
    tone: "brand",
    position: "right",
  }));

  const outcome = parseNavbarConfig({ items: many, buttons }, th);
  assert.equal(outcome.ok, true);
  assert.ok(outcome.ok);
  assert.equal(outcome.config.items.length, MAX_NAV_ITEMS);
  assert.equal(outcome.config.buttons.length, MAX_NAV_BUTTONS);
});

test("navbar: ตรวจความถูกต้อง — เมนูว่าง/ลิงก์อันตราย/โลโก้ไม่มีคำอธิบาย", () => {
  const base = defaultNavbarConfig(th);

  const noItems = { ...base, items: [] };
  assert.ok(navbarErrorsOf(validateNavbarConfig(noItems)).some((entry) => entry.code === "no-items"));

  const badHref = { ...base, items: [{ id: "x", label: { th: "อันตราย", en: "" }, href: "javascript:alert(1)", icon: "none" as const }] };
  assert.ok(navbarErrorsOf(validateNavbarConfig(badHref)).some((entry) => entry.code === "bad-href"));

  const noAlt = { ...base, logo: { path: "/media/a", altTh: "", altEn: "" } };
  assert.ok(navbarErrorsOf(validateNavbarConfig(noAlt)).some((entry) => entry.code === "missing-alt"));

  const urlLogo = { ...base, logo: { path: "https://example.test/logo.png", altTh: "โลโก้", altEn: "" } };
  assert.ok(navbarErrorsOf(validateNavbarConfig(urlLogo)).some((entry) => entry.code === "media-path-is-url"));
});

test("navbar: รายการไอคอนมีครบตามที่ประกาศ และมี 'ไม่มีไอคอน'", () => {
  assert.ok(NAV_ICON_KEYS.length >= 10);
  assert.equal(NAV_ICON_KEYS[0]?.value, "none");
  assert.equal(new Set(NAV_ICON_KEYS.map((entry) => entry.value)).size, NAV_ICON_KEYS.length, "คีย์ไอคอนห้ามซ้ำ");
});

/* ── ชื่อเมนูมาจาก "ชื่อหน้า" (W1 — รอบที่ 61) ─────────────────────────────── */

test("applyPageMenu: ใช้ชื่อหน้าทับป้ายเมนูของ navbar", () => {
  const base = defaultNavbarConfig(th);
  const next = applyPageMenu(base, { labels: { products: { th: "สินค้าของเรา", en: "Our products" } }, hidden: [] });

  const products = next.items.find((item) => item.id === "products");
  assert.equal(products?.label.th, "สินค้าของเรา");
  assert.equal(products?.label.en, "Our products");

  /* รายการที่ไม่มีหน้าคู่กันต้องไม่ถูกแตะ */
  assert.equal(next.items.length, base.items.length);
  assert.equal(next.items[0]?.label.th, base.items[0]?.label.th);
});

test("applyPageMenu: หน้าที่ปิด 'แสดงในเมนู' ถูกซ่อน", () => {
  const base = defaultNavbarConfig(th);
  const next = applyPageMenu(base, { labels: {}, hidden: ["news", "careers"] });

  assert.equal(next.items.some((item) => item.id === "news"), false);
  assert.equal(next.items.some((item) => item.id === "careers"), false);
  assert.equal(next.items.length, base.items.length - 2);
});

test("applyPageMenu: ถ้าซ่อนจนไม่เหลือเมนูเลย = คงของเดิม (ไม่ทำเมนูหายทั้งแถบ)", () => {
  const base = defaultNavbarConfig(th);
  const next = applyPageMenu(base, { labels: {}, hidden: base.items.map((item) => item.id) });
  assert.equal(next.items.length, base.items.length);
});

test("applyPageMenu: ปุ่มที่เพิ่มเองไม่ถูกแตะ (ไม่ใช่หน้า)", () => {
  const base = defaultNavbarConfig(th);
  const next = applyPageMenu(base, { labels: { "my-button": { th: "ไม่ควรใช้", en: "nope" } }, hidden: [] });
  assert.equal(next.buttons.length, base.buttons.length);
  assert.equal(next.buttons[0]?.label.th, base.buttons[0]?.label.th);
});
