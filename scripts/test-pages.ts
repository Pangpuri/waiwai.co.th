import assert from "node:assert/strict";
import { test } from "node:test";

import { PRIMARY_NAV } from "@/features/shell/nav";
import { th } from "@/lib/i18n/messages/th";
import {
  EMPTY_PAGE_SEO,
  MAX_PAGE_NAME_LENGTH,
  defaultPages,
  normalizePageName,
  pageLabel,
  sortPages,
  validatePageName,
  type PageRecord,
} from "@/lib/pages/model";

/** เทสต์ "หน้าเป็นวัตถุ" (W1) — ตรรกะล้วน ไม่ต้องมีฐานข้อมูล */

const page = (id: string, menuOrder: number, nameTh = id, nameEn = ""): PageRecord => ({
  id,
  nameTh,
  nameEn,
  menuOrder,
  inMenu: true,
  editor: "designed",
  seo: EMPTY_PAGE_SEO,
});

test("defaultPages: ตรงกับเมนูปัจจุบันในโค้ดเป๊ะ (id · ลำดับ · ชื่อจากพจนานุกรม)", () => {
  const pages = defaultPages(th);

  assert.deepEqual(pages.map((entry) => entry.id), PRIMARY_NAV.map((item) => item.id));
  assert.deepEqual(pages.map((entry) => entry.menuOrder), [10, 20, 30, 40, 50, 60, 70, 80, 90]);
  assert.equal(pages[0]?.nameTh, th.nav.home);
  assert.equal(pages[3]?.nameTh, th.nav.executives);
  assert.equal(pages.every((entry) => entry.inMenu), true);

  /* หน้าแรกแก้ด้วยบล็อกได้ · หน้าอื่นใช้เลย์เอาต์ที่ออกแบบไว้ */
  assert.equal(pages[0]?.editor, "blocks");
  assert.equal(pages.filter((entry) => entry.editor === "blocks").length, 1);
});

test("sortPages: เรียงตามลำดับเมนู แล้วค่อยตาม id (ผลคงที่)", () => {
  const sorted = sortPages([page("b", 20), page("a", 10), page("c", 20)]);
  assert.deepEqual(sorted.map((entry) => entry.id), ["a", "b", "c"]);
});

test("pageLabel: อังกฤษว่าง = ใช้ชื่อไทย (ไม่ปล่อยให้เมนูว่าง)", () => {
  assert.equal(pageLabel(page("x", 1, "หน้าแรก", "Home"), "en"), "Home");
  assert.equal(pageLabel(page("x", 1, "หน้าแรก", ""), "en"), "หน้าแรก");
  assert.equal(pageLabel(page("x", 1, "หน้าแรก", "Home"), "th"), "หน้าแรก");
});

test("normalizePageName: ตัดช่องว่างซ้ำ · ว่างใช้ไม่ได้ · ยาวเกินถูกตัด", () => {
  assert.equal(normalizePageName("  ข่าวสาร   & กิจกรรม  "), "ข่าวสาร & กิจกรรม");
  assert.equal(normalizePageName("   "), null);
  assert.equal(normalizePageName("ก".repeat(100))?.length, MAX_PAGE_NAME_LENGTH);
});

test("validatePageName: ไทยบังคับ · อังกฤษเว้นได้ · ยาวเกินเพดานคือ error", () => {
  assert.deepEqual(validatePageName("ติดต่อเรา", "Contact us"), []);
  assert.deepEqual(validatePageName("ติดต่อเรา", ""), [], "อังกฤษว่างได้ (ใช้ชื่อไทยแทน)");
  assert.ok(validatePageName("", "Contact").some((issue) => issue.code === "empty-th"));
  assert.ok(validatePageName("ก".repeat(MAX_PAGE_NAME_LENGTH + 1), "").some((issue) => issue.code === "too-long"));
});

test("หน้าทั้งหมดมี id ไม่ซ้ำ และ id ตรงกับเส้นทางเมนูในโค้ด", () => {
  const pages = defaultPages(th);
  assert.equal(new Set(pages.map((entry) => entry.id)).size, pages.length);
  for (const item of PRIMARY_NAV) {
    assert.ok(pages.some((entry) => entry.id === item.id), `ต้องมีหน้า ${item.id}`);
  }
});
