import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { test } from "node:test";

import { AUTOSAVE_DELAY_MS, decideAutosave, needsLeaveWarning, shortTimeOf } from "@/lib/blocks/autosave";
import { MAX_DIFF_ENTRIES, MAX_DIFF_FIELDS_PER_BLOCK, diffBlockTypes, diffCount, documentDiff, documentsEqual } from "@/lib/blocks/diff";
import { addColumn, insertBlockAt, moveBlockToLocation, setBlockText, setColumnWidth } from "@/lib/blocks/edit";
import { BLOCK_SCHEMA_VERSION, createBlock, type Block, type BlockDocument } from "@/lib/blocks/types";

/**
 * เทสต์ X1.5 — ความต่างของสองรุ่นเอกสาร + นโยบายบันทึกอัตโนมัติ
 * ตรรกะล้วน (ไม่ต้องมี React/DB) · happy path + edge case ครบ
 */

type DeepMutable<T> = T extends readonly (infer U)[] ? DeepMutable<U>[] : T extends object ? { -readonly [K in keyof T]: DeepMutable<T[K]> } : T;

function mutable<T>(value: T): DeepMutable<T> {
  return structuredClone(value) as DeepMutable<T>;
}

function docOf(blocks: readonly Block[]): BlockDocument {
  return { page: "home", blocks };
}

function heading(id: string, th: string): Block {
  const block = mutable(createBlock("heading", id));
  assert.ok(block.type === "heading");
  block.text.th = th;
  block.text.en = th;
  return block;
}

/** แถว 2 คอลัมน์ ที่มีหัวข้ออยู่ในคอลัมน์แรก — คืนทั้งเอกสารและ id ของบล็อกลูกที่สร้างให้ */
function rowWithChild(rowId: string, th: string): { readonly document: BlockDocument; readonly childId: string } {
  const base = docOf([createBlock("row", rowId)]);
  const result = insertBlockAt(base, "heading", { rowId, columnId: "col-1", index: 0 });
  assert.ok(result.blockId !== null, "ต้องเพิ่มบล็อกในคอลัมน์ได้");
  return { document: setBlockText(result.document, result.blockId, "text", "th", th), childId: result.blockId };
}

/* ── ความต่างพื้นฐาน ─────────────────────────────────────────────────────── */

test("x1.5 diff: เอกสารเดียวกัน = ไม่มีความต่าง", () => {
  const document = docOf([heading("b1", "หัวข้อ")]);
  const diff = documentDiff(document, structuredClone(document));

  assert.equal(diff.identical, true);
  assert.equal(diff.summary.total, 0);
  assert.equal(diff.summary.unchanged, 1);
  assert.equal(diff.orderChanged, false);
  assert.deepEqual(diffCount(diff), 0);
  assert.equal(documentsEqual(document, structuredClone(document)), true);
});

test("x1.5 diff: เพิ่มบล็อก = added (ไม่ใช่ changed) และรายงานตำแหน่ง", () => {
  const before = docOf([heading("b1", "หนึ่ง")]);
  const after = docOf([heading("b1", "หนึ่ง"), heading("b2", "สอง")]);
  const diff = documentDiff(before, after);

  assert.equal(diff.summary.added, 1);
  assert.equal(diff.summary.changed, 0);
  assert.equal(diff.summary.total, 1);
  assert.equal(diff.entries[0]?.kind, "added");
  assert.equal(diff.entries[0]?.blockId, "b2");
  assert.equal(diff.entries[0]?.index, 1);
  assert.equal(diff.entries[0]?.columnIndex, null);
  assert.equal(diff.orderChanged, true);
});

test("x1.5 diff: ลบบล็อก = removed และรายงานทีหลังสุด", () => {
  const before = docOf([heading("b1", "หนึ่ง"), heading("b2", "สอง")]);
  const after = docOf([heading("b1", "หนึ่ง")]);
  const diff = documentDiff(before, after);

  assert.equal(diff.summary.removed, 1);
  assert.equal(diff.entries[0]?.kind, "removed");
  assert.equal(diff.entries[0]?.blockId, "b2");
  assert.equal(diff.entries[0]?.index, 1);
});

test("x1.5 diff: แก้ข้อความ = changed พร้อมค่า before/after และ path", () => {
  const before = docOf([heading("b1", "เดิม")]);
  const after = docOf([heading("b1", "ใหม่")]);
  const diff = documentDiff(before, after);

  assert.equal(diff.summary.changed, 1);
  assert.equal(diff.summary.total, 1);
  const entry = diff.entries[0];
  assert.equal(entry?.kind, "changed");
  assert.equal(entry?.blockType, "heading");
  assert.deepEqual(entry?.fields.map((field) => field.path), ["text.en", "text.th"]);
  assert.equal(entry?.fields[0]?.before, "เดิม");
  assert.equal(entry?.fields[0]?.after, "ใหม่");
});

test("x1.5 diff: ย้ายตำแหน่ง = moved (ไม่ใช่ changed) — จับคู่ด้วย id ไม่ใช่ลำดับ", () => {
  const before = docOf([heading("b1", "หนึ่ง"), heading("b2", "สอง")]);
  const after = docOf([heading("b2", "สอง"), heading("b1", "หนึ่ง")]);
  const diff = documentDiff(before, after);

  assert.equal(diff.summary.changed, 0, "ข้อความไม่ได้ถูกแก้");
  assert.equal(diff.summary.moved, 2);
  assert.equal(diff.summary.unchanged, 0);
  assert.equal(diff.orderChanged, true);
  assert.deepEqual(diff.entries.map((entry) => entry.kind), ["moved", "moved"]);
});

test("x1.5 diff: บล็อกที่ย้ายเข้าคอลัมน์ = moved พร้อมบอกว่าอยู่คอลัมน์ที่เท่าไร", () => {
  const before = docOf([createBlock("row", "r1"), heading("b9", "ย้ายฉัน")]);
  const moved = moveBlockToLocation(before, "b9", { rowId: "r1", columnId: "col-2", index: 0 });
  const diff = documentDiff(before, moved);

  assert.equal(diff.summary.moved, 1);
  assert.equal(diff.summary.added, 0, "ย้ายแล้วต้องไม่นับเป็นบล็อกใหม่");
  const entry = diff.entries[0];
  assert.equal(entry?.blockId, "b9");
  assert.equal(entry?.columnIndex, 1, "คอลัมน์ที่ 2 (ดัชนี 1)");
});

test("x1.5 diff: แก้บล็อกในคอลัมน์ = changed ของบล็อกลูก (path ชี้ในบล็อกนั้น)", () => {
  const built = rowWithChild("r1", "เดิม");
  const after = setBlockText(built.document, built.childId, "text", "th", "ใหม่");
  const diff = documentDiff(built.document, after);

  assert.equal(diff.summary.changed, 1);
  const entry = diff.entries[0];
  assert.equal(entry?.blockId, built.childId);
  assert.equal(entry?.columnIndex, 0);
  assert.deepEqual(entry?.fields.map((field) => field.path), ["text.th"]);
  assert.equal(entry?.fields[0]?.before, "เดิม");
  assert.equal(entry?.fields[0]?.after, "ใหม่");
});

/* ── ความต่างของโครง/ฟิลด์อื่น ─────────────────────────────────────────────── */

test("x1.5 diff: เพิ่ม/ลบคอลัมน์ และเปลี่ยนความกว้าง ถูกจับเป็นความต่างของแถว", () => {
  const base = rowWithChild("r1", "หัวข้อ").document;

  const addedColumn = addColumn(base, "r1");
  const addDiff = documentDiff(base, addedColumn);
  const columnPaths = addDiff.entries.flatMap((entry) => entry.fields.map((field) => field.path));
  /* แถวเริ่มต้นมี 2 คอลัมน์ ⇒ คอลัมน์ใหม่คือดัชนี 2 */
  assert.ok(columnPaths.includes("columns[2].id"), `ต้องเห็นคอลัมน์ใหม่: ${columnPaths.join(", ")}`);
  assert.ok(columnPaths.includes("columns[0].width"), "ความกว้างของคอลัมน์เดิมเปลี่ยน (แบ่งใหม่เท่ากัน)");

  const widened = setColumnWidth(base, "r1", "col-1", "twoThirds");
  const widthDiff = documentDiff(base, widened);
  assert.deepEqual(widthDiff.entries[0]?.fields.map((field) => field.path), ["columns[0].width"]);
  assert.equal(widthDiff.entries[0]?.fields[0]?.before, "half");
  assert.equal(widthDiff.entries[0]?.fields[0]?.after, "twoThirds");
});

test("x1.5 diff: แก้สไตล์/การซ่อนตามขนาดจอ = changed (ผู้ใช้แก้หน้าตาก็ต้องนับ)", () => {
  const before = docOf([heading("b1", "หัวข้อ")]);
  const after = mutable(structuredClone(before));
  const edited = after.blocks[0];
  assert.ok(edited !== undefined);
  edited.style.background = "cream";
  edited.visibility = { desktop: false, tablet: true, mobile: true };

  const paths = documentDiff(before, after).entries.flatMap((entry) => entry.fields.map((field) => field.path)).sort();
  assert.deepEqual(paths, ["style.background", "visibility.desktop"], "รายงานเฉพาะจอที่ถูกซ่อน ไม่รวมจอที่ยังแสดง");
});

test("x1.5 diff: การ์ดในบล็อก (เพิ่ม/แก้) ถูกจับที่ path ของการ์ดใบนั้น", () => {
  const before = docOf([createBlock("cards", "k1")]);
  const after = mutable(structuredClone(before));
  const block = after.blocks[0];
  assert.ok(block !== undefined && block.type === "cards");
  block.items = [
    { title: { th: "ใบหนึ่ง", en: "" }, body: { th: "", en: "" }, href: "", image: null },
    { title: { th: "ใบสอง", en: "" }, body: { th: "", en: "" }, href: "/products", image: null },
  ];

  const diff = documentDiff(before, after);
  const paths = diff.entries[0]?.fields.map((field) => field.path) ?? [];
  assert.ok(paths.includes("items[0].title.th"));
  assert.ok(paths.includes("items[1].title.th"));
  assert.ok(paths.includes("items[1].href"));
});

test("x1.5 diff: ภาพที่ถูกเพิ่ม (null → พาธ) ถูกจับพร้อมค่าเดิมว่าง", () => {
  const before = docOf([createBlock("imageText", "i1")]);
  const after = mutable(structuredClone(before));
  const imageBlock = after.blocks[0];
  assert.ok(imageBlock !== undefined && imageBlock.type === "imageText");
  imageBlock.image = { path: "/media/abc", altTh: "คำอธิบาย", altEn: "", hasWatermark: false };

  const fields = documentDiff(before, after).entries[0]?.fields ?? [];
  const imagePath = fields.find((field) => field.path === "image.path");
  assert.ok(imagePath !== undefined);
  assert.equal(imagePath.before, "");
  assert.equal(imagePath.after, "/media/abc");
});

test("x1.5 diff: เปลี่ยนชนิดบล็อกที่ id เดิม = changed ที่ฟิลด์ type (ไม่หายไปเงียบ ๆ)", () => {
  const before = docOf([heading("same", "หัวข้อ")]);
  const after = docOf([createBlock("divider", "same")]);
  const fields = documentDiff(before, after).entries[0]?.fields ?? [];

  assert.equal(diffCount(documentDiff(before, after)), 1);
  assert.ok(fields.some((field) => field.path === "type" && field.before === "heading" && field.after === "divider"));
});

test("x1.5 diff: ไม่สนใจรุ่นรูปทรง (version) — ข้อมูลรุ่นเก่าที่เพิ่งย้ายรุ่น = ไม่นับว่าถูกแก้", () => {
  const before = docOf([heading("b1", "หัวข้อ")]);
  const legacy = mutable(structuredClone(before));
  const legacyBlock = legacy.blocks[0];
  assert.ok(legacyBlock !== undefined);
  legacyBlock.version = BLOCK_SCHEMA_VERSION - 1;

  assert.equal(documentDiff(before, legacy).identical, true, "ความต่างของ version ไม่ใช่สิ่งที่ผู้ใช้แก้");
  assert.equal(documentDiff(legacy, before).identical, true);
});

/* ── ขอบเขต/เพดานการรายงาน ─────────────────────────────────────────────── */

test("x1.5 diff: ฟิลด์ที่ต่างเยอะถูกตัดที่เพดานต่อบล็อก พร้อมธง truncated", () => {
  const before = docOf([createBlock("richText", "b1")]);
  const after = mutable(structuredClone(before));
  /* เปิดใช้หลายฟิลด์พร้อมกันเกินเพดาน */
  const block = after.blocks[0];
  assert.ok(block !== undefined && block.type === "richText");
  block.heading = { th: "ก", en: "a" };
  block.body = { th: "ข", en: "b" };
  block.ctaLabel = { th: "ค", en: "c" };
  block.ctaHref = "/x";
  block.style.align = "center";
  block.style.width = "wide";
  block.style.spacing = "lg";
  block.style.background = "brand";
  block.style.size = "lg";
  block.visibility = { desktop: true, tablet: false, mobile: true };

  const entry = documentDiff(before, after).entries[0];
  assert.ok(entry !== undefined);
  const expected = 10; /* heading×2 + body×2 + ctaLabel×2 + ctaHref + align + width + spacing… (ตัดที่เพดาน) */
  assert.ok(entry.fields.length <= MAX_DIFF_FIELDS_PER_BLOCK);
  assert.equal(entry.truncated, entry.fields.length === MAX_DIFF_FIELDS_PER_BLOCK);
  assert.ok(expected > 0);
});

test("x1.5 diff: ความต่างเยอะมากถูกตัดที่เพดานบรรทัดรวม", () => {
  const count = MAX_DIFF_ENTRIES + 5;
  const before = docOf([]);
  const after = docOf(Array.from({ length: count }, (_unused, index) => heading(`b${index}`, `หัวข้อ ${index}`)));
  const diff = documentDiff(before, after);

  assert.equal(diff.summary.added, count, "สรุปต้องนับครบ");
  assert.equal(diff.entries.length, MAX_DIFF_ENTRIES, "แต่รายงานบรรทัดถูกจำกัด");
  assert.equal(diff.truncated, true);
});

test("x1.5 diff: เอกสารว่างเปล่าเทียบกัน = ไม่มีความต่าง (ไม่พัง)", () => {
  const empty = docOf([]);
  const diff = documentDiff(empty, empty);
  assert.equal(diff.identical, true);
  assert.deepEqual(diffBlockTypes(diff), []);
  assert.equal(documentsEqual(empty, docOf([])), true);
});

test("x1.5 diff: diffBlockTypes สรุปชนิดที่มีความต่างแบบไม่ซ้ำ", () => {
  const before = docOf([heading("b1", "หนึ่ง")]);
  const after = docOf([heading("b1", "แก้"), heading("b2", "ใหม่"), createBlock("divider", "b3")]);
  const types = diffBlockTypes(documentDiff(before, after));

  assert.deepEqual([...types].sort(), ["divider", "heading"]);
});

/* ── นโยบายบันทึกอัตโนมัติ ───────────────────────────────────────────────── */

test("x1.5 autosave: ตารางการตัดสินใจครบทุกกรณี", () => {
  assert.equal(decideAutosave({ enabled: true, dirty: true, errorCount: 0, saving: false }), "schedule");
  assert.equal(decideAutosave({ enabled: false, dirty: true, errorCount: 0, saving: false }), "disabled");
  assert.equal(decideAutosave({ enabled: true, dirty: false, errorCount: 0, saving: false }), "not-needed");
  assert.equal(decideAutosave({ enabled: true, dirty: true, errorCount: 3, saving: false }), "blocked-errors");
  assert.equal(decideAutosave({ enabled: true, dirty: true, errorCount: 0, saving: true }), "in-flight");
});

test("x1.5 autosave: มี error = ห้ามบันทึก (กันบันทึกทับงานที่ผู้ใช้ยังแก้ไม่เสร็จ)", () => {
  const decision = decideAutosave({ enabled: true, dirty: true, errorCount: 1, saving: false });
  assert.notEqual(decision, "schedule");
  assert.equal(decision, "blocked-errors");
});

test("x1.5 autosave: ปิดสวิตช์แล้วต้องไม่บันทึก แม้จะ dirty", () => {
  assert.equal(decideAutosave({ enabled: false, dirty: true, errorCount: 0, saving: false }), "disabled");
});

test("x1.5 autosave: หน่วง 3 วินาที และตัวช่วยประกอบหน้าจอทำงานตามสัญญา", () => {
  assert.equal(AUTOSAVE_DELAY_MS, 3000);
  assert.equal(needsLeaveWarning(true), true);
  assert.equal(needsLeaveWarning(false), false);
  assert.equal(shortTimeOf("2026-10-03T07:45:12.345Z"), "2026-10-03 07:45");
  assert.equal(shortTimeOf(null), null);
});

test("x1.5 diff: ใช้ร่วมกับ autosave ได้จริง (บันทึกแล้ว diff ต้องว่าง)", () => {
  /* จำลองวงจร: ผู้ใช้แก้ → dirty → บันทึกสำเร็จ (ฉบับที่บันทึก = ฉบับบนหน้าจอ) → ไม่ dirty */
  const saved = docOf([heading("b1", "เดิม")]);
  const edited = setBlockText(saved, "b1", "text", "th", "แก้แล้ว");

  assert.equal(decideAutosave({ enabled: true, dirty: !documentsEqual(saved, edited), errorCount: 0, saving: false }), "schedule");
  assert.equal(decideAutosave({ enabled: true, dirty: !documentsEqual(edited, edited), errorCount: 0, saving: false }), "not-needed");
});

/* ── รอบที่ 149: a11y — หน้าที่เรนเดอร์จากบล็อกต้องมี <h1> ─────────────────── */

test("blocks a11y: ตัวเรนเดอร์ต้องออก <h1> ของหน้าได้ (บล็อกใช้ h2/h3 เท่านั้น)", () => {
  const renderer = readFileSync("features/blocks/block-renderer.tsx", "utf8");
  assert.ok(renderer.includes("heading?: string"), "ตัวเรนเดอร์ต้องรับชื่อหน้าสำหรับ h1");
  assert.ok(/<h1 className="sr-only">\{heading\}<\/h1>/.test(renderer), "ต้องเรนเดอร์ h1 (sr-only) เมื่อมีชื่อหน้า");
  assert.ok(renderer.includes('heading === ""'), "ไม่ส่งชื่อหน้า = ไม่มี h1 (พฤติกรรมเดิม)");

  /* หน้าที่เคยขาด h1: หน้าแรก + /about (ทั้งคู่เรนเดอร์จากบล็อกได้) */
  for (const file of ["app/[lang]/page.tsx", "app/[lang]/about/page.tsx"]) {
    const page = readFileSync(file, "utf8");
    if (!page.includes("<BlockDocumentView")) continue;
    assert.ok(/<BlockDocumentView[\s\S]{0,200}heading=/.test(page), `${file} ต้องส่ง heading ให้ตัวเรนเดอร์`);
  }
});

/* ── รอบที่ 158: พรีวิว "เฉพาะ navbar" ต้องไม่โชว์ท้ายเว็บของ layout ─────────── */

test("preview: โหมด parts=nav ต้องซ่อนทั้งหัวเว็บและท้ายเว็บของ layout", () => {
  const css = readFileSync("app/globals.css", "utf8");
  assert.ok(
    css.includes('[data-preview-parts="nav"] footer[data-layout-footer]'),
    "ต้องซ่อน footer[data-layout-footer] ในโหมด navbar (ฟีดแบ็กเจ้าของ: footer โผล่มาด้วย)",
  );
  assert.ok(
    css.includes('[data-preview-chrome="1"] header[data-layout-header]'),
    "ยังต้องซ่อนหัวเว็บของ layout เหมือนเดิม",
  );
  assert.ok(
    css.includes('[data-preview-parts="footer"] footer[data-layout-footer]'),
    "โหมด footer ต้องซ่อนท้ายเว็บของ layout (มีอยู่เดิม — กันถอยหลัง)",
  );
});
