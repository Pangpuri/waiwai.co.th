import assert from "node:assert/strict";
import { test } from "node:test";

import { blockRenderStringsFor } from "@/features/blocks/render-strings";
import { documentDiff, LAYOUT_DIFF_BLOCK_TYPE } from "@/lib/blocks/diff";
import { insertBlockAt, setBlockText, setPageLayout } from "@/lib/blocks/edit";
import { MAX_OUTLINE_ENTRIES, pageOutline } from "@/lib/blocks/outline";
import { parseBlockDocument } from "@/lib/blocks/parse";
import { buildBlockTemplate, BLOCK_TEMPLATE_PAGE_IDS } from "@/lib/blocks/templates";
import {
  BLOCK_SCHEMA_VERSION,
  DEFAULT_PAGE_LAYOUT,
  DEFAULT_BLOCK_STYLE,
  PAGE_LAYOUTS,
  createBlock,
  layoutOf,
  type Block,
  type BlockDocument,
} from "@/lib/blocks/types";
import { documentWarningsOf, validateDocument } from "@/lib/blocks/validate";

/**
 * เทสต์ X1.8 — เทมเพลตเลย์เอาต์ต่อหน้า (เอกสาร 5.5)
 *
 * "Layout templates selectable per page (full width, with sidebar, landing)" ⇒ เราให้ 3 แบบ
 * จุดที่ต้องคุมเป็นพิเศษ
 * 1. **เอกสารเดิมต้องไม่เปลี่ยนรูป** — ไม่ระบุเลย์เอาต์ = `full` และไม่ใส่ฟิลด์
 * 2. **สารบัญต้องมาจากเนื้อหาจริง** (รวมบล็อกที่ซ้อนในคอลัมน์) ไม่มีข้อมูลซ้ำที่หลุดกันได้
 * 3. **การเปลี่ยนเลย์เอาต์ต้องนับเป็นความต่าง** ไม่งั้นบันทึกอัตโนมัติจะข้ามการเปลี่ยน (บั๊กเงียบ)
 */

function docOf(blocks: readonly Block[]): BlockDocument {
  return { page: "home", blocks };
}

function headingBlock(id: string, th: string, en: string, level: 2 | 3 = 2): Block {
  return {
    id,
    version: BLOCK_SCHEMA_VERSION,
    style: { ...DEFAULT_BLOCK_STYLE },
    type: "heading",
    text: { th, en },
    level,
  };
}

/* ── 1) โมเดล + parse ─────────────────────────────────────────────────────── */

test("layout: มี 3 แบบ และค่าเริ่มต้นคือ full", () => {
  assert.deepEqual([...PAGE_LAYOUTS], ["full", "sidebar", "landing"]);
  assert.equal(DEFAULT_PAGE_LAYOUT, "full");
  assert.equal(layoutOf({ page: "home", blocks: [] }), "full", "ไม่ระบุ = full");
  assert.equal(layoutOf({ page: "home", blocks: [], layout: "sidebar" }), "sidebar");
});

test("layout: parse ไม่ใส่ฟิลด์เมื่อไม่ระบุ หรือเมื่อเป็น full (เอกสารเดิมไม่เปลี่ยนรูป)", () => {
  const withoutField = parseBlockDocument("home", { blocks: [] });
  assert.ok(withoutField.ok);
  assert.equal("layout" in withoutField.document, false);

  const explicitFull = parseBlockDocument("home", { layout: "full", blocks: [] });
  assert.ok(explicitFull.ok);
  assert.equal("layout" in explicitFull.document, false, "full = ค่าเริ่มต้น ⇒ ไม่เก็บฟิลด์");

  const sidebar = parseBlockDocument("home", { layout: "sidebar", blocks: [] });
  assert.ok(sidebar.ok);
  assert.equal(sidebar.document.layout, "sidebar");
});

test("layout: parse ปฏิเสธค่าที่ไม่รู้จัก (ไม่เดา)", () => {
  const outcome = parseBlockDocument("home", { layout: "with-sidebar", blocks: [] });
  assert.equal(outcome.ok, false);
  assert.ok(!outcome.ok);
  assert.ok(outcome.problems.some((problem) => problem.includes("layout")));
});

test("layout: เอกสารที่มีเลย์เอาต์ไปกลับได้เท่าเดิม", () => {
  const doc: BlockDocument = { page: "home", blocks: [headingBlock("block-1", "หัวข้อ", "Heading")], layout: "landing" };
  const outcome = parseBlockDocument("home", JSON.parse(JSON.stringify(doc)));
  assert.ok(outcome.ok);
  assert.deepEqual(outcome.document, doc);
});

/* ── 2) แก้เลย์เอาต์ ───────────────────────────────────────────────────────── */

test("layout: setPageLayout เปลี่ยนค่าได้ · ตั้ง full = ลบฟิลด์ · ค่าเดิม = ไม่แตะเอกสาร", () => {
  const base = docOf([headingBlock("block-1", "หัวข้อ", "Heading")]);

  const sidebar = setPageLayout(base, "sidebar");
  assert.equal(sidebar.layout, "sidebar");
  assert.equal(layoutOf(sidebar), "sidebar");

  const backToFull = setPageLayout(sidebar, "full");
  assert.equal("layout" in backToFull, false, "full = ค่าเริ่มต้น ⇒ ลบฟิลด์ออก");

  assert.equal(setPageLayout(base, "full"), base, "ตั้งค่าเดิม = คืนเอกสารเดิม (ไม่ re-render เปล่า)");
  assert.equal(setPageLayout(sidebar, "sidebar"), sidebar);
});

/* ── 3) สารบัญ (pageOutline) ──────────────────────────────────────────────── */

test("layout: สารบัญเก็บหัวข้อจากบล็อกที่มีหัวข้อ และข้ามบล็อกที่ไม่มี", () => {
  let doc = docOf([
    createBlock("hero", "block-1"),
    headingBlock("block-2", "เรื่องราวของเรา", "Our story"),
    createBlock("divider", "block-3"),
    createBlock("quote", "block-4"),
    createBlock("table", "block-5"),
  ]);
  /* hero ใช้ `title` · ตารางใช้ `heading` — ทั้งคู่ต้องเข้าเป็นหัวข้อในสารบัญ */
  doc = setBlockText(doc, "block-1", "title", "th", "ยินดีต้อนรับ");
  doc = setBlockText(doc, "block-5", "heading", "th", "ตารางโภชนาการ");

  const entries = pageOutline(doc, "th");
  assert.deepEqual(
    entries.map((entry) => entry.id),
    ["block-1", "block-2", "block-5"],
    "hero/heading/table มีหัวข้อ · divider/quote ไม่มี",
  );
  assert.deepEqual(
    entries.map((entry) => entry.label),
    ["ยินดีต้อนรับ", "เรื่องราวของเรา", "ตารางโภชนาการ"],
  );
  assert.ok(entries.every((entry) => entry.label.trim() !== ""), "หัวข้อว่างต้องไม่ถูกใส่ในสารบัญ");
});

test("layout: สารบัญเห็นบล็อกที่ซ้อนในคอลัมน์ของแถวด้วย", () => {
  const inserted = insertBlockAt(docOf([createBlock("row", "row-1")]), "heading", {
    rowId: "row-1",
    columnId: "col-1",
    index: 0,
  });
  assert.ok(inserted.blockId !== null);

  const doc = setBlockText(inserted.document, inserted.blockId, "text", "th", "หัวข้อในคอลัมน์");
  const entries = pageOutline(doc, "th");
  assert.deepEqual(
    entries.map((entry) => entry.id),
    [inserted.blockId],
  );
  assert.equal(entries[0]?.label, "หัวข้อในคอลัมน์");
});

test("layout: ระดับของสารบัญ — heading ระดับ 3 เป็นหัวข้อย่อย", () => {
  const doc = docOf([
    headingBlock("block-1", "หลัก", "Main", 2),
    headingBlock("block-2", "ย่อย", "Sub", 3),
  ]);
  assert.deepEqual(
    pageOutline(doc, "th").map((entry) => entry.level),
    [1, 2],
  );
});

test("layout: สารบัญใช้คำแปลตามภาษา และถอยไปใช้ไทยเมื่อยังไม่มี EN", () => {
  const doc = docOf([headingBlock("block-1", "หัวข้อไทย", ""), headingBlock("block-2", "ไทยสอง", "English two")]);

  assert.deepEqual(
    pageOutline(doc, "en").map((entry) => entry.label),
    ["หัวข้อไทย", "English two"],
    "ยังไม่มี EN ⇒ ใช้ไทย (เหมือนตัวเรนเดอร์)",
  );
  assert.equal(pageOutline(doc, "th")[1]?.label, "ไทยสอง");
});

test("layout: สารบัญไม่เกินเพดานที่ประกาศไว้", () => {
  const blocks = Array.from({ length: MAX_OUTLINE_ENTRIES + 5 }, (_unused, index) =>
    headingBlock(`block-${index + 1}`, `หัวข้อ ${index + 1}`, `Heading ${index + 1}`),
  );
  assert.equal(pageOutline(docOf(blocks), "th").length, MAX_OUTLINE_ENTRIES);
});

/* ── 4) ความต่าง/การบันทึกอัตโนมัติ ────────────────────────────────────────── */

test("layout: เปลี่ยนเลย์เอาต์ต้องนับเป็นความต่าง (ไม่งั้น autosave จะข้าม)", () => {
  const base = docOf([headingBlock("block-1", "หัวข้อ", "Heading")]);
  const sidebar = setPageLayout(base, "sidebar");

  const diff = documentDiff(base, sidebar);
  assert.equal(diff.identical, false, "ต้องไม่ถือว่าเหมือนกัน");
  assert.equal(diff.summary.total, 1);
  assert.equal(diff.entries[0]?.blockType, LAYOUT_DIFF_BLOCK_TYPE);
  assert.deepEqual(diff.entries[0]?.fields, [{ path: "layout", before: "full", after: "sidebar" }]);

  /* ไม่เปลี่ยนอะไร = ยังเหมือนเดิมเป๊ะ (ไม่สร้างความต่างหลอก) */
  const noChange = documentDiff(base, docOf([headingBlock("block-1", "หัวข้อ", "Heading")]));
  assert.equal(noChange.identical, true);
  assert.equal(noChange.summary.total, 0);
});

/* ── 5) ด่านตรวจ ─────────────────────────────────────────────────────────── */

test("layout: sidebar ที่มีหัวข้อน้อยกว่า 2 = เตือน (ไม่บล็อกการเผยแพร่)", () => {
  const few = { ...docOf([headingBlock("block-1", "หัวข้อเดียว", "Only one")]), layout: "sidebar" as const };
  const warnings = documentWarningsOf(validateDocument(few)).map((entry) => entry.code);
  assert.ok(warnings.includes("layout-sidebar-few-headings"));

  const enough = {
    ...docOf([headingBlock("block-1", "หนึ่ง", "One"), headingBlock("block-2", "สอง", "Two")]),
    layout: "sidebar" as const,
  };
  assert.ok(!documentWarningsOf(validateDocument(enough)).some((entry) => entry.code === "layout-sidebar-few-headings"));

  /* เลย์เอาต์อื่นไม่ต้องมีหัวข้อเลยก็ไม่เตือน */
  const fullNoHeadings = docOf([createBlock("divider", "block-1")]);
  assert.ok(!documentWarningsOf(validateDocument(fullNoHeadings)).some((entry) => entry.code.startsWith("layout-")));
});

/* ── 6) เทมเพลต + ข้อความ ─────────────────────────────────────────────────── */

test("layout: เทมเพลตทุกหน้ามีเลย์เอาต์เริ่มต้นเป็น full (ไม่ตั้งค่ามั่วไว้)", () => {
  for (const page of BLOCK_TEMPLATE_PAGE_IDS) {
    const template = buildBlockTemplate(page);
    assert.ok(template !== null);
    assert.equal(template.layout, undefined, `${page}: เทมเพลตต้องไม่ตั้งเลย์เอาต์`);
  }
});

test("layout: blockRenderStringsFor มีป้ายสารบัญครบสองภาษา", () => {
  const th = blockRenderStringsFor("th");
  const en = blockRenderStringsFor("en");
  assert.ok(th.layout.tocLabel.length > 0);
  assert.ok(en.layout.tocLabel.length > 0);
  assert.notEqual(th.layout.tocLabel, en.layout.tocLabel);
});
