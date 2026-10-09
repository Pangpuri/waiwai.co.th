import assert from "node:assert/strict";
import { test } from "node:test";

import {
  addItem,
  canAddItem,
  removeItem,
  setItemMedia,
  setItemText,
  setSectionText,
  toContent,
  toDraft,
} from "@/lib/content/draft";
import { HOME_SEED } from "@/lib/content/home-seed";
import { HOME_PAGE_SPEC } from "@/lib/content/model";
import { parsePageContent } from "@/lib/content/parse";
import { errorsOf, validateContent } from "@/lib/content/validate";

/** เทสต์ของ "ฉบับร่าง" ที่หน้าจอแก้ไขใช้ (pure — ไม่ต้องมี React/DB) */

function specSection(key: string) {
  const section = HOME_PAGE_SPEC.sections.find((candidate) => candidate.key === key);
  assert.ok(section, `ต้องมี section ${key}`);
  return section;
}

function specGroup(sectionKey: string, groupKey: string) {
  const group = specSection(sectionKey).items.find((candidate) => candidate.key === groupKey);
  assert.ok(group, `ต้องมีกลุ่ม ${sectionKey}.${groupKey}`);
  return group;
}

test("draft: แปลงเนื้อหาเป็นฉบับร่างได้ครบ (และกลับเป็นเนื้อหาเดิมได้)", () => {
  const draft = toDraft(HOME_PAGE_SPEC, HOME_SEED);
  const content = toContent(draft);

  assert.deepEqual(content, HOME_SEED, "ไป-กลับต้องได้ค่าเดิม");
  assert.equal(errorsOf(validateContent(HOME_PAGE_SPEC, content)).length, 0);
});

test("draft: เติมโครงให้ครบตาม spec แม้ใน DB ยังไม่มีข้อมูล", () => {
  const draft = toDraft(HOME_PAGE_SPEC, { page: "home", sections: {} });

  assert.equal(Object.keys(draft.sections).length, HOME_PAGE_SPEC.sections.length);
  const hero = draft.sections.hero;
  assert.ok(hero);
  assert.equal(hero.fields.title?.th, "", "ฟิลด์ที่ยังไม่มีข้อมูลต้องมีช่องว่างให้กรอก");
  assert.deepEqual(hero.items.card, [], "กลุ่มที่ยังไม่มีรายการต้องเป็นอาร์เรย์ว่าง");
});

test("draft: แก้ข้อความระดับ section และระดับรายการ", () => {
  const draft = toDraft(HOME_PAGE_SPEC, HOME_SEED);

  const afterSection = setSectionText(draft, "hero", "title", "th", "หัวข้อใหม่");
  assert.equal(afterSection.sections.hero?.fields.title?.th, "หัวข้อใหม่");
  assert.notEqual(draft.sections.hero?.fields.title?.th, "หัวข้อใหม่", "ต้นฉบับต้องไม่ถูกแก้ (immutable)");

  /* ⚠️ รอบที่ 251: เดิมเทสต์นี้ใช้กลุ่ม hero/slides (ตัวอย่าง) — กลุ่มนั้นถูกถอดออกเพราะเป็นข้อมูลตาย
     ⇒ ใช้กลุ่ม products/categories (มีจริง) และเทียบกับ "ค่าก่อนหน้า" ที่อ่านมา ไม่ได้ hardcode ว่าว่าง */
  const beforeEn = afterSection.sections.products?.items.categories?.[0]?.fields.name?.en ?? "";
  const afterItem = setItemText(afterSection, "products", "categories", 0, "name", "en", "left");
  assert.equal(afterItem.sections.products?.items.categories?.[0]?.fields.name?.en, "left");
  assert.equal(afterSection.sections.products?.items.categories?.[0]?.fields.name?.en, beforeEn, "ค่าก่อนหน้าต้องไม่เปลี่ยน");
});

test("draft: เพิ่มรายการ → ลำดับต่อท้าย และมีช่องข้อความครบทุกฟิลด์ (ยกเว้นภาพ)", () => {
  const group = specGroup("recipes", "recipes");
  const draft = toDraft(HOME_PAGE_SPEC, HOME_SEED);

  const before = draft.sections.recipes?.items.recipes?.length ?? 0;
  const after = addItem(draft, "recipes", group);

  const list = after.sections.recipes?.items.recipes ?? [];
  assert.equal(list.length, before + 1);
  assert.equal(list[list.length - 1]?.order, before + 1);

  const textFields = group.fields.filter((field) => field.kind !== "media");
  assert.deepEqual(Object.keys(list[list.length - 1]?.fields ?? {}).sort(), textFields.map((field) => field.key).sort());
});

test("draft: เพิ่มเกินจำนวนที่กำหนดไม่ได้ (ปุ่มควรถูกปิด แต่ตรรกะก็กันไว้ด้วย)", () => {
  const group = specGroup("hero", "card");
  assert.equal(group.maxItems, 1, "การ์ดประกาศมีได้ 1 ใบ");

  const draft = toDraft(HOME_PAGE_SPEC, HOME_SEED);
  assert.equal(canAddItem(draft, "hero", group), false, "มีครบแล้ว = เพิ่มไม่ได้");

  const same = addItem(draft, "hero", group);
  assert.equal(same.sections.hero?.items.card?.length, draft.sections.hero?.items.card?.length);
});

test("draft: ลบรายการแล้วจัดลำดับใหม่ 1..n (คีย์ใน DB ห้ามมีช่องว่าง)", () => {
  const draft = toDraft(HOME_PAGE_SPEC, HOME_SEED);
  const before = draft.sections.products?.items.categories?.length ?? 0;
  assert.ok(before >= 2, "ต้องมีสไลด์อย่างน้อย 2 ใบในชุดตั้งต้น");

  const after = removeItem(draft, "products", "categories", 0);
  const list = after.sections.products?.items.categories ?? [];

  assert.equal(list.length, before - 1);
  assert.deepEqual(
    list.map((item) => item.order),
    list.map((_item, index) => index + 1),
    "ลำดับต้องเป็น 1..n ต่อเนื่อง",
  );

  /* ลบแล้วยังต้องผ่าน validator (ไม่มี bad-order) */
  const content = toContent(after);
  assert.equal(errorsOf(validateContent(HOME_PAGE_SPEC, content)).length, 0);
});

test("draft: ตั้งค่าภาพ (พาธ + alt + ลายน้ำ) และล้างภาพได้", () => {
  const draft = toDraft(HOME_PAGE_SPEC, HOME_SEED);

  const withImage = setItemMedia(draft, "recipes", "recipes", 0, "image", {
    path: "/products/pad-thai.jpg",
    altTh: "ผัดไทย",
    altEn: "Pad Thai",
    hasWatermark: false,
  });
  const image = withImage.sections.recipes?.items.recipes?.[0]?.media.image;
  assert.ok(image);
  assert.equal(image.path, "/products/pad-thai.jpg");
  assert.equal(image.altTh, "ผัดไทย");

  const cleared = setItemMedia(withImage, "recipes", "recipes", 0, "image", { path: "" });
  assert.ok(cleared.sections.recipes?.items.recipes?.[0]?.media.image?.path === "");
});

test("draft: ฉบับร่างที่แก้แล้วยังส่งเข้า parse → validate ได้ตามเส้นทางจริงของหน้าจอ", () => {
  const draft = toDraft(HOME_PAGE_SPEC, HOME_SEED);
  const edited = setSectionText(draft, "hero", "title", "th", "หัวข้อที่แก้จากหน้าจอ");

  /* จำลองสิ่งที่ฟอร์มทำ: แปลงเป็น JSON แล้วส่งกลับเข้าตัวตรวจ */
  const outcome = parsePageContent(HOME_PAGE_SPEC, JSON.parse(JSON.stringify(toContent(edited))));
  assert.equal(outcome.ok, true);
  assert.ok(outcome.ok);
  assert.equal(outcome.content.sections.hero?.fields.title?.th, "หัวข้อที่แก้จากหน้าจอ");
  assert.equal(errorsOf(validateContent(HOME_PAGE_SPEC, outcome.content)).length, 0);
});
