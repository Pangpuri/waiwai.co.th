import assert from "node:assert/strict";
import { test } from "node:test";

import {
  addColumn,
  canRemoveColumn,
  duplicateBlock,
  insertBlockAt,
  insertPresetBlock,
  moveBlock,
  moveBlockTo,
  moveBlockToLocation,
  removeBlock,
  removeColumn,
  replaceBlockWithPreset,
  setBlockText,
  setColumnWidth,
} from "@/lib/blocks/edit";
import {
  BLOCK_MIGRATIONS,
  applyBlockMigrations,
  countRawBlocks,
  isLegacyVersion,
  migrateBlockValue,
  migrateDocumentValue,
  readRawVersion,
  storedVersionSummary,
} from "@/lib/blocks/migrate";
import { parseBlockDocument } from "@/lib/blocks/parse";
import {
  BLOCK_SCHEMA_VERSION,
  LEGACY_BLOCK_SCHEMA_VERSION,
  MAX_BLOCKS_PER_COLUMN,
  MAX_BLOCK_DEPTH,
  MAX_COLUMNS,
  collectBlockIds,
  countBlocks,
  createBlock,
  createColumns,
  equalColumnWidth,
  findBlockLocation,
  isRowBlock,
  nextBlockId,
  walkBlocks,
  type Block,
  type BlockDocument,
  type RowBlock,
} from "@/lib/blocks/types";
import { documentWarningsOf, validateDocument } from "@/lib/blocks/validate";

/**
 * เทสต์ของ X1.1 — บล็อกซ้อน (แถว/คอลัมน์) + รุ่นรูปทรงบล็อก + ตัวย้ายเวอร์ชัน
 * ตรรกะล้วน (ไม่ต้องมี React/DB) · ทุกเคสมีทั้ง happy path และ edge case
 */

function docOf(blocks: readonly Block[]): BlockDocument {
  return { page: "home", blocks };
}

function rowBlock(id: string, columnCount = 2): RowBlock {
  const block = createBlock("row", id);
  assert.ok(isRowBlock(block));
  return columnCount === 2 ? block : { ...block, columns: createColumns(columnCount) };
}

/** ใส่บล็อกเข้าไปในคอลัมน์แรกของแถว (คืนเอกสารใหม่ + id ที่ได้) */
function withChild(document: BlockDocument, rowId: string, type: "heading" | "richText" | "divider" = "heading"): { readonly document: BlockDocument; readonly blockId: string } {
  const row = document.blocks.find((block) => block.id === rowId);
  assert.ok(row !== undefined && isRowBlock(row));
  const columnId = row.columns[0]?.id ?? "";
  const result = insertBlockAt(document, type, { rowId, columnId, index: 0 });
  assert.ok(result.blockId !== null, "ต้องเพิ่มบล็อกในคอลัมน์ได้");
  return { document: result.document, blockId: result.blockId };
}

/* ── โมเดล: คอลัมน์ + ความกว้าง ─────────────────────────────────────────── */

test("x1.1 model: แถวเริ่มต้นมี 2 คอลัมน์แบ่งครึ่ง และเท่ากับกริด 12", () => {
  const block = createBlock("row", "r1");
  assert.ok(isRowBlock(block));
  assert.equal(block.columns.length, 2);
  assert.deepEqual(block.columns.map((column) => column.width), ["half", "half"]);
  assert.deepEqual(block.columns.map((column) => column.id), ["col-1", "col-2"]);
  assert.equal(block.version, BLOCK_SCHEMA_VERSION);
});

test("x1.1 model: equalColumnWidth แบ่งเท่ากันตามจำนวนคอลัมน์ (1-4)", () => {
  assert.equal(equalColumnWidth(1), "full");
  assert.equal(equalColumnWidth(2), "half");
  assert.equal(equalColumnWidth(3), "third");
  assert.equal(equalColumnWidth(4), "quarter");
  assert.equal(equalColumnWidth(9), "quarter", "เกิน 4 คอลัมน์ถูกบีบให้เท่ากับ 4");
});

test("x1.1 model: walkBlocks เดินลงคอลัมน์ + path ชี้จุดได้ถูกต้อง", () => {
  const document = withChild(docOf([rowBlock("r1"), createBlock("divider", "d1")]), "r1").document;
  const nodes = walkBlocks(document.blocks);

  assert.deepEqual(nodes.map((node) => node.block.id), ["r1", nodes[1]?.block.id, "d1"]);
  assert.equal(nodes[1]?.path, "blocks[0].columns[0].blocks[0]");
  assert.equal(nodes[1]?.rowId, "r1");
  assert.equal(nodes[1]?.columnId, "col-1");
  assert.equal(countBlocks(document.blocks), 3, "นับรวมบล็อกที่ซ้อน");
  assert.equal(new Set(collectBlockIds(document.blocks)).size, 3, "id ไม่ซ้ำกันทั้งหน้า");
});

test("x1.1 model: nextBlockId ไม่ชนกับ id ของบล็อกที่ซ้อนอยู่", () => {
  const child = createBlock("divider", "block-2");
  const document = withChild(docOf([rowBlock("block-1")]), "block-1").document;
  const withManual: BlockDocument = {
    page: "home",
    blocks: document.blocks.map((block) => (isRowBlock(block) ? { ...block, columns: block.columns.map((column) => ({ ...column, blocks: [child] })) } : block)),
  };

  const id = nextBlockId(withManual.blocks);
  assert.ok(!collectBlockIds(withManual.blocks).includes(id), `id ใหม่ต้องไม่ซ้ำของที่ซ้อนอยู่: ${id}`);
});

/* ── เพิ่ม/ย้าย/ลบ ในคอลัมน์ ────────────────────────────────────────────── */

test("x1.1 edit: เพิ่มบล็อกในคอลัมน์ได้ และบอก id ที่สร้างให้", () => {
  const base = docOf([rowBlock("r1")]);
  const result = insertBlockAt(base, "heading", { rowId: "r1", columnId: "col-2", index: 0 });

  assert.ok(result.blockId !== null);
  const row = result.document.blocks[0];
  assert.ok(row !== undefined && isRowBlock(row));
  assert.equal(row.columns[0]?.blocks.length, 0, "คอลัมน์ที่ 1 ไม่ถูกแตะ");
  assert.equal(row.columns[1]?.blocks[0]?.id, result.blockId);
  assert.equal(base.blocks[0]?.id === "r1" && isRowBlock(base.blocks[0]) ? base.blocks[0].columns[1]?.blocks.length : -1, 0, "ไม่แก้เอกสารเดิม");
});

test("x1.1 edit: ย้ายบล็อกจากระดับหน้าเข้าคอลัมน์ และย้ายกลับออกมาได้", () => {
  const withChildDoc = withChild(docOf([rowBlock("r1"), createBlock("divider", "d1")]), "r1").document;
  const childId = collectBlockIds(withChildDoc.blocks).find((id) => id !== "r1" && id !== "d1");
  assert.ok(childId !== undefined);

  /* ออกจากคอลัมน์ → ต่อท้ายระดับหน้า */
  const moved = moveBlockToLocation(withChildDoc, childId, { rowId: null, columnId: null, index: 99 });
  const rootRow = moved.blocks[0];
  assert.ok(rootRow !== undefined && isRowBlock(rootRow));
  assert.equal(rootRow.columns[0]?.blocks.length, 0);
  assert.equal(moved.blocks[moved.blocks.length - 1]?.id, childId);

  /* กลับเข้าคอลัมน์ที่ 2 */
  const back = moveBlockToLocation(moved, childId, { rowId: "r1", columnId: "col-2", index: 0 });
  const backRow = back.blocks[0];
  assert.ok(backRow !== undefined && isRowBlock(backRow));
  assert.equal(backRow.columns[1]?.blocks[0]?.id, childId);
  assert.equal(findBlockLocation(back, childId)?.columnId, "col-2");
});

test("x1.1 edit: ย้ายบล็อกลูกภายในคอลัมน์ (↑ ↓) และที่ขอบไม่ขยับ", () => {
  let document = docOf([rowBlock("r1")]);
  const first = withChild(document, "r1");
  document = insertBlockAt(first.document, "divider", { rowId: "r1", columnId: "col-1", index: 1 }).document;

  const [a, b] = collectBlockIds(document.blocks).filter((id) => id !== "r1");
  assert.ok(a !== undefined && b !== undefined);

  const movedDown = moveBlock(document, a, 1);
  const row = movedDown.blocks[0];
  assert.ok(row !== undefined && isRowBlock(row));
  assert.deepEqual(row.columns[0]?.blocks.map((block) => block.id), [b, a]);

  assert.equal(moveBlock(document, a, -1), document, "บนสุดแล้วเลื่อนขึ้น = ไม่แตะเอกสาร");
  assert.equal(moveBlock(document, b, 1), document, "ล่างสุดแล้วเลื่อนลง = ไม่แตะเอกสาร");
});

test("x1.1 edit: moveBlockTo ยังทำงานระดับหน้าเหมือนเดิม (ไม่พังของเดิม)", () => {
  const document = docOf([createBlock("heading", "b1"), createBlock("divider", "b2"), createBlock("quote", "b3")]);
  assert.deepEqual(moveBlockTo(document, "b1", 2).blocks.map((block) => block.id), ["b2", "b3", "b1"]);
  assert.equal(moveBlockTo(document, "b1", 0), document);
});

test("x1.1 edit: ลบบล็อกที่ซ้อนได้ (และลบแถว = ลบลูกทั้งชุด)", () => {
  const built = withChild(docOf([rowBlock("r1")]), "r1");
  const childId = built.blockId;

  const removedChild = removeBlock(built.document, childId);
  const row = removedChild.blocks[0];
  assert.ok(row !== undefined && isRowBlock(row));
  assert.equal(countBlocks(removedChild.blocks), 1, "เหลือแถวเดียว (ลูกถูกลบ)");

  const removedRow = removeBlock(built.document, "r1");
  assert.equal(countBlocks(removedRow.blocks), 0, "ลบแถว = ลูกลบตาม");
});

test("x1.1 edit: ทำซ้ำแถว = ได้ id ใหม่ทั้งก้อน (รวมบล็อกลูก)", () => {
  const built = withChild(docOf([rowBlock("r1")]), "r1");
  const duplicated = duplicateBlock(built.document, "r1");

  assert.equal(duplicated.blocks.length, 2);
  assert.equal(countBlocks(duplicated.blocks), 4, "2 แถว × (1 แถว + 1 ลูก)");
  assert.equal(new Set(collectBlockIds(duplicated.blocks)).size, 4, "id ต้องไม่ซ้ำกันเลย");
});

test("x1.1 edit: วางพรีเซ็ตที่เป็นแถว = ได้ id ใหม่ทั้งก้อน (ลูกไม่ชนกับของเดิม)", () => {
  const built = withChild(docOf([rowBlock("r1")]), "r1");
  const preset = built.document.blocks[0];
  assert.ok(preset !== undefined);

  const next = insertPresetBlock(built.document, preset);
  assert.equal(next.blocks.length, 2);
  assert.equal(new Set(collectBlockIds(next.blocks)).size, 4);
});

test("x1.1 edit: วางพรีเซ็ตแถวทับบล็อกในคอลัมน์ = ไม่ทำ (กันแถวซ้อนแถว)", () => {
  const built = withChild(docOf([rowBlock("r1")]), "r1");
  const presetRow = rowBlock("preset-row");
  assert.equal(replaceBlockWithPreset(built.document, built.blockId, presetRow), built.document);
});

/* ── คอลัมน์: เพิ่ม/ลบ/ความกว้าง ─────────────────────────────────────────── */

test("x1.1 columns: เพิ่มคอลัมน์แล้วแบ่งความกว้างใหม่ให้เท่ากันทันที", () => {
  const added = addColumn(docOf([rowBlock("r1")]), "r1");
  const row = added.blocks[0];
  assert.ok(row !== undefined && isRowBlock(row));
  assert.equal(row.columns.length, 3);
  assert.deepEqual(row.columns.map((column) => column.width), ["third", "third", "third"]);
});

test("x1.1 columns: เพิ่มได้สูงสุด 4 คอลัมน์ (เกินแล้วไม่ทำอะไร)", () => {
  let document = docOf([rowBlock("r1", 4)]);
  document = addColumn(document, "r1");
  const row = document.blocks[0];
  assert.ok(row !== undefined && isRowBlock(row));
  assert.equal(row.columns.length, MAX_COLUMNS);
  assert.deepEqual(row.columns.map((column) => column.width), ["quarter", "quarter", "quarter", "quarter"]);
});

test("x1.1 columns: ลบคอลัมน์ได้เฉพาะที่ว่าง และเหลืออย่างน้อย 1 คอลัมน์", () => {
  const built = withChild(docOf([rowBlock("r1")]), "r1");

  assert.equal(canRemoveColumn(built.document, "r1", "col-1"), false, "คอลัมน์ที่มีบล็อกยังลบไม่ได้");
  assert.equal(canRemoveColumn(built.document, "r1", "col-2"), true);
  assert.equal(removeColumn(built.document, "r1", "col-1"), built.document, "ลบไม่ได้ = ไม่แตะเอกสาร");

  const removed = removeColumn(built.document, "r1", "col-2");
  const row = removed.blocks[0];
  assert.ok(row !== undefined && isRowBlock(row));
  assert.equal(row.columns.length, 1);
  assert.equal(row.columns[0]?.width, "full", "เหลือคอลัมน์เดียว = เต็มความกว้าง");

  assert.equal(removeColumn(removed, "r1", "col-1"), removed, "เหลือคอลัมน์เดียว = ลบไม่ได้");
});

test("x1.1 columns: ตั้งความกว้างคอลัมน์จากพรีเซ็ตได้", () => {
  const document = setColumnWidth(docOf([rowBlock("r1")]), "r1", "col-2", "twoThirds");
  const row = document.blocks[0];
  assert.ok(row !== undefined && isRowBlock(row));
  assert.deepEqual(row.columns.map((column) => column.width), ["half", "twoThirds"]);
});

/* ── validator ──────────────────────────────────────────────────────────── */

test("x1.1 validate: ตรวจถึงบล็อกที่ซ้อนในคอลัมน์ (path ชี้จุดจริง)", () => {
  const built = insertBlockAt(docOf([rowBlock("r1")]), "heading", { rowId: "r1", columnId: "col-1", index: 0 });
  const issues = validateDocument(built.document);
  const error = issues.find((entry) => entry.code === "empty-th");

  assert.ok(error !== undefined, "หัวข้อว่างในคอลัมน์ต้องถูกจับ");
  assert.equal(error.path, "blocks[0].columns[0].blocks[0].text.th");
});

test("x1.1 validate: คอลัมน์ว่างเป็นคำเตือน และรวมความกว้างเกิน 12 ก็เตือน", () => {
  const document = setColumnWidth(docOf([rowBlock("r1")]), "r1", "col-2", "threeQuarters");
  const warnings = documentWarningsOf(validateDocument(document)).map((entry) => entry.code);

  assert.ok(warnings.includes("column-empty"), "คอลัมน์ว่างต้องเตือน");
  assert.ok(warnings.includes("row-width-overflow"), "6+9 = 15/12 ต้องเตือน");
});

test("x1.1 validate: id ซ้ำกันข้ามชั้น (ระดับหน้า vs ในคอลัมน์) ถูกจับเป็น error", () => {
  const row = rowBlock("dup");
  const child = createBlock("divider", "dup");
  const document: BlockDocument = {
    page: "home",
    blocks: [{ ...row, columns: row.columns.map((column) => ({ ...column, blocks: column.id === "col-1" ? [child] : [] })) }, createBlock("divider", "dup")],
  };

  const codes = validateDocument(document).filter((entry) => entry.severity === "error").map((entry) => entry.code);
  assert.ok(codes.includes("duplicate-id"));
});

/* ── parse: บล็อกซ้อน + เพดาน/ความลึก ───────────────────────────────────── */

test("x1.1 parse: เอกสารที่มีแถว+บล็อกซ้อนไปกลับได้เท่าเดิม", () => {
  const built = withChild(docOf([rowBlock("r1")]), "r1").document;
  const outcome = parseBlockDocument("home", JSON.parse(JSON.stringify(built)));

  assert.equal(outcome.ok, true);
  if (outcome.ok) assert.deepEqual(outcome.document, built);
});

test("x1.1 parse: แถวซ้อนแถวถูกปฏิเสธพร้อมรายงาน (ลึกเกิน)", () => {
  const inner = { id: "inner", type: "row", version: BLOCK_SCHEMA_VERSION, style: {}, columns: createColumns(2) };
  const outer = { id: "outer", type: "row", version: BLOCK_SCHEMA_VERSION, style: {}, columns: [{ id: "col-1", width: "half", blocks: [inner] }] };

  const outcome = parseBlockDocument("home", { blocks: [outer] });
  assert.equal(outcome.ok, false);
  if (!outcome.ok) assert.ok(outcome.problems.some((problem) => problem.includes("ซ้อนแถวในแถวไม่ได้")));
  assert.equal(MAX_BLOCK_DEPTH, 1, "กติกาที่ตกลง: ซ้อนได้ 1 ชั้น");
});

test("x1.1 parse: จำนวนบล็อกในคอลัมน์เกินเพดานถูกตัดและรายงาน", () => {
  const children = Array.from({ length: MAX_BLOCKS_PER_COLUMN + 3 }, (_unused, index) => ({ id: `c${index}`, type: "divider" }));
  const row = { id: "r1", type: "row", style: {}, columns: [{ id: "col-1", width: "full", blocks: children }] };

  const outcome = parseBlockDocument("home", { blocks: [row] });
  assert.equal(outcome.ok, false);
  if (!outcome.ok) assert.ok(outcome.problems.some((problem) => problem.includes("เกินที่อนุญาต")));
});

test("x1.1 parse: id ของบล็อกลูกซ้ำกับของเดิมถูกสร้างใหม่ให้", () => {
  const row = {
    id: "r1",
    type: "row",
    style: {},
    columns: [{ id: "col-1", width: "full", blocks: [{ id: "ซ้ำ", type: "divider" }, { id: "ซ้ำ", type: "divider" }] }],
  };

  const outcome = parseBlockDocument("home", { blocks: [row] });
  assert.equal(outcome.ok, false, "ต้องรายงานว่า id ซ้ำ");
  if (!outcome.ok) assert.ok(outcome.problems.some((problem) => problem.includes(".id")));
});

test("x1.1 parse: id คอลัมน์ซ้ำในแถวเดียวถูกสร้างใหม่", () => {
  const row = {
    id: "r1",
    type: "row",
    style: {},
    columns: [{ id: "col-1", width: "half", blocks: [] }, { id: "col-1", width: "half", blocks: [] }],
  };

  const outcome = parseBlockDocument("home", { blocks: [row] });
  assert.equal(outcome.ok, false);
  if (!outcome.ok) assert.ok(outcome.problems.some((problem) => problem.includes("columns[1].id")));
});

test("x1.1 parse: บล็อกที่บันทึกด้วยรุ่นใหม่กว่า = ข้ามพร้อมรายงาน (ไม่เดา)", () => {
  const future = { id: "f1", type: "divider", version: BLOCK_SCHEMA_VERSION + 5, style: {} };
  const outcome = parseBlockDocument("home", { blocks: [future] });

  assert.equal(outcome.ok, false);
  if (!outcome.ok) assert.ok(outcome.problems.some((problem) => problem.includes("รุ่นใหม่กว่า")));
});

/* ── ตัวย้ายเวอร์ชัน ────────────────────────────────────────────────────── */

test("x1.1 migrate: อ่านรุ่นจากค่าดิบ (ไม่มี/ผิดรูป = รุ่น 1)", () => {
  assert.equal(readRawVersion({}), LEGACY_BLOCK_SCHEMA_VERSION);
  assert.equal(readRawVersion({ version: 2 }), 2);
  assert.equal(readRawVersion({ version: "2" }), LEGACY_BLOCK_SCHEMA_VERSION);
  assert.equal(readRawVersion({ version: 0 }), LEGACY_BLOCK_SCHEMA_VERSION);
  assert.equal(readRawVersion(null), LEGACY_BLOCK_SCHEMA_VERSION);
  assert.equal(isLegacyVersion(1), true);
  assert.equal(isLegacyVersion(BLOCK_SCHEMA_VERSION), false);
});

test("x1.1 migrate: ย้ายบล็อกรุ่น 1 → รุ่นปัจจุบัน แล้วย้ายซ้ำได้ผลเดิม (idempotent)", () => {
  const legacy = { id: "b1", type: "heading", text: { th: "ก", en: "a" } };
  const migrated = migrateBlockValue(legacy);
  assert.equal(readRawVersion(migrated), BLOCK_SCHEMA_VERSION);

  const again = migrateBlockValue(migrated);
  assert.deepEqual(again, migrated, "ย้ายซ้ำต้องไม่เปลี่ยนอะไร");
});

test("x1.1 migrate: ย้ายลงถึงบล็อกลูกในคอลัมน์ด้วย", () => {
  const legacyRow = {
    id: "r1",
    type: "row",
    columns: [{ id: "col-1", width: "half", blocks: [{ id: "c1", type: "divider" }] }],
  };

  const migrated = migrateBlockValue(legacyRow);
  const summary = storedVersionSummary({ blocks: [migrated] });
  assert.equal(summary.total, 2);
  assert.equal(summary.legacy, 0, "ทั้งแถวและลูกต้องเป็นรุ่นปัจจุบัน");
  assert.equal(summary.newest, BLOCK_SCHEMA_VERSION);
});

test("x1.1 migrate: ทะเบียนไล่ทีละรุ่นได้จริง (ใช้ทะเบียนปลอม 1→2→3)", () => {
  const registry = {
    1: (block: Record<string, unknown>) => ({ ...block, version: 2, step1: true }),
    2: (block: Record<string, unknown>) => ({ ...block, version: 3, step2: true }),
  };

  /* เป้าหมาย = 3 เพื่อพิสูจน์ว่าไล่ต่อทีละรุ่นจริง (รุ่นปัจจุบันของโค้ดขณะนี้คือ 2) */
  const migrated = applyBlockMigrations({ id: "b1" }, registry, 3);
  assert.equal(readRawVersion(migrated), 3);
  assert.equal(migrated["step1"], true);
  assert.equal(migrated["step2"], true);

  /* ไม่ระบุเป้าหมาย = หยุดที่รุ่นปัจจุบันของโค้ดเสมอ */
  assert.equal(readRawVersion(applyBlockMigrations({ id: "b1" }, registry)), BLOCK_SCHEMA_VERSION);
});

test("x1.1 migrate: ทะเบียนที่เขียนผิด (ไม่เลื่อนรุ่น) ไม่ทำให้แขวน", () => {
  const broken = { 1: (block: Record<string, unknown>) => block };
  const result = applyBlockMigrations({ id: "b1" }, broken);
  assert.equal(readRawVersion(result), LEGACY_BLOCK_SCHEMA_VERSION, "คืนของเดิมดีกว่าแขวน");
});

test("x1.1 migrate: รุ่นใหม่กว่ารุ่นปัจจุบันถูกปล่อยผ่าน (ให้ parse เป็นคนรายงาน)", () => {
  const future = { id: "b1", version: BLOCK_SCHEMA_VERSION + 3 };
  assert.deepEqual(migrateBlockValue(future), future);
});

test("x1.1 migrate: migrateDocumentValue ไม่ทำข้อมูลพังเพิ่ม (ค่าที่ไม่ใช่เอกสารถูกคืนเดิม)", () => {
  for (const bad of [null, 7, "ข้อความ", [], {}]) {
    assert.deepEqual(migrateDocumentValue(bad), bad);
  }
});

test("x1.1 migrate: storedVersionSummary นับของจริงจากข้อมูลดิบ (แถว + ลูก)", () => {
  const raw = {
    blocks: [
      { id: "b1", type: "heading" },
      { id: "r1", type: "row", version: 2, columns: [{ id: "col-1", blocks: [{ id: "c1", type: "divider" }, { id: "c2", type: "divider", version: 2 }] }] },
    ],
  };

  const summary = storedVersionSummary(raw);
  assert.equal(summary.total, 4);
  assert.equal(summary.legacy, 2, "b1 (ไม่มีรุ่น) + c1");
  assert.equal(summary.newest, 2);
  assert.equal(countRawBlocks(raw), 4);
  assert.deepEqual(summary.versionCounts, { "1": 2, "2": 2 });
});

test("x1.1 migrate: เอกสารรุ่นเก่าจากฐานข้อมูลเปิดได้ผ่าน parse และได้รุ่นปัจจุบัน", () => {
  /* จำลองแถวที่บันทึกก่อนรอบที่ 71: ไม่มีฟิลด์ version เลย */
  const stored = { page: "home", blocks: [{ id: "b1", type: "heading", text: { th: "หัวข้อ", en: "Title" }, level: 2 }] };

  const outcome = parseBlockDocument("home", stored);
  assert.equal(outcome.ok, true);
  if (outcome.ok) {
    assert.equal(outcome.document.blocks[0]?.version, BLOCK_SCHEMA_VERSION);
    assert.equal(storedVersionSummary(stored).legacy, 1, "ข้อมูลที่เก็บไว้ยังนับว่าเป็นรุ่นเก่า (รอปุ่มย้าย)");
  }
});

test("x1.1 migrate: ทะเบียนจริงมีตัวย้ายของรุ่น 1 และเป้าหมายเป็นรุ่นปัจจุบัน", () => {
  const migrate = BLOCK_MIGRATIONS[LEGACY_BLOCK_SCHEMA_VERSION];
  assert.ok(migrate !== undefined);
  assert.equal(readRawVersion(migrate({ id: "b1" })), BLOCK_SCHEMA_VERSION);
});

/* ── แก้ข้อความในบล็อกที่ซ้อน (หน้าจอต้องแก้ได้จริง) ───────────────────────── */

test("x1.1 edit: แก้ข้อความของบล็อกที่อยู่ในคอลัมน์ได้ (เดิมแก้ไม่ได้)", () => {
  const built = withChild(docOf([rowBlock("r1")]), "r1");
  const updated = setBlockText(built.document, built.blockId, "text", "th", "หัวข้อในคอลัมน์");

  const row = updated.blocks[0];
  assert.ok(row !== undefined && isRowBlock(row));
  const child = row.columns[0]?.blocks[0];
  assert.ok(child !== undefined && child.type === "heading");
  assert.equal(child.text.th, "หัวข้อในคอลัมน์");
});
