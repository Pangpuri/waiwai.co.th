import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { blockRenderStringsFor } from "@/features/blocks/render-strings";
import {
  addGalleryItem,
  addJobItem,
  addRosterMember,
  addTableColumn,
  addTableRow,
  canAddTableColumn,
  canRemoveTableColumn,
  moveJobItem,
  moveRosterMember,
  removeGalleryItem,
  removeJobItem,
  removeRosterMember,
  removeTableColumn,
  setGalleryItemCaption,
  setGalleryItemImage,
  setJobBoardGrouping,
  setJobItemOpenings,
  setJobItemText,
  setRosterColumns,
  setRosterMemberImage,
  setRosterMemberText,
  setTableCellText,
} from "@/lib/blocks/edit";
import { FORM_KINDS } from "@/lib/forms/model";
import { parseBlockDocument } from "@/lib/blocks/parse";
import {
  BLOCK_CATALOG,
  BLOCK_TYPES,
  FORM_BLOCK_KINDS,
  MAX_JOB_ITEMS,
  MAX_ROSTER_MEMBERS,
  MAX_TABLE_COLUMNS,
  MAX_TABLE_ROWS,
  createBlock,
  type Block,
  type BlockDocument,
  type GalleryBlock,
  type TableBlock,
} from "@/lib/blocks/types";
import { documentErrorsOf, documentWarningsOf, validateDocument } from "@/lib/blocks/validate";

/** รากโปรเจกต์ — ใช้กับเทสต์ที่สแกนซอร์สตัวเรนเดอร์ (เป็น server component ⇒ เรนเดอร์ใน node --test ไม่ได้) */
const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

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

const NEW_TYPES = ["table", "map", "form", "gallery", "jobBoard", "rosterText"] as const;

test("block-types: แคตตาล็อกและ BLOCK_TYPES มีครบทุกชนิดใหม่", () => {
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
  assert.ok(th.jobBoard.openingsUnit.length > 0);
  assert.ok(en.jobBoard.openingsUnit.length > 0);
  assert.notEqual(th.jobBoard.openingsUnit, en.jobBoard.openingsUnit, "ป้ายกระดานงานต้องมีสองภาษา");
  assert.ok(th.jobBoard.qualificationsLabel.length > 0 && en.jobBoard.experienceLabel.length > 0);
});

/* ── รอบที่ 88: กระดานรับสมัครงาน · รายชื่อคณะผู้บริหาร ───────────────────── */

test("block-types: createBlock ของ jobBoard/rosterText พร้อมแก้", () => {
  const board = createBlock("jobBoard", "b1");
  assert.ok(board.type === "jobBoard");
  assert.equal(board.items.length, 0);
  assert.equal(board.groupByDepartment, true, "ค่าเริ่มต้น = จัดกลุ่มตามฝ่าย");
  assert.equal(board.style.width, "wide");

  const roster = createBlock("rosterText", "b2");
  assert.ok(roster.type === "rosterText");
  assert.equal(roster.members.length, 0);
  assert.equal(roster.columns, 3);
  assert.equal(roster.style.width, "wide");
});

test("block-types: parse เอกสารที่มี jobBoard/rosterText ไปกลับได้เท่าเดิม", () => {
  const doc = docOf([createBlock("jobBoard", "b1"), createBlock("rosterText", "b2")]);
  const outcome = parseBlockDocument("home", JSON.parse(JSON.stringify(doc)));
  assert.equal(outcome.ok, true);
  assert.ok(outcome.ok);
  assert.deepEqual(outcome.document, doc);
});

test("block-types: parse กระดานงาน — อัตราที่ผิดรูปเป็น 0 + id ซ้ำถูกเปลี่ยน", () => {
  const raw = {
    blocks: [
      {
        id: "b1",
        type: "jobBoard",
        style: {},
        groupByDepartment: false,
        items: [
          { id: "job-x", title: { th: "ก", en: "A" }, department: { th: "ฝ่าย", en: "Dept" }, openings: 2, qualifications: { th: "", en: "" }, experience: { th: "", en: "" } },
          { id: "job-x", title: { th: "ข", en: "B" }, department: { th: "ฝ่าย", en: "Dept" }, openings: "3", qualifications: { th: "", en: "" }, experience: { th: "", en: "" } },
        ],
      },
    ],
  };

  const outcome = parseBlockDocument("home", raw);
  assert.equal(outcome.ok, false, "ค่าที่ผิดรูปต้องถูกรายงาน");
  assert.ok(!outcome.ok);
  assert.ok(outcome.problems.some((problem) => problem.includes("openings")));
  assert.ok(outcome.problems.some((problem) => problem.includes("ซ้ำ")));
});

test("block-types: parse รายชื่อ — คนที่ยังไม่มีภาพยังอยู่ได้ (ภาพไม่บังคับ)", () => {
  const raw = {
    blocks: [
      {
        id: "b1",
        type: "rosterText",
        style: {},
        columns: 4,
        members: [{ id: "person-1", name: { th: "สมชาย", en: "Somchai" }, role: { th: "กรรมการ", en: "Director" }, image: null }],
      },
    ],
  };

  const outcome = parseBlockDocument("home", raw);
  assert.equal(outcome.ok, true);
  assert.ok(outcome.ok);
  const block = outcome.document.blocks[0];
  assert.ok(block !== undefined && block.type === "rosterText");
  assert.equal(block.columns, 4);
  assert.equal(block.members[0]?.image, null);
  assert.equal(block.members[0]?.name.th, "สมชาย");
});

test("block-types: parse ปฏิเสธจำนวนคอลัมน์รายชื่อที่ไม่รองรับ", () => {
  const raw = {
    blocks: [{ id: "b1", type: "rosterText", style: {}, columns: 5, members: [] }],
  };
  const outcome = parseBlockDocument("home", raw);
  assert.equal(outcome.ok, false);
  assert.ok(!outcome.ok);
  assert.ok(outcome.problems.some((problem) => problem.includes("columns")));
});

test("block-types: validate กระดานงาน — ว่าง = เตือน · ชื่อตำแหน่งว่าง = error · ไม่ระบุอัตรา = เตือน", () => {
  const empty = createBlock("jobBoard", "b1");
  const emptyWarnings = documentWarningsOf(validateDocument(docOf([empty]))).map((entry) => entry.code);
  assert.ok(emptyWarnings.includes("jobBoard-empty"));

  const board = mutable(createBlock("jobBoard", "b2"));
  assert.ok(board.type === "jobBoard");
  board.items = [
    { id: "job-1", title: { th: "", en: "Driver" }, department: { th: "ฝ่ายขาย", en: "Sales" }, openings: 0, qualifications: { th: "ป.6", en: "Grade 6" }, experience: { th: "", en: "" } },
  ];
  const issues = validateDocument(docOf([board]));
  const errors = documentErrorsOf(issues).map((entry) => entry.code);
  const warnings = documentWarningsOf(issues).map((entry) => entry.code);
  assert.ok(errors.includes("empty-th"));
  assert.ok(warnings.includes("job-item-without-openings"));
});

test("block-types: validate รายชื่อ — ว่าง = เตือน · ชื่อว่าง = error · ตำแหน่งไม่มี EN = เตือน", () => {
  const empty = createBlock("rosterText", "b1");
  assert.ok(documentWarningsOf(validateDocument(docOf([empty]))).some((entry) => entry.code === "roster-empty"));

  const roster = mutable(createBlock("rosterText", "b2"));
  assert.ok(roster.type === "rosterText");
  roster.members = [{ id: "person-1", name: { th: "", en: "" }, role: { th: "กรรมการผู้จัดการ", en: "" }, image: null }];
  const issues = validateDocument(docOf([roster]));
  const errors = documentErrorsOf(issues).map((entry) => entry.code);
  const warnings = documentWarningsOf(issues).map((entry) => entry.code);
  assert.ok(errors.includes("empty-th"));
  assert.ok(warnings.includes("missing-en"), "ตำแหน่งต้องมีคำแปลอังกฤษ");
});

test("block-types: validate รายชื่อ — ภาพรายบุคคลต้องมีพาธในโปรเจกต์ + alt", () => {
  const roster = mutable(createBlock("rosterText", "b1"));
  assert.ok(roster.type === "rosterText");
  roster.members = [
    {
      id: "person-1",
      name: { th: "สมชาย", en: "Somchai" },
      role: { th: "กรรมการ", en: "Director" },
      image: { path: "https://example.com/p.jpg", altTh: "", altEn: "", hasWatermark: false },
    },
  ];
  const errors = documentErrorsOf(validateDocument(docOf([roster]))).map((entry) => entry.code);
  assert.ok(errors.includes("media-path-is-url"));
  assert.ok(errors.includes("missing-alt"));
});

test("block-types: กระดานงาน — เพิ่ม/ลบ/ย้ายตำแหน่ง + แก้ข้อความ/อัตรา/การจัดกลุ่ม", () => {
  let doc = docOf([createBlock("jobBoard", "b1")]);
  const boardOf = (value: BlockDocument) => {
    const block = value.blocks[0];
    assert.ok(block !== undefined && block.type === "jobBoard");
    return block;
  };

  doc = addJobItem(doc, "b1");
  doc = addJobItem(doc, "b1");
  assert.equal(boardOf(doc).items.length, 2);

  doc = setJobItemText(doc, "b1", 0, "title", "th", "พนักงานขับรถ");
  doc = setJobItemText(doc, "b1", 0, "department", "en", "Sales");
  doc = setJobItemOpenings(doc, "b1", 0, 2);
  assert.equal(boardOf(doc).items[0]?.title.th, "พนักงานขับรถ");
  assert.equal(boardOf(doc).items[0]?.department.en, "Sales");
  assert.equal(boardOf(doc).items[0]?.openings, 2);

  doc = setJobItemOpenings(doc, "b1", 0, 5000);
  assert.equal(boardOf(doc).items[0]?.openings, 999, "อัตราถูกจำกัดช่วง");
  doc = setJobItemOpenings(doc, "b1", 0, -3);
  assert.equal(boardOf(doc).items[0]?.openings, 0);

  const second = boardOf(doc).items[1]?.id;
  doc = moveJobItem(doc, "b1", 1, 0);
  assert.equal(boardOf(doc).items[0]?.id, second, "ย้ายตำแหน่งขึ้นบนสุด");

  doc = setJobBoardGrouping(doc, "b1", false);
  assert.equal(boardOf(doc).groupByDepartment, false);

  doc = removeJobItem(doc, "b1", 0);
  assert.equal(boardOf(doc).items.length, 1);

  assert.equal(removeJobItem(doc, "b1", 9), doc, "index นอกช่วง = ไม่แตะเอกสาร");
});

test("block-types: รายชื่อ — เพิ่ม/ลบ/ย้ายคน + แก้ชื่อ/ตำแหน่ง/ภาพ/คอลัมน์", () => {
  let doc = docOf([createBlock("rosterText", "b1")]);
  const rosterOf = (value: BlockDocument) => {
    const block = value.blocks[0];
    assert.ok(block !== undefined && block.type === "rosterText");
    return block;
  };

  doc = addRosterMember(doc, "b1");
  doc = setRosterMemberText(doc, "b1", 0, "name", "th", "สมชาย ใจดี");
  doc = setRosterMemberText(doc, "b1", 0, "role", "en", "Managing Director");
  assert.equal(rosterOf(doc).members[0]?.name.th, "สมชาย ใจดี");
  assert.equal(rosterOf(doc).members[0]?.role.en, "Managing Director");

  doc = setRosterMemberImage(doc, "b1", 0, { path: "/media/1", altTh: "ภาพผู้บริหาร", altEn: "Executive photo" });
  assert.equal(rosterOf(doc).members[0]?.image?.path, "/media/1");

  doc = setRosterMemberImage(doc, "b1", 0, { path: "" });
  assert.equal(rosterOf(doc).members[0]?.image, null, "พาธว่าง = เอารูปออก");

  doc = setRosterColumns(doc, "b1", 4);
  assert.equal(rosterOf(doc).columns, 4);
  doc = setRosterColumns(doc, "b1", 9);
  assert.equal(rosterOf(doc).columns, 3, "คอลัมน์ที่ไม่รองรับถูกปรับเป็น 3");

  doc = addRosterMember(doc, "b1");
  const second = rosterOf(doc).members[1]?.id;
  doc = moveRosterMember(doc, "b1", 1, 0);
  assert.equal(rosterOf(doc).members[0]?.id, second);

  doc = removeRosterMember(doc, "b1", 0);
  assert.equal(rosterOf(doc).members.length, 1);
  assert.equal(removeRosterMember(doc, "b1", 5), doc, "index นอกช่วง = ไม่แตะเอกสาร");
});

test("block-types: แคตตาล็อกและ BLOCK_TYPES มีชนิดใหม่ของรอบที่ 88", () => {
  for (const type of ["jobBoard", "rosterText"] as const) {
    assert.ok((BLOCK_TYPES as readonly string[]).includes(type), `ขาดชนิด ${type}`);
    assert.ok(BLOCK_CATALOG.some((entry) => entry.type === type), `แคตตาล็อกขาด ${type}`);
  }
  assert.ok(MAX_JOB_ITEMS >= 20, "ต้องรองรับตำแหน่งจริง 20 ตำแหน่ง");
  assert.ok(MAX_ROSTER_MEMBERS > 0);
});

/* ── รอบที่ 259: บล็อก "ภาพใหญ่" (ไม่ครอป · ไม่มีคำบรรยาย) ─────────────────────
   มติเจ้าของ 2026-10-10: หน้า "คณะผู้บริหาร" แสดงภาพผังภาพเดียว แต่บล็อกภาพเดิมทุกตัว
   บังคับสัดส่วน 4:3 + object-cover ⇒ ตัดขอบซ้าย/ขวา ~3% ต่อข้าง ซึ่งตัดข้อความในผังขาด
*/

test("block-types: ภาพใหญ่ — มีใน BLOCK_TYPES + แคตตาล็อก (ป้ายชื่อไทย) + ค่าเริ่มต้นกว้าง", () => {
  assert.ok((BLOCK_TYPES as readonly string[]).includes("image"));
  const entry = BLOCK_CATALOG.find((item) => item.type === "image");
  assert.ok(entry !== undefined, "แคตตาล็อกต้องมีบล็อกภาพใหญ่ (ไม่งั้นเพิ่มในหลังบ้านไม่ได้)");
  assert.ok(entry.label.trim() !== "" && entry.hint.trim() !== "");

  const block = createBlock("image", "b1");
  assert.equal(block.type, "image");
  assert.equal(block.style.width, "wide", "ภาพใหญ่ต้องเริ่มที่ความกว้างระดับกว้าง (ผังอ่านยากถ้าแคบ)");
  const image = mutable(block);
  assert.ok(image.type === "image");
  assert.equal(image.image, null, "เริ่มต้นยังไม่เลือกภาพ (ไม่ให้ค่าปลอม)");
});

test("block-types: ภาพใหญ่ — parse ไม่เชื่อข้อมูล (URL เต็ม = error · ไม่มี alt = error)", () => {
  const ok = parseBlockDocument("executives", {
    page: "executives",
    blocks: [
      {
        id: "b1",
        version: 2,
        type: "image",
        style: { align: "left", width: "wide", spacing: "md", background: "none", size: "md" },
        image: { path: "/media/abc123", altTh: "ผังคณะผู้บริหาร", altEn: "", hasWatermark: false },
      },
    ],
  });
  assert.ok(ok.ok, ok.ok ? "" : ok.problems.join(" · "));
  assert.equal(ok.ok ? ok.document.blocks.length : 0, 1);

  /* มติ D9: ห้ามเก็บ URL เต็ม · มติ D7: ภาพต้องมี alt */
  const bad = parseBlockDocument("executives", {
    page: "executives",
    blocks: [
      {
        id: "b1",
        version: 2,
        type: "image",
        style: { align: "left", width: "wide", spacing: "md", background: "none", size: "md" },
        image: { path: "https://example.com/chart.jpg", altTh: "", altEn: "", hasWatermark: false },
      },
    ],
  });
  assert.ok(bad.ok);
  const codes = documentErrorsOf(validateDocument(bad.ok ? bad.document : docOf([]))).map((entry) => entry.code);
  assert.ok(codes.includes("media-path-is-url"), "ต้องจับ URL เต็ม (มติ D9)");
  assert.ok(codes.includes("missing-alt"), "ต้องจับภาพที่ไม่มี alt (มติ D7)");
});

test("block-types: ภาพใหญ่ — ยังไม่เลือกภาพ = คำเตือน (ไม่บล็อกการบันทึก)", () => {
  const issues = validateDocument(docOf([createBlock("image", "b1")]));
  assert.equal(documentErrorsOf(issues).length, 0, "ยังไม่เลือกภาพต้องไม่เป็น error (ผู้ใช้วางบล็อกก่อนได้)");
  assert.ok(documentWarningsOf(issues).some((entry) => entry.code === "image-block-without-image"));
});

test("block-types: ภาพใหญ่ — ตัวเรนเดอร์ต้องไม่ครอปภาพ (ห้าม aspect/object-cover เด็ดขาด)", () => {
  /*
    ⚠️ นี่คือ "เหตุผลที่บล็อกนี้มีอยู่" — ถ้ามีคนเผลอใส่กรอบสัดส่วนหรือ object-cover
    ภาพผังคณะผู้บริหารจะถูกตัดขอบและชื่อในภาพขาด ⇒ เทสต์นี้ต้องแดงทันที
  */
  const renderer = readFileSync(path.join(PROJECT_ROOT, "features", "blocks", "block-renderer.tsx"), "utf8");
  const start = renderer.indexOf('case "image": {');
  assert.ok(start > 0, "ต้องพบสาขาเรนเดอร์ของบล็อกภาพใหญ่");
  const end = renderer.indexOf('case "imageText": {', start);
  assert.ok(end > start, "ต้องหาจุดสิ้นสุดของสาขาได้");
  const branch = renderer.slice(start, end);

  assert.ok(branch.includes('case "image"'), "สแกนผิดช่วง");
  assert.ok(!branch.includes("aspect-"), "บล็อกภาพใหญ่ห้ามมีกรอบสัดส่วน (จะครอปภาพ)");
  assert.ok(!branch.includes("object-cover"), "บล็อกภาพใหญ่ห้ามใช้ object-cover (จะครอปภาพ)");
  assert.ok(branch.includes("h-auto w-full"), "ต้องแสดงที่สัดส่วนจริงของไฟล์ (h-auto w-full)");
});
