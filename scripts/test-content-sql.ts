import assert from "node:assert/strict";
import { test } from "node:test";

import { HOME_PAGE_SPEC } from "@/lib/content/model";
import { HOME_SEED } from "@/lib/content/home-seed";
import { CONTENT_FIELD_COLUMNS, SEED_ACTOR, buildUpsertStatements, countRows, itemKeyOf } from "@/lib/content/sql";
import type { PageContent } from "@/lib/content/types";

/**
 * เทสต์ของชั้น SQL (lib/content/sql.ts)
 *
 * เป้าหมายหลักคือ **ความปลอดภัย**: ทุกค่าต้องเป็น parameter ($n) ไม่ใช่การต่อสตริง
 * และความถูกต้องของ mapping (พาธภาพลงคอลัมน์ media_* · ลำดับรายการลง item_order)
 *
 * เทสต์ชุดนี้ไม่ต้องมีฐานข้อมูล → ด่านยังรันผ่านในเครื่อง/CI ที่ไม่มี Postgres
 */

const COLUMN_INDEX = new Map<string, number>(CONTENT_FIELD_COLUMNS.map((column, index) => [column, index]));

function indexOfColumn(name: string): number {
  const index = COLUMN_INDEX.get(name);
  assert.ok(index !== undefined, `ไม่มีคอลัมน์ ${name}`);
  return index;
}

type WrittenRow = readonly (string | number | boolean | null)[];

/** คอลัมน์ที่ "ค่ามาจากเนื้อหา" (ใช้ตรวจว่าไม่ถูกต่อสตริงลงใน SQL) */
const CONTENT_VALUE_COLUMNS: readonly string[] = ["th", "en", "media_path", "media_alt_th", "media_alt_en"];

/** แตก values แบน ๆ กลับเป็นแถว ๆ ตามลำดับคอลัมน์ */
function rowsOf(values: readonly (string | number | boolean | null)[]): readonly WrittenRow[] {
  const size = CONTENT_FIELD_COLUMNS.length;
  assert.equal(values.length % size, 0, "จำนวนค่าต้องหารด้วยจำนวนคอลัมน์ลงตัว");
  const rows: WrittenRow[] = [];
  for (let offset = 0; offset < values.length; offset += size) {
    rows.push(values.slice(offset, offset + size));
  }
  return rows;
}

function allStatements() {
  return buildUpsertStatements(HOME_PAGE_SPEC, HOME_SEED, SEED_ACTOR);
}

/** คีย์ของหนึ่งช่องในตาราง content_field (primary key = page + section + item_key + field) */
function keyOf(section: unknown, itemKey: unknown, field: unknown): string {
  return `${String(section)}|${String(itemKey)}|${String(field)}`;
}

test("sql: ค่าทุกค่าเป็น parameter — ข้อความ SQL ไม่มีค่าจริงปนอยู่", () => {
  for (const statement of allStatements()) {
    assert.ok(statement.text.startsWith("insert into content_field"), "ต้องเป็น insert เข้า content_field");
    assert.ok(statement.text.includes("on conflict (page, section, item_key, field)"), "ต้อง upsert ได้ (รันซ้ำ)");

    // ค่าที่มาจาก "เนื้อหา" ต้องไม่ปรากฏในข้อความ SQL (กันการต่อสตริงซึ่งเป็นช่องโหว่)
    // (ไม่ตรวจคอลัมน์ kind/updated_by เพราะเป็นคำศัพท์คงที่ของระบบ และไปพ้องกับชื่อคอลัมน์)
    for (const row of rowsOf(statement.values)) {
      for (const column of CONTENT_VALUE_COLUMNS) {
        const value = row[indexOfColumn(column)];
        if (typeof value === "string" && value.length > 3) {
          assert.ok(
            !statement.text.includes(value),
            `พบค่าจริงปนใน SQL (${column}): ${value.slice(0, 24)} — ต้องใช้ parameter เท่านั้น`,
          );
        }
      }
    }
    // ชื่อคีย์/ชื่อ section ก็ต้องเป็น parameter เช่นกัน
    assert.ok(!statement.text.includes("hello"), "ไม่มีข้อความทดสอบปน");
    assert.ok(!statement.text.includes("hero"), "ชื่อ section ต้องเป็น parameter ไม่ใช่ต่อสตริง");
  }
});

test("sql: จำนวน placeholder ตรงกับจำนวนค่าที่ส่ง", () => {
  for (const statement of allStatements()) {
    const placeholders = statement.text.match(/\$\d+/g) ?? [];
    assert.equal(placeholders.length, statement.values.length, "placeholder กับค่า ต้องมีจำนวนเท่ากัน");
    // ต้องเรียง $1..$n ไม่ข้าม
    const numbers = placeholders.map((token) => Number.parseInt(token.slice(1), 10));
    assert.deepEqual(
      numbers,
      numbers.map((_, index) => index + 1),
      "ลำดับ placeholder ต้องเรียงต่อเนื่อง",
    );
  }
});

test("sql: เขียนครบทุกฟิลด์ที่โมเดลประกาศ (ไม่ตกหล่นและไม่เกิน)", () => {
  const rows = allStatements().flatMap((statement) => rowsOf(statement.values));
  assert.equal(countRows(allStatements()), rows.length, "countRows ต้องตรงกับจำนวนแถวจริง");

  const written = new Set(rows.map((row) => keyOf(row[indexOfColumn("section")], row[indexOfColumn("item_key")], row[indexOfColumn("field")])));

  const expected: string[] = [];
  for (const section of HOME_PAGE_SPEC.sections) {
    for (const field of section.fields) {
      expected.push(keyOf(section.key, "", field.key));
    }
    for (const group of section.items) {
      const itemRows = HOME_SEED.sections[section.key]?.items[group.key] ?? [];
      for (const item of itemRows) {
        for (const field of group.fields) {
          expected.push(keyOf(section.key, itemKeyOf(group.key, item.order), field.key));
        }
      }
    }
  }

  assert.deepEqual([...written].sort(), [...new Set(expected)].sort(), "ชุดฟิลด์ที่เขียนต้องตรงกับที่โมเดล+seed กำหนด");
  assert.equal(rows.length, expected.length, "จำนวนแถวต้องเท่ากับที่โมเดล+seed กำหนด");
});

test("sql: ฟิลด์ระดับ section ใช้ item_key ว่าง และ item_order เป็น null", () => {
  const sectionFieldRows = allStatements()
    .flatMap((statement) => rowsOf(statement.values))
    .filter((row) => row[indexOfColumn("item_order")] === null && row[indexOfColumn("item_key")] === "");

  assert.ok(sectionFieldRows.length > 0, "ต้องมีแถวของฟิลด์ระดับ section");
  for (const row of sectionFieldRows) {
    assert.equal(row[indexOfColumn("th")] !== null || row[indexOfColumn("media_path")] !== null, true);
  }
});

test("sql: ฟิลด์ภาพเก็บพาธลงคอลัมน์ media_* และไม่เก็บ URL เต็ม (มติ D9)", () => {
  const mediaRows = allStatements()
    .flatMap((statement) => rowsOf(statement.values))
    .filter((row) => row[indexOfColumn("kind")] === "media");

  assert.ok(mediaRows.length > 0, "ต้องมีแถวของฟิลด์ภาพ");

  const withFile = mediaRows.filter((row) => row[indexOfColumn("media_path")] !== null);
  const withoutFile = mediaRows.filter((row) => row[indexOfColumn("media_path")] === null);

  assert.ok(withFile.length > 0, "ต้องมีแถวภาพที่มีไฟล์ (ปัจจุบัน: สไลด์ 3 ใบ + การ์ดประกาศ)");

  for (const row of withFile) {
    const path = row[indexOfColumn("media_path")];
    assert.equal(typeof path, "string", "ต้องมีพาธของไฟล์");
    assert.ok(typeof path === "string" && path.startsWith("/"), `พาธต้องขึ้นต้นด้วย / (ได้: ${String(path)})`);
    assert.ok(typeof path === "string" && !path.includes("://"), "ห้ามเก็บ URL เต็ม");
    assert.equal(row[indexOfColumn("th")], null, "ฟิลด์ภาพไม่ใช้คอลัมน์ th");
    assert.equal(typeof row[indexOfColumn("media_alt_th")], "string", "ต้องมี alt ภาษาไทย (มติ D7)");
  }

  // ช่องภาพที่ยังไม่มีไฟล์ (เช่น การ์ดเมนูอาหาร) → เขียนแถวไว้โดย media_path เป็น null
  // เจตนา: การ seed ต้องเป็น "สถานะจริงทั้งหน้า" ไม่ใช่เพิ่มอย่างเดียว → ลบภาพแล้วต้องหายจาก DB ด้วย
  for (const row of withoutFile) {
    assert.equal(row[indexOfColumn("media_alt_th")], null, "แถวที่ไม่มีไฟล์ต้องไม่มี alt ค้าง");
  }
});

test("sql: แถวภาพที่ติดลายน้ำถูกบันทึกธงไว้ (ต้องไม่เผยแพร่จนกว่าจะเปลี่ยนภาพ)", () => {
  const watermarked = allStatements()
    .flatMap((statement) => rowsOf(statement.values))
    .filter((row) => row[indexOfColumn("media_has_watermark")] === true);

  // ปัจจุบันมี 2 ภาพที่ติดลายน้ำ (สไลด์ event2 + โปสเตอร์การ์ด) — ตรงกับคำเตือนใน check:content
  assert.equal(watermarked.length, 2, "ต้องบันทึกธงลายน้ำครบตามที่พบในข้อมูล");
});

test("sql: ทุกแถวบันทึกว่าใครแก้ (updated_by) และใช้ค่าจาก seed", () => {
  const rows = allStatements().flatMap((statement) => rowsOf(statement.values));
  for (const row of rows) {
    assert.equal(row[indexOfColumn("updated_by")], SEED_ACTOR);
  }
});

test("sql: เพิ่มรายการเมนู 1 ใบ = เพิ่มแถวตามจำนวนฟิลด์ของกลุ่มนั้น", () => {
  const before = countRows(allStatements());
  const extra = structuredClone(HOME_SEED) as unknown as {
    sections: Record<string, { items: Record<string, { order: number; fields: Record<string, { th: string; en: string }>; media: Record<string, unknown> }[]> }>;
  };
  const recipes = extra.sections.recipes;
  assert.ok(recipes);
  const group = recipes.items.recipes;
  assert.ok(group);
  group.push({
    order: group.length + 1,
    fields: { name: { th: "เมนูใหม่", en: "" }, description: { th: "ทดสอบ", en: "" } },
    media: {},
  });

  const recipeFieldCount = HOME_PAGE_SPEC.sections
    .find((section) => section.key === "recipes")
    ?.items.find((item) => item.key === "recipes")?.fields.length;
  assert.ok(recipeFieldCount, "ต้องรู้จำนวนฟิลด์ของกลุ่มเมนูอาหาร");

  const after = countRows(buildUpsertStatements(HOME_PAGE_SPEC, extra as unknown as PageContent, SEED_ACTOR));
  assert.equal(after, before + recipeFieldCount, "รายการใหม่ 1 ใบ = เพิ่มแถวเท่าจำนวนฟิลด์ของกลุ่ม");
});

test("sql: ห้ามมีคีย์ซ้ำภายในคำสั่งเดียว (Postgres ปฏิเสธทั้งคำสั่ง — เคสจริง 2026-10-02)", () => {
  /* เคสจริง: เดิม item_key ของทุกรายการใช้ "ชื่อกลุ่ม" → คีย์ (page, section, item_key, field) ซ้ำ
     Postgres ตอบ SQLSTATE 21000 `ON CONFLICT DO UPDATE command cannot affect row a second time`
     เทสต์นี้คือด่านที่ควรมีตั้งแต่แรก เพราะเทสต์ที่ตั้งความหวังตามโค้ดจะไม่จับบั๊กชนิดนี้ */
  for (const [index, statement] of allStatements().entries()) {
    const keys = rowsOf(statement.values).map((row) =>
      keyOf(row[indexOfColumn("section")], row[indexOfColumn("item_key")], row[indexOfColumn("field")]),
    );
    const unique = new Set(keys);
    assert.equal(unique.size, keys.length, `คำสั่งที่ ${index} มีคีย์ซ้ำ (${keys.length} แถว แต่คีย์ไม่ซ้ำ ${unique.size})`);
  }
});

test("sql: รายการแต่ละตัวต้องมี item_key ของตัวเอง (ไม่ใช่ชื่อกลุ่ม)", () => {
  for (const section of HOME_PAGE_SPEC.sections) {
    for (const group of section.items) {
      const items = HOME_SEED.sections[section.key]?.items[group.key] ?? [];
      if (items.length < 2) continue;

      const keys = new Set(items.map((item) => itemKeyOf(group.key, item.order)));
      assert.equal(keys.size, items.length, `${section.key}.${group.key}: ${items.length} รายการต้องมี ${items.length} คีย์`);
      assert.ok(!keys.has(group.key), `${section.key}.${group.key}: ห้ามใช้ชื่อกลุ่มเป็นคีย์รายการ`);
    }
  }
});

test("sql: คีย์รวมทั้งหน้าต้องไม่ซ้ำเลย (ข้ามคำสั่ง) — เคสจริง: เขียน 140 แถว แต่ตารางเหลือ 131", () => {
  /* เคสจริง 2026-10-02: `hero` มี 2 กลุ่ม (slides + card) ที่ต่างก็เริ่มที่ item-1 → เขียนทับกันเงียบ ๆ
     ไม่มี error จาก DB จับได้เพราะ "จำนวนแถวที่เขียน" ไม่เท่ากับ "จำนวนแถวในตาราง" */
  const all = allStatements().flatMap((statement) => rowsOf(statement.values));
  const keys = all.map((row) => keyOf(row[indexOfColumn("section")], row[indexOfColumn("item_key")], row[indexOfColumn("field")]));
  const unique = new Set(keys);

  assert.equal(unique.size, keys.length, `เขียน ${keys.length} แถว แต่คีย์ไม่ซ้ำ ${unique.size} → มีการเขียนทับกัน`);
  assert.equal(countRows(allStatements()), unique.size, "countRows ต้องเท่ากับจำนวนคีย์จริง");

  // section เดียวกันที่มีหลายกลุ่ม → item_key ต้องไม่ชนกันข้ามกลุ่ม
  for (const section of HOME_PAGE_SPEC.sections) {
    if (section.items.length < 2) continue;
    const itemKeys = all
      .filter((row) => row[indexOfColumn("section")] === section.key && row[indexOfColumn("item_key")] !== "")
      .map((row) => String(row[indexOfColumn("item_key")]));
    const groups = new Set(itemKeys.map((itemKey) => itemKey.split("-")[0] ?? ""));
    assert.ok(groups.size >= 2, `${section.key}: ต้องมีคีย์ของทั้ง ${section.items.length} กลุ่ม`);
    assert.equal(new Set(itemKeys).size <= itemKeys.length, true);
  }
});
