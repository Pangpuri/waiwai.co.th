import assert from "node:assert/strict";
import { test } from "node:test";

import { blockRenderStringsFor } from "@/features/blocks/render-strings";
import {
  addGalleryItem,
  addTableColumn,
  addTableRow,
  canAddTableColumn,
  canRemoveTableColumn,
  removeGalleryItem,
  removeTableColumn,
  setGalleryItemCaption,
  setGalleryItemImage,
  setTableCellText,
} from "@/lib/blocks/edit";
import { FORM_KINDS } from "@/lib/forms/model";
import { parseBlockDocument } from "@/lib/blocks/parse";
import {
  BLOCK_TYPES,
  FORM_BLOCK_KINDS,
  MAX_TABLE_COLUMNS,
  MAX_TABLE_ROWS,
  createBlock,
  type Block,
  type BlockDocument,
  type GalleryBlock,
  type TableBlock,
} from "@/lib/blocks/types";
import { documentErrorsOf, documentWarningsOf, validateDocument } from "@/lib/blocks/validate";

/**
 * เทสต์ของ "ชนิดบล็อกใหม่ 4 ชนิด" (รอบที่ 86) — ตาราง · แผนที่ · ฟอร์ม · แกลเลอรี
 *
 * ตรรกะล้วน (ไม่ต้องมี DB/React): parse (ไม่เชื่อข้อมูล) · validate · edit · ข้อความของตัวเรนเดอร์
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
  return { page: "home", blocks };
}

const NEW_TYPES = ["table", "map", "form", "gallery"] as const;

test("block-types: แคตตาล็อกและ BLOCK_TYPES มีครบทั้ง 4 ชนิดใหม่", () => {
  for (const type of NEW_TYPES) {
    assert.ok((BLOCK_TYPES as readonly string[]).includes(type), `ขาดชนิด ${type}`);
  }
});

test("block-types: createBlock สร้างค่าเริ่มต้นที่พร้อมแก้", () => {
  const table = createBlock("table", "t1");
  assert.ok(table.type === "table");
  assert.equal(table.columns.length, 2);
  assert.equal(table.rows.length, 1, "เริ่มด้วย 1 แถว");
  assert.equal(table.rows[0]?.cells.length, 2, "จำนวนช่องเท่าหัวคอลัมน์");
  assert.equal(table.firstColumnHeader, false);

  const map = createBlock("map", "m1");
  assert.ok(map.type === "map");
  assert.equal(map.image, null);

  const form = createBlock("form", "f1");
  assert.ok(form.type === "form");
  assert.equal(form.kind, "contact", "ค่าเริ่มต้น = ฟอร์มติดต่อ");

  const gallery = createBlock("gallery", "g1");
  assert.ok(gallery.type === "gallery");
  assert.equal(gallery.items.length, 0);
  assert.equal(gallery.columns, 3);

  /* สไตล์เริ่มต้นของตาราง/แกลเลอรี = กว้าง (อ่านง่ายกว่า) */
  assert.equal(createBlock("table", "t2").style.width, "wide");
  assert.equal(createBlock("gallery", "g2").style.width, "wide");
});

test("block-types: ชนิดฟอร์มของบล็อกอ้างทะเบียนกลาง (ไม่พิมพ์ซ้ำ)", () => {
  assert.deepEqual([...FORM_BLOCK_KINDS], [...FORM_KINDS]);
});

test("block-types: parse เอกสารที่มีบล็อกใหม่ทั้ง 4 ชนิด ไปกลับได้เท่าเดิม", () => {
  const doc = docOf([createBlock("table", "b1"), createBlock("map", "b2"), createBlock("form", "b3"), createBlock("gallery", "b4")]);
  const outcome = parseBlockDocument("home", JSON.parse(JSON.stringify(doc)));

  assert.equal(outcome.ok, true);
  assert.ok(outcome.ok);
  assert.deepEqual(outcome.document, doc);
});

test("block-types: parse จัดจำนวนช่องของตารางให้เท่าหัวคอลัมน์เสมอ", () => {
  const raw = {
    blocks: [
      {
        id: "b1",
        type: "table",
        style: {},
        columns: [{ th: "ชื่อ", en: "Name" }, { th: "จำนวน", en: "Qty" }],
        rows: [
          { id: "r1", cells: [{ th: "ก", en: "A" }, { th: "1", en: "1" }, { th: "เกิน", en: "extra" }] },
          { id: "r2", cells: [{ th: "ข", en: "B" }] },
        ],
      },
    ],
  };

  const outcome = parseBlockDocument("home", raw);
  assert.equal(outcome.ok, true);
  assert.ok(outcome.ok);
  const block = outcome.document.blocks[0];
  assert.ok(block !== undefined && block.type === "table");
  assert.equal(block.rows[0]?.cells.length, 2, "ช่องเกินถูกตัด");
  assert.equal(block.rows[1]?.cells.length, 2, "ช่องขาดถูกเติมให้ว่าง");
  assert.equal(block.rows[1]?.cells[1]?.th, "");
});

test("block-types: parse เก็บภาพในแกลเลอรีที่ยังไม่เลือกไฟล์ไว้ (validator เตือนเอง)", () => {
  const raw = {
    blocks: [{ id: "b1", type: "gallery", style: {}, items: [{ id: "i1", image: null, caption: { th: "", en: "" } }] }],
  };

  const outcome = parseBlockDocument("home", raw);
  assert.equal(outcome.ok, true);
  assert.ok(outcome.ok);
  const block = outcome.document.blocks[0];
  assert.ok(block !== undefined && block.type === "gallery");
  assert.equal(block.items.length, 1);
  assert.equal(block.items[0]?.image, null);
});

test("block-types: parse ปฏิเสธชนิดฟอร์มที่ระบบไม่รู้จัก (ไม่เดา)", () => {
  const outcome = parseBlockDocument("home", {
    blocks: [{ id: "b1", type: "form", style: {}, kind: "survey", heading: { th: "", en: "" }, body: { th: "", en: "" } }],
  });

  assert.equal(outcome.ok, false);
  assert.ok(!outcome.ok);
  assert.ok(outcome.problems.some((problem) => problem.includes("kind")));
});

test("block-types: parse ของแท้ต้องไม่แตะชนิดเดิม (regression)", () => {
  /* เอกสารชนิดเดิมล้วน — ต้องยัง parse ผ่าน (การเพิ่มชนิดใหม่ต้องไม่ทำให้ของเดิมพัง) */
  const doc = docOf([createBlock("heading", "b1"), createBlock("divider", "b2")]);
  const outcome = parseBlockDocument("home", JSON.parse(JSON.stringify(doc)));
  assert.equal(outcome.ok, true);
});

/* ── validate ─────────────────────────────────────────────────────────────── */

test("block-types: validate จับตารางที่ไม่มีคอลัมน์ (error) และเตือนตารางว่าง", () => {
  const table = mutable(createBlock("table", "t1"));
  assert.ok(table.type === "table");
  table.columns = [];
  table.rows = [];

  const issues = validateDocument(docOf([table]));
  const errors = documentErrorsOf(issues).map((entry) => entry.code);
  const warnings = documentWarningsOf(issues).map((entry) => entry.code);

  assert.ok(errors.includes("table-without-columns"));
  assert.ok(warnings.includes("table-empty"));
});

test("block-types: validate บังคับหัวคอลัมน์และเตือนเมื่อยังไม่มี EN", () => {
  const table = mutable(createBlock("table", "t1"));
  assert.ok(table.type === "table");
  table.columns = [{ th: "ชื่อ", en: "Name" }, { th: "", en: "" }];

  const issues = validateDocument(docOf([table]));
  const errors = documentErrorsOf(issues).map((entry) => entry.code);
  assert.ok(errors.includes("empty-th"), "หัวคอลัมน์ไทยว่าง = error");

  const table2 = mutable(createBlock("table", "t2"));
  assert.ok(table2.type === "table");
  table2.columns = [{ th: "ชื่อ", en: "" }, { th: "จำนวน", en: "Qty" }];
  const warnings = documentWarningsOf(validateDocument(docOf([table2]))).map((entry) => entry.code);
  assert.ok(warnings.includes("missing-en"), "ยังไม่มี EN = คำเตือน");
});

test("block-types: validate แผนที่ — ลิงก์อันตรายเป็น error · ไม่มีภาพเป็นคำเตือน", () => {
  const map = mutable(createBlock("map", "m1"));
  assert.ok(map.type === "map");
  map.linkHref = "javascript:alert(1)";
  map.image = null;

  const issues = validateDocument(docOf([map]));
  const errors = documentErrorsOf(issues).map((entry) => entry.code);
  const warnings = documentWarningsOf(issues).map((entry) => entry.code);

  assert.ok(errors.includes("bad-href"));
  assert.ok(warnings.includes("map-without-image"));
});

test("block-types: validate แผนที่ — มีลิงก์แต่ไม่มีข้อความบนปุ่ม = คำเตือน", () => {
  const map = mutable(createBlock("map", "m1"));
  assert.ok(map.type === "map");
  map.linkHref = "https://maps.google.com/";
  map.linkLabel = { th: "", en: "" };

  const warnings = documentWarningsOf(validateDocument(docOf([map]))).map((entry) => entry.code);
  assert.ok(warnings.includes("map-link-without-label"));
});

test("block-types: validate แกลเลอรี — ว่าง/ใบที่ยังไม่เลือกภาพ เป็นคำเตือน", () => {
  const empty = createBlock("gallery", "g1");
  assert.ok(documentWarningsOf(validateDocument(docOf([empty]))).some((entry) => entry.code === "gallery-empty"));

  const gallery = mutable(createBlock("gallery", "g2"));
  assert.ok(gallery.type === "gallery");
  gallery.items = [{ id: "i1", image: null, caption: { th: "", en: "" } }];
  const warnings = documentWarningsOf(validateDocument(docOf([gallery]))).map((entry) => entry.code);
  assert.ok(warnings.includes("gallery-item-without-image"));
});

test("block-types: validate ภาพในแกลเลอรีต้องมีพาธในโปรเจกต์ + ต้องมี alt", () => {
  const gallery = mutable(createBlock("gallery", "g1"));
  assert.ok(gallery.type === "gallery");
  gallery.items = [
    { id: "i1", image: { path: "https://example.com/a.jpg", altTh: "", altEn: "", hasWatermark: false }, caption: { th: "", en: "" } },
  ];

  const errors = documentErrorsOf(validateDocument(docOf([gallery]))).map((entry) => entry.code);
  assert.ok(errors.includes("media-path-is-url"));
  assert.ok(errors.includes("missing-alt"));
});

/* ── edit ─────────────────────────────────────────────────────────────────── */

test("block-types: ตาราง — เพิ่ม/ลบคอลัมน์แล้วจำนวนช่องของทุกแถวตรงกันเสมอ", () => {
  let doc = docOf([createBlock("table", "t1")]);
  const tableOf = (value: BlockDocument): TableBlock => {
    const block = value.blocks[0];
    assert.ok(block !== undefined && block.type === "table");
    return block;
  };

  doc = addTableColumn(doc, "t1");
  assert.deepEqual(tableOf(doc).columns.length, 3);
  assert.deepEqual(tableOf(doc).rows.map((row) => row.cells.length), [3]);

  doc = addTableRow(doc, "t1");
  assert.deepEqual(tableOf(doc).rows.map((row) => row.cells.length), [3, 3]);

  doc = removeTableColumn(doc, "t1", 1);
  assert.deepEqual(tableOf(doc).columns.length, 2);
  assert.deepEqual(tableOf(doc).rows.map((row) => row.cells.length), [2, 2]);

  doc = setTableCellText(doc, "t1", 1, 1, "th", "ค่าใหม่");
  assert.equal(tableOf(doc).rows[1]?.cells[1]?.th, "ค่าใหม่");
});

test("block-types: ตาราง — ลบคอลัมน์สุดท้ายไม่ได้ และเพิ่มเกินเพดานไม่ได้", () => {
  let doc = docOf([createBlock("table", "t1")]);
  assert.equal(canRemoveTableColumn(doc, "t1"), true, "เริ่มด้วย 2 คอลัมน์ ⇒ ลบได้");

  doc = removeTableColumn(doc, "t1", 0);
  const block = doc.blocks[0];
  assert.ok(block !== undefined && block.type === "table");
  assert.equal(block.columns.length, 1);
  assert.equal(canRemoveTableColumn(doc, "t1"), false, "เหลือคอลัมน์เดียว ⇒ ลบไม่ได้");
  assert.equal(removeTableColumn(doc, "t1", 0), doc, "ลบไม่ได้ = ไม่แตะเอกสาร");

  let grown = doc;
  while (canAddTableColumn(grown, "t1")) grown = addTableColumn(grown, "t1");
  const grownBlock = grown.blocks[0];
  assert.ok(grownBlock !== undefined && grownBlock.type === "table");
  assert.equal(grownBlock.columns.length, MAX_TABLE_COLUMNS);
  assert.equal(addTableColumn(grown, "t1"), grown, "เกินเพดาน = ไม่แตะเอกสาร");
  assert.ok(MAX_TABLE_ROWS > 0);
});

test("block-types: แกลเลอรี — เพิ่ม/ตั้งภาพ/คำบรรยาย/ลบ", () => {
  let doc = docOf([createBlock("gallery", "g1")]);
  doc = addGalleryItem(doc, "g1");
  doc = setGalleryItemImage(doc, "g1", 0, { path: "/media/1", altTh: "ภาพ ก", altEn: "Image A" });
  doc = setGalleryItemCaption(doc, "g1", 0, "th", "คำบรรยาย");

  const item = (value: BlockDocument): GalleryBlock => {
    const block = value.blocks[0];
    assert.ok(block !== undefined && block.type === "gallery");
    return block;
  };

  assert.equal(item(doc).items[0]?.image?.path, "/media/1");
  assert.equal(item(doc).items[0]?.caption.th, "คำบรรยาย");

  doc = removeGalleryItem(doc, "g1", 0);
  assert.equal(item(doc).items.length, 0);
});

/* ── ข้อความของตัวเรนเดอร์ (server + client) ──────────────────────────────── */

test("block-types: blockRenderStringsFor ให้ข้อความครบทั้งสองภาษา", () => {
  const th = blockRenderStringsFor("th");
  const en = blockRenderStringsFor("en");

  for (const strings of [th, en]) {
    assert.ok(strings.gallery.open.length > 0);
    assert.ok(strings.gallery.close.length > 0);
    assert.ok(strings.gallery.dialog.length > 0);
    assert.ok(strings.form.contact.fields.topicLabel.length > 0);
    assert.ok(strings.form.contact.submit.consent.length > 0);
    assert.ok(strings.form.newsletter.submit.length > 0);
    assert.ok(strings.form.careers.fields.positionLabel.length > 0);
    assert.ok(strings.form.careers.submit.consent.length > 0);
  }

  assert.notEqual(th.gallery.open, en.gallery.open, "สองภาษาต้องไม่ใช่ข้อความเดียวกัน");
  assert.notEqual(th.form.contact.fields.topicLabel, en.form.contact.fields.topicLabel);
});
