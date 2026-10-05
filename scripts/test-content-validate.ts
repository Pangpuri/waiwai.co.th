import assert from "node:assert/strict";
import { test } from "node:test";

import { HOME_PAGE_SPEC } from "@/lib/content/model";
import { HOME_SEED } from "@/lib/content/home-seed";
import { errorsOf, missingEnglishReport, validateContent, warningsOf } from "@/lib/content/validate";
import type { ContentIssue, IssueCode } from "@/lib/content/validate";
import type { LocalizedValue, PageContent } from "@/lib/content/types";

/**
 * เทสต์ของ validator เนื้อหา (lib/content/validate.ts)
 *
 * ทำไมต้องมี: กติกาเหล่านี้เป็น "ประตู" ของการ publish — ถ้าผิด เนื้อหาที่พังจะขึ้นเว็บ
 * ทุกเคสใช้ **สำเนาของ seed จริง** (structuredClone) แล้วแก้จุดเดียว → เทสต์ตรงกับข้อมูลจริง ไม่ใช่ข้อมูลสมมติ
 */

/** ชนิดที่ "แก้ได้" สำหรับเทสต์ — ค่าจริงในโมเดลเป็น readonly โดยเจตนา */
type MutableText = { th: string; en: string };
type MutableMedia = { path: string; altTh: string; altEn: string; hasWatermark: boolean };

type MutableItem = {
  order: number;
  fields: Record<string, MutableText>;
  media: Record<string, MutableMedia>;
};
type MutableSection = {
  fields: Record<string, MutableText>;
  items: Record<string, MutableItem[]>;
};
type MutableContent = {
  page: string;
  sections: Record<string, MutableSection>;
};

function clone(): MutableContent {
  return structuredClone(HOME_SEED) as unknown as MutableContent;
}

function validate(content: MutableContent): readonly ContentIssue[] {
  return validateContent(HOME_PAGE_SPEC, content as unknown as PageContent);
}

function errorCodes(content: MutableContent): readonly IssueCode[] {
  return errorsOf(validate(content)).map((issue) => issue.code);
}

function warningCodes(content: MutableContent): readonly IssueCode[] {
  return warningsOf(validate(content)).map((issue) => issue.code);
}

function section(content: MutableContent, key: string): MutableSection {
  const value = content.sections[key];
  assert.ok(value, `ต้องมี section ${key}`);
  return value;
}

function first<T>(list: readonly T[]): T {
  const value = list[0];
  assert.ok(value, "ต้องมีอย่างน้อย 1 รายการ");
  return value;
}

function text(value: string): LocalizedValue {
  return { th: value, en: "" };
}

/* ── happy path ─────────────────────────────────────────────────────── */

test("validate: seed เนื้อหาหน้าจริงผ่านโดยไม่มี error", () => {
  const issues = validate(clone());
  const errors = errorsOf(issues);
  assert.deepEqual(
    errors.map((issue) => `${issue.code} @ ${issue.path}`),
    [],
    "ข้อมูลชุดจริงต้องไม่มี error (คำเตือนแยกไว้ต่างหาก)",
  );
});

test("validate: seed มีคำเตือน placeholder และภาพติดลายน้ำ (ไม่ทำให้ด่านแดง)", () => {
  const warnings = warningCodes(clone());
  assert.ok(warnings.includes("placeholder"), "ต้องมีคำเตือนเรื่องข้อความ placeholder");
  assert.ok(warnings.includes("watermark"), "ต้องมีคำเตือนภาพที่ติดลายน้ำ");
  assert.equal(errorsOf(validate(clone())).length, 0, "คำเตือนต้องไม่ถูกนับเป็น error");
});

/* ── TH บังคับ ──────────────────────────────────────────────────────── */

test("validate: ฟิลด์ระดับ section ที่เว้นว่าง = error", () => {
  const content = clone();
  section(content, "hero").fields.title = text("   ");
  assert.ok(errorCodes(content).includes("empty-th"));
});

test("validate: ฟิลด์ที่ตั้ง required=false เว้นว่างได้", () => {
  const content = clone();
  section(content, "hero").fields.note = text("");
  section(content, "newsletter").fields.note = text("");
  assert.ok(!errorCodes(content).includes("empty-th"), "note ที่เจตนาเว้นว่างต้องไม่เป็น error");
});

/* ── EN ตามมติ D3 ───────────────────────────────────────────────────── */

test("validate: EN หายในฟิลด์ระดับส่วน/หน้า = error", () => {
  const content = clone();
  /* รอบที่ 111: section "brand" ถูกลบออกจากสคีมา ⇒ ใช้ "products" (ฟิลด์ระดับส่วน) ทดสอบแทน */
  section(content, "products").fields.title = { th: "ไทย", en: "" };
  assert.ok(errorCodes(content).includes("missing-en"));
});

test("validate: รายการที่ไม่มี EN เลย = ยอมรับได้ (มติ D3)", () => {
  const content = clone();
  const recipe = first(section(content, "recipes").items.recipes ?? []);
  for (const value of Object.values(recipe.fields)) {
    value.en = "";
  }
  assert.ok(!errorCodes(content).includes("incomplete-en"), "ไม่มี EN เลยต้องไม่เป็น error");
  assert.ok(
    errorCodes(content).length === 0,
    "การลบ EN ของรายการต้องไม่ทำให้เกิด error อื่นตามมา",
  );
  assert.ok(
    missingEnglishReport(HOME_PAGE_SPEC, content as unknown as PageContent).includes("recipes.recipes[0]"),
    "ต้องปรากฏในรายงานว่ายังไม่มี EN",
  );
});

test("validate: รายการที่กรอก EN มาไม่ครบ = error", () => {
  const content = clone();
  const card = first(section(content, "hero").items.card ?? []);
  const title = card.fields.title;
  assert.ok(title);
  title.en = "Campaign";
  card.fields.body = text("ไทยเท่านั้น");
  const errors = errorCodes(content).filter((code) => code === "incomplete-en");
  assert.ok(errors.length >= 1, "มี EN บางช่องแต่ช่องอื่นว่าง ต้องเป็น error");
});

test("validate: ฟิลด์ที่ไม่ต้องแปล (โทนสี/ลิงก์/วันที่) ไม่นับในกติกา EN", () => {
  const content = clone();
  const category = first(section(content, "products").items.categories ?? []);
  const tone = category.fields.tone;
  assert.ok(tone);
  tone.en = "";
  assert.ok(!errorCodes(content).includes("incomplete-en"));
});

/* ── ภาพ (D7 + D9) ─────────────────────────────────────────────────── */

test("validate: ภาพที่เก็บเป็น URL เต็ม = error (มติ D9 ต้องเก็บพาธ)", () => {
  const content = clone();
  const slide = first(section(content, "hero").items.slides ?? []);
  const image = slide.media.image;
  assert.ok(image);
  image.path = "https://cdn.example.com/slide.jpg";
  assert.ok(errorCodes(content).includes("media-path-is-url"));

  image.path = "//cdn.example.com/slide.jpg";
  assert.ok(errorCodes(content).includes("media-path-is-url"), "URL แบบขึ้นต้น // ก็ต้องถูกปฏิเสธ");
});

test("validate: ภาพที่ไม่มี alt ภาษาไทย = error", () => {
  const content = clone();
  const slide = first(section(content, "hero").items.slides ?? []);
  const image = slide.media.image;
  assert.ok(image);
  image.altTh = "  ";
  assert.ok(errorCodes(content).includes("missing-alt"));
});

test("validate: ภาพที่ไม่มีพาธ = error", () => {
  const content = clone();
  const slide = first(section(content, "hero").items.slides ?? []);
  const image = slide.media.image;
  assert.ok(image);
  image.path = "";
  assert.ok(errorCodes(content).includes("empty-media-path"));
});

/* ── ลำดับ/จำนวนรายการ ──────────────────────────────────────────────── */

test("validate: ลำดับซ้ำ = error", () => {
  const content = clone();
  const slides = section(content, "hero").items.slides ?? [];
  const second = slides[1];
  assert.ok(second);
  second.order = 1;
  assert.ok(errorCodes(content).includes("duplicate-order"));
});

test("validate: ลำดับไม่ใช่จำนวนเต็มบวก = error", () => {
  const content = clone();
  const slide = first(section(content, "hero").items.slides ?? []);
  slide.order = 0;
  assert.ok(errorCodes(content).includes("bad-order"));
});

test("validate: เพิ่มรายการเกินจำนวนสูงสุด = error", () => {
  const content = clone();
  const card = section(content, "hero").items.card ?? [];
  const copy = structuredClone(first(card)) as MutableItem;
  copy.order = 2;
  card.push(copy);
  assert.ok(errorCodes(content).includes("too-many-items"));
});

/* ── รูปแบบค่า ──────────────────────────────────────────────────────── */

test("validate: วันที่ผิดรูปแบบ = error", () => {
  const content = clone();
  const newsItem = first(section(content, "news").items.news ?? []);
  const date = newsItem.fields.date;
  assert.ok(date);
  date.th = "19/08/2026";
  assert.ok(errorCodes(content).includes("bad-date"));
});

test("validate: ลิงก์ที่ไม่มี / หรือ https:// = error", () => {
  const content = clone();
  const marketplace = first(section(content, "whereToBuy").items.marketplaces ?? []);
  const href = marketplace.fields.href;
  assert.ok(href);
  href.th = "shopee.co.th/waiwai";
  assert.ok(errorCodes(content).includes("bad-url"));
});

test("validate: ข้อความยาวเกินกำหนด = error", () => {
  const content = clone();
  /* รอบที่ 111: กลุ่ม "brand.stats" ถูกลบ ⇒ ใช้ "products.categories.name" (จำกัด 60 ตัวอักษร) */
  const category = first(section(content, "products").items.categories ?? []);
  const value = category.fields.name;
  assert.ok(value);
  value.th = "9".repeat(200);
  assert.ok(errorCodes(content).includes("too-long"));
});

/* ── โครงที่ผิด ─────────────────────────────────────────────────────── */

test("validate: ชื่อหน้าไม่ตรง = error", () => {
  const content = clone();
  content.page = "homepage";
  assert.ok(errorCodes(content).includes("page-mismatch"));
});

test("validate: section หาย = error", () => {
  const content = clone();
  delete content.sections.newsletter;
  assert.ok(errorCodes(content).includes("missing-section"));
});

test("validate: section แปลกปลอมที่โมเดลไม่รู้จัก = error", () => {
  const content = clone();
  content.sections.extra = { fields: {}, items: {} };
  assert.ok(errorCodes(content).includes("unknown-section"));
});

test("validate: ฟิลด์ที่โมเดลไม่รู้จัก = error", () => {
  const content = clone();
  section(content, "hero").fields.mystery = text("x");
  assert.ok(errorCodes(content).includes("unknown-field"));
});

test("validate: กลุ่มรายการที่โมเดลไม่รู้จัก = error", () => {
  const content = clone();
  section(content, "hero").items.mystery = [];
  assert.ok(errorCodes(content).includes("unknown-item-group"));
});

test("validate: กลุ่มรายการที่ต้องมีแต่หายไป = error", () => {
  const content = clone();
  /* รอบที่ 108: กลุ่ม `products.featured` ถูกตัดออกจากโมเดล (ของจริงมาจากฐานข้อมูล) ⇒ ใช้ `categories` แทน */
  delete section(content, "products").items.categories;
  assert.ok(errorCodes(content).includes("missing-item-group"));
});
