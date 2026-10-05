import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { blockRenderStringsFor } from "@/features/blocks/render-strings";
import {
  addRecipeItem,
  canAddRecipeItem,
  moveRecipeItem,
  removeRecipeItem,
  setRecipeColumns,
  setRecipeItemImage,
  setRecipeItemText,
} from "@/lib/blocks/edit";
import { localizedBlockHref } from "@/lib/blocks/href";
import { parseBlockDocument } from "@/lib/blocks/parse";
import { BLOCK_TEMPLATE_PAGE_IDS, buildBlockTemplate } from "@/lib/blocks/templates";
import {
  BLOCK_CATALOG,
  BLOCK_TYPES,
  MAX_RECIPE_ITEMS,
  createBlock,
  walkBlocks,
  type Block,
  type BlockDocument,
  type RecipeCardsBlock,
} from "@/lib/blocks/types";
import { documentErrorsOf, documentWarningsOf, validateDocument } from "@/lib/blocks/validate";
import { localePath } from "@/lib/i18n/config";

/**
 * เทสต์ของ "บล็อกเมนูอาหาร" (รอบที่ 101) + การเติม prefix ภาษาของลิงก์ในบล็อก
 *
 * ตรรกะล้วน (ไม่ต้องมี DB/React): parse · validate · edit · ข้อความตัวเรนเดอร์ · เทมเพลต · href
 */

type DeepMutable<T> = T extends readonly (infer U)[]
  ? DeepMutable<U>[]
  : T extends object
    ? { -readonly [K in keyof T]: DeepMutable<T[K]> }
    : T;

function mutable<T>(value: T): DeepMutable<T> {
  return structuredClone(value) as DeepMutable<T>;
}

function docOf(blocks: readonly Block[]): BlockDocument {
  return { page: "recipes", blocks };
}

function recipeOf(document: BlockDocument): RecipeCardsBlock {
  const block = document.blocks[0];
  assert.ok(block !== undefined && block.type === "recipeCards");
  return block;
}

/** เก็บสตริงทุกตัวในโครงข้อมูล (ใช้ตรวจว่าเทมเพลตไม่เก็บ href ที่ผูกภาษา) */
function collectStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap((entry) => collectStrings(entry));
  if (typeof value === "object" && value !== null) {
    return Object.values(value as Record<string, unknown>).flatMap((entry) => collectStrings(entry));
  }
  return [];
}

/* ── โมเดล + แคตตาล็อก ─────────────────────────────────────────────────────── */

test("recipes: BLOCK_TYPES และแคตตาล็อกมีชนิด recipeCards", () => {
  assert.ok((BLOCK_TYPES as readonly string[]).includes("recipeCards"));
  assert.ok(BLOCK_CATALOG.some((entry) => entry.type === "recipeCards"));
  assert.ok(MAX_RECIPE_ITEMS > 0);
});

test("recipes: createBlock สร้างค่าเริ่มต้นที่พร้อมแก้ (2 คอลัมน์ · ว่าง · กว้าง)", () => {
  const block = createBlock("recipeCards", "b1");
  assert.ok(block.type === "recipeCards");
  assert.equal(block.items.length, 0);
  assert.equal(block.columns, 2);
  assert.equal(block.style.width, "wide");
  assert.equal(block.heading.th, "");
});

/* ── parse ─────────────────────────────────────────────────────────────────── */

test("recipes: parse เอกสาร recipeCards ไปกลับได้เท่าเดิม", () => {
  const doc = docOf([createBlock("recipeCards", "b1")]);
  const outcome = parseBlockDocument("recipes", JSON.parse(JSON.stringify(doc)));
  assert.equal(outcome.ok, true);
  assert.ok(outcome.ok);
  assert.deepEqual(outcome.document, doc);
});

test("recipes: parse สร้าง id ใหม่เมื่อเมนูไม่มี id หรือ id ซ้ำ", () => {
  const raw = {
    blocks: [
      {
        id: "b1",
        type: "recipeCards",
        style: {},
        items: [
          { title: { th: "ก", en: "A" }, ingredients: { th: "", en: "" }, steps: { th: "", en: "" }, image: null },
          { id: "recipe-1", title: { th: "ข", en: "B" }, body: { th: "", en: "" }, ingredients: { th: "", en: "" }, steps: { th: "", en: "" }, image: null },
          { id: "recipe-1", title: { th: "ค", en: "C" }, ingredients: { th: "", en: "" }, steps: { th: "", en: "" }, image: null },
        ],
      },
    ],
  };

  const outcome = parseBlockDocument("recipes", raw);
  assert.equal(outcome.ok, false, "id ซ้ำต้องถูกรายงาน");
  assert.ok(!outcome.ok);
  assert.ok(outcome.problems.some((problem) => problem.includes("ซ้ำ")));
  /* เมนูที่ไม่มี id = เติมให้เงียบ ๆ (ไม่รายงาน) · เมนูที่ id ซ้ำ = รายงานจุดที่ซ้ำ */
  assert.ok(outcome.problems.some((problem) => problem.includes("items[2].id")));
});

test("recipes: parse ปฏิเสธจำนวนคอลัมน์ที่ไม่รองรับ (4)", () => {
  const outcome = parseBlockDocument("recipes", {
    blocks: [{ id: "b1", type: "recipeCards", style: {}, columns: 4, items: [] }],
  });
  assert.equal(outcome.ok, false);
  assert.ok(!outcome.ok);
  assert.ok(outcome.problems.some((problem) => problem.includes("columns")));
});

test("recipes: parse ตัดเมนูที่เกินเพดานพร้อมรายงาน", () => {
  const items = Array.from({ length: MAX_RECIPE_ITEMS + 2 }, (_unused, index) => ({
    id: `recipe-${index + 1}`,
    title: { th: `เมนู ${index + 1}`, en: "" },
    body: { th: "", en: "" },
    ingredients: { th: "", en: "" },
    steps: { th: "", en: "" },
    image: null,
  }));

  const outcome = parseBlockDocument("recipes", {
    blocks: [{ id: "b1", type: "recipeCards", style: {}, columns: 2, items }],
  });
  assert.equal(outcome.ok, false);
  assert.ok(!outcome.ok);
  assert.ok(outcome.problems.some((problem) => problem.includes("เกินที่อนุญาต")));
});

/* ── validate ──────────────────────────────────────────────────────────────── */

test("recipes: validate — บล็อกว่างเป็นคำเตือน (ไม่บล็อกการเผยแพร่)", () => {
  const warnings = documentWarningsOf(validateDocument(docOf([createBlock("recipeCards", "b1")]))).map((entry) => entry.code);
  assert.ok(warnings.includes("recipeCards-empty"));
  assert.deepEqual(documentErrorsOf(validateDocument(docOf([createBlock("recipeCards", "b1")]))), []);
});

test("recipes: validate — ชื่อเมนูไทยว่าง = error · ไม่มี EN = คำเตือน · ไม่มีภาพ = คำเตือน", () => {
  const block = mutable(createBlock("recipeCards", "b1"));
  assert.ok(block.type === "recipeCards");
  block.items = [
    {
      id: "recipe-1",
      title: { th: "", en: "" },
      body: { th: "", en: "" },
      ingredients: { th: "", en: "" },
      steps: { th: "", en: "" },
      image: null,
    },
  ];

  const issues = validateDocument(docOf([block]));
  const errors = documentErrorsOf(issues).map((entry) => entry.code);
  const warnings = documentWarningsOf(issues).map((entry) => entry.code);
  assert.ok(errors.includes("empty-th"));
  assert.ok(warnings.includes("missing-en"), "ชื่อเมนูยังไม่มี EN = คำเตือน (ไม่บล็อกการเผยแพร่ — มติ D3)");
  assert.ok(warnings.includes("recipe-item-without-image"));
});

test("recipes: validate — ภาพต้องเป็นพาธในโปรเจกต์และต้องมี alt", () => {
  const block = mutable(createBlock("recipeCards", "b1"));
  assert.ok(block.type === "recipeCards");
  block.items = [
    {
      id: "recipe-1",
      title: { th: "ผัดไทย", en: "Pad Thai" },
      body: { th: "", en: "" },
      ingredients: { th: "เส้น", en: "Noodles" },
      steps: { th: "ผัด", en: "Stir-fry" },
      image: { path: "https://example.com/a.jpg", altTh: "", altEn: "", hasWatermark: false },
    },
  ];

  const errors = documentErrorsOf(validateDocument(docOf([block]))).map((entry) => entry.code);
  assert.ok(errors.includes("media-path-is-url"));
  assert.ok(errors.includes("missing-alt"));
});

/* ── edit ──────────────────────────────────────────────────────────────────── */

test("recipes: เพิ่ม/ลบ/ย้ายเมนู + แก้ข้อความ/ภาพ/คอลัมน์", () => {
  let doc = docOf([createBlock("recipeCards", "b1")]);

  doc = addRecipeItem(doc, "b1");
  doc = addRecipeItem(doc, "b1");
  assert.equal(recipeOf(doc).items.length, 2);

  doc = setRecipeItemText(doc, "b1", 0, "title", "th", "ผัดไทย");
  doc = setRecipeItemText(doc, "b1", 0, "ingredients", "en", "Rice noodles");
  doc = setRecipeItemText(doc, "b1", 0, "steps", "th", "1. แช่เส้น");
  assert.equal(recipeOf(doc).items[0]?.title.th, "ผัดไทย");
  assert.equal(recipeOf(doc).items[0]?.ingredients.en, "Rice noodles");
  assert.equal(recipeOf(doc).items[0]?.steps.th, "1. แช่เส้น");

  doc = setRecipeItemImage(doc, "b1", 0, { path: "/media/1", altTh: "ผัดไทย", altEn: "Pad Thai" });
  assert.equal(recipeOf(doc).items[0]?.image?.path, "/media/1");
  doc = setRecipeItemImage(doc, "b1", 0, { path: "" });
  assert.equal(recipeOf(doc).items[0]?.image, null, "พาธว่าง = เอารูปออก");

  const second = recipeOf(doc).items[1]?.id;
  doc = moveRecipeItem(doc, "b1", 1, 0);
  assert.equal(recipeOf(doc).items[0]?.id, second);

  doc = setRecipeColumns(doc, "b1", 3);
  assert.equal(recipeOf(doc).columns, 3);
  doc = setRecipeColumns(doc, "b1", 9);
  assert.equal(recipeOf(doc).columns, 2, "คอลัมน์ที่ไม่รองรับถูกปรับเป็น 2");

  doc = removeRecipeItem(doc, "b1", 0);
  assert.equal(recipeOf(doc).items.length, 1);
  assert.equal(removeRecipeItem(doc, "b1", 9), doc, "index นอกช่วง = ไม่แตะเอกสาร");
});

test("recipes: เพิ่มเมนูเกินเพดานไม่ได้", () => {
  let doc = docOf([createBlock("recipeCards", "b1")]);
  while (canAddRecipeItem(doc, "b1")) doc = addRecipeItem(doc, "b1");

  assert.equal(recipeOf(doc).items.length, MAX_RECIPE_ITEMS);
  assert.equal(addRecipeItem(doc, "b1"), doc, "เกินเพดาน = ไม่แตะเอกสาร");
});

/* ── ข้อความของตัวเรนเดอร์ ──────────────────────────────────────────────────── */

test("recipes: blockRenderStringsFor ให้ป้ายส่วนผสม/วิธีทำครบสองภาษาและไม่ซ้ำกัน", () => {
  const th = blockRenderStringsFor("th").recipe;
  const en = blockRenderStringsFor("en").recipe;

  for (const strings of [th, en]) {
    assert.ok(strings.detailsLabel.length > 0);
    assert.ok(strings.ingredientsLabel.length > 0);
    assert.ok(strings.stepsLabel.length > 0);
  }
  assert.notEqual(th.detailsLabel, en.detailsLabel);
  assert.notEqual(th.ingredientsLabel, en.ingredientsLabel);
});

/* ── ลิงก์ภายในบล็อกต้องถูกภาษา (รอบที่ 101) ─────────────────────────────────── */

test("href: เติม prefix ภาษาให้พาธภายใน และไม่แตะลิงก์ภายนอก/ข้อมูลที่เติมแล้ว", () => {
  assert.equal(localizedBlockHref("/products", "en"), "/en/products");
  assert.equal(localizedBlockHref("/products/instant-noodles", "en"), localePath("en", "/products/instant-noodles"));
  assert.equal(localizedBlockHref("/", "en"), "/en");
  assert.equal(localizedBlockHref("/about#team", "th"), "/th/about#team");

  /* ข้อมูลเก่าที่บันทึกไว้ก่อนรอบนี้มี prefix แล้ว ⇒ ต้องไม่ซ้ำ */
  assert.equal(localizedBlockHref("/th/products", "en"), "/th/products");
  assert.equal(localizedBlockHref("/en/products", "th"), "/en/products");
  assert.equal(localizedBlockHref("/th", "en"), "/th");

  /* ไม่ใช่เส้นทางภายในเว็บ = คงเดิม */
  assert.equal(localizedBlockHref("", "en"), "");
  assert.equal(localizedBlockHref("#top", "en"), "#top");
  assert.equal(localizedBlockHref("https://waiwai.co.th/x", "en"), "https://waiwai.co.th/x");
  assert.equal(localizedBlockHref("mailto:info@waiwai.co.th", "en"), "mailto:info@waiwai.co.th");
  assert.equal(localizedBlockHref("tel:+6620000000", "en"), "tel:+6620000000");

  /* คำที่ "ขึ้นต้นคล้าย" ภาษาแต่ไม่ใช่ ต้องไม่ถูกมองว่าเติมแล้ว */
  assert.equal(localizedBlockHref("/thai-food", "en"), "/en/thai-food");
  assert.equal(localizedBlockHref("/energy", "en"), "/en/energy");
});

test("href: ตัวเรนเดอร์ใช้ตัวช่วยกลางกับลิงก์การ์ด/ปุ่ม (กันลืมกลับไปใช้ href ดิบ)", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const renderer = readFileSync(path.join(root, "features/blocks/block-renderer.tsx"), "utf8");

  assert.ok(renderer.includes('import { localizedBlockHref } from "@/lib/blocks/href"'), "ต้อง import ตัวช่วยกลาง");
  assert.ok(renderer.includes("href={localizedBlockHref(href, language)}"), "ปุ่ม (actionLink) ต้องเติมภาษา");
  assert.ok(renderer.includes("href={localizedBlockHref(card.href, language)}"), "การ์ดต้องเติมภาษา");
  assert.ok(!renderer.includes("href={card.href}"), "ห้ามเหลือ href ของการ์ดแบบดิบ");
});

/* ── เทมเพลต ───────────────────────────────────────────────────────────────── */

test("recipes: เทมเพลตมีบล็อกเมนูอาหารว่าง (ไม่แต่งเมนูปลอม) และผ่าน parser + validator", () => {
  const template = buildBlockTemplate("recipes");
  assert.ok(template !== null);
  if (template === null) return;

  const block = template.blocks.find((entry) => entry.type === "recipeCards");
  assert.ok(block !== undefined && block.type === "recipeCards", "ต้องมีบล็อก recipeCards");
  assert.equal(block.items.length, 0, "ห้ามแต่งเมนูปลอมขึ้นเอง");
  assert.ok(block.heading.th.trim() !== "", "ต้องมีหัวข้อส่วน (จากพจนานุกรม)");

  const parsed = parseBlockDocument("recipes", JSON.parse(JSON.stringify(template)));
  assert.equal(parsed.ok, true);
  assert.ok(parsed.ok);
  assert.deepEqual(documentErrorsOf(validateDocument(parsed.document)), []);
});

test("templates: ทุก href ในเทมเพลตเป็นพาธกลาง (ห้ามผูกภาษา) — บทเรียนรอบที่ 101", () => {
  for (const page of BLOCK_TEMPLATE_PAGE_IDS) {
    const template = buildBlockTemplate(page);
    assert.ok(template !== null, `${page}: ต้องมีเทมเพลต`);
    if (template === null) continue;

    for (const value of collectStrings(template)) {
      assert.ok(
        !/^\/(th|en)(\/|$)/.test(value),
        `${page}: เทมเพลตเก็บ href ที่ผูกภาษาไว้ (${value}) — ต้องเป็นพาธกลางและให้ตัวเรนเดอร์เติมภาษา`,
      );
    }
  }
});

test("templates: การ์ดสินค้าชี้พาธกลาง /products/<slug> (ไม่ใช่ /th/…)", () => {
  const template = buildBlockTemplate("products");
  assert.ok(template !== null);
  const cards = template?.blocks.find((entry) => entry.type === "cards");
  assert.ok(cards !== undefined && cards.type === "cards");

  const hrefs = cards.items.map((item) => item.href);
  assert.ok(hrefs.length > 0);
  for (const href of hrefs) {
    assert.match(href, /^\/products\/[a-z0-9-]+$/, `href ต้องเป็นพาธกลาง: ${href}`);
  }
});

test("recipes: สารบัญ (sidebar) มองเห็นหัวข้อของบล็อกเมนูอาหาร", () => {
  const block = mutable(createBlock("recipeCards", "b1"));
  assert.ok(block.type === "recipeCards");
  block.heading = { th: "เมนูอาหาร", en: "Recipes" };

  /* ใช้ walkBlocks ยืนยันว่าเป็นบล็อกระดับหน้าและมีหัวข้อ (outline ใช้กติกาเดียวกัน) */
  const nodes = walkBlocks([block]);
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0]?.block.id, "b1");
});
