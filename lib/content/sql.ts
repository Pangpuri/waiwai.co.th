import type { FieldSpec, ItemContent, LocalizedValue, MediaValue, PageContent, PageSpec } from "@/lib/content/types";

/**
 * แปลงเนื้อหา (โครงเดียวกับที่ validator ตรวจ) เป็น **SQL ที่ใช้ parameter ทุกค่า**
 *
 * กติกาความปลอดภัยของโปรเจกต์: *NEVER concatenate or interpolate user input into a query*
 * → โมดูลนี้ **ห้าม** ต่อสตริงค่าลงใน SQL เด็ดขาด (มีเทสต์ยืนยันว่าค่าจริงไม่ปรากฏในข้อความ SQL)
 *
 * ทำไมแยกเป็นโมดูลล้วน (ไม่เขียน SQL ในสคริปต์เลย)
 * - เทสต์ได้โดยไม่ต้องมีฐานข้อมูล → ด่าน 7 ตัวยังรันผ่านในเครื่อง/CI ที่ไม่มี DB
 * - สคริปต์ `scripts/seed-home.ts` เป็นแค่ตัวรัน (ต่อ DB แล้ว execute) ไม่มีตรรกะ
 * - มติ D9: เก็บ **พาธของไฟล์** ลงคอลัมน์เดียว (ไม่ประกอบ URL ในชั้นนี้)
 */

/** ลำดับคอลัมน์ของตาราง content_field — เทสต์ใช้ลำดับนี้ในการตรวจค่า */
export const CONTENT_FIELD_COLUMNS = [
  "page",
  "section",
  "item_key",
  "item_order",
  "field",
  "kind",
  "th",
  "en",
  "media_path",
  "media_alt_th",
  "media_alt_en",
  "media_has_watermark",
  "updated_by",
] as const;

export type SqlParam = string | number | boolean | null;

export type SqlStatement = {
  readonly text: string;
  readonly values: readonly SqlParam[];
};

type FieldRow = readonly SqlParam[];

function row(
  page: string,
  section: string,
  itemKey: string,
  itemOrder: number | null,
  field: FieldSpec,
  text: LocalizedValue | null,
  media: MediaValue | null,
  updatedBy: string,
): FieldRow {
  if (field.kind === "media") {
    return [
      page,
      section,
      itemKey,
      itemOrder,
      field.key,
      field.kind,
      null,
      null,
      media === null ? null : media.path,
      media === null ? null : media.altTh,
      media === null ? null : media.altEn,
      media !== null && media.hasWatermark,
      updatedBy,
    ];
  }
  return [
    page,
    section,
    itemKey,
    itemOrder,
    field.key,
    field.kind,
    text === null ? null : text.th,
    text === null ? null : text.en,
    null,
    null,
    null,
    false,
    updatedBy,
  ];
}

function statementFromRows(rows: readonly FieldRow[]): SqlStatement {
  const values: SqlParam[] = [];
  const tuples: string[] = [];

  for (const fieldRow of rows) {
    const placeholders = fieldRow.map((value) => {
      values.push(value);
      return `$${values.length}`;
    });
    tuples.push(`  (${placeholders.join(", ")})`);
  }

  const text =
    `insert into content_field\n  (${CONTENT_FIELD_COLUMNS.join(", ")})\nvalues\n` +
    `${tuples.join(",\n")}\n` +
    "on conflict (page, section, item_key, field) do update set\n" +
    "  item_order = excluded.item_order,\n" +
    "  kind = excluded.kind,\n" +
    "  th = excluded.th,\n" +
    "  en = excluded.en,\n" +
    "  media_path = excluded.media_path,\n" +
    "  media_alt_th = excluded.media_alt_th,\n" +
    "  media_alt_en = excluded.media_alt_en,\n" +
    "  media_has_watermark = excluded.media_has_watermark,\n" +
    "  updated_at = now(),\n" +
    "  updated_by = excluded.updated_by";

  return { text, values };
}

function sectionFieldRows(
  page: string,
  sectionKey: string,
  fields: readonly FieldSpec[],
  content: PageContent,
  updatedBy: string,
): readonly FieldRow[] {
  const sectionContent = content.sections[sectionKey];
  return fields.map((field) =>
    row(page, sectionKey, "", null, field, sectionContent?.fields[field.key] ?? null, null, updatedBy),
  );
}

/**
 * คีย์ของรายการหนึ่งตัวในตาราง (คอลัมน์ `item_key`) = `<ชื่อกลุ่ม>-<ลำดับ>`
 *
 * ⚠️ **บทเรียนที่เจอจริง 2026-10-02 (สองชั้น)**
 *   1. เดิมส่ง "ชื่อกลุ่ม" เป็น `item_key` ของ **ทุก** รายการ → คีย์หลัก `(page, section, item_key, field)` ซ้ำกัน
 *      → Postgres ปฏิเสธทั้งคำสั่ง (SQLSTATE 21000 `ON CONFLICT DO UPDATE command cannot affect row a second time`)
 *   2. แก้รอบแรกเป็น `item-<ลำดับ>` → ผ่าน DB แต่ **ยังไม่พอ**: section เดียวกันอาจมีหลายกลุ่ม
 *      (เช่น `hero` มี `slides` + `card`) แล้ว `item-1` ของสองกลุ่มชนกัน → ข้อมูลทับกันเงียบ ๆ
 *      (เขียน 140 แถว แต่ในตารางเหลือ 131 = มี 9 คีย์ที่ถูกเขียนทับ) · จับได้เพราะ "ตัวเลขไม่ตรง" ไม่ใช่เพราะ error
 * ⇒ คีย์ต้องมี **ชื่อกลุ่ม** นำหน้าเสมอ (ไม่ซ้ำกันข้ามกลุ่ม) และอ่านกลับได้โดยไม่ต้องมีคอลัมน์เพิ่ม
 */
export function itemKeyOf(groupKey: string, order: number): string {
  return `${groupKey}-${order}`;
}

/** ชื่อกลุ่มของรายการที่อ่านจากคีย์ — คืน null ถ้าคีย์ไม่ตรงกับกลุ่มที่ประกาศไว้ (ข้อมูลแปลกปลอม) */
export function groupKeyOfItem(itemKey: string, knownGroupKeys: readonly string[]): string | null {
  for (const groupKey of knownGroupKeys) {
    if (itemKey.startsWith(`${groupKey}-`)) return groupKey;
  }
  return null;
}

function itemRows(
  page: string,
  sectionKey: string,
  groupKey: string,
  fields: readonly FieldSpec[],
  rows: readonly ItemContent[],
  updatedBy: string,
): readonly FieldRow[] {
  const ordered = [...rows].sort((a, b) => a.order - b.order);
  const result: FieldRow[] = [];

  for (const item of ordered) {
    for (const field of fields) {
      result.push(
        row(
          page,
          sectionKey,
          itemKeyOf(groupKey, item.order),
          item.order,
          field,
          (item.fields[field.key] as LocalizedValue | undefined) ?? null,
          (item.media[field.key] as MediaValue | undefined) ?? null,
          updatedBy,
        ),
      );
    }
  }

  return result;
}

/**
 * สร้างคำสั่ง SQL สำหรับ upsert เนื้อหาทั้งหน้า
 * - 1 คำสั่งต่อ 1 หน่วย (ฟิลด์ระดับ section ของ section หนึ่ง · หรือหนึ่งกลุ่มรายการ)
 * - รันซ้ำได้ (idempotent) ด้วย `on conflict … do update`
 */
export function buildUpsertStatements(
  spec: PageSpec,
  content: PageContent,
  updatedBy: string,
): readonly SqlStatement[] {
  const statements: SqlStatement[] = [];

  for (const section of spec.sections) {
    if (section.fields.length > 0) {
      statements.push(statementFromRows(sectionFieldRows(spec.page, section.key, section.fields, content, updatedBy)));
    }

    for (const group of section.items) {
      const rows = content.sections[section.key]?.items[group.key] ?? [];
      if (rows.length === 0) continue;
      statements.push(
        statementFromRows(itemRows(spec.page, section.key, group.key, group.fields, rows, updatedBy)),
      );
    }
  }

  return statements;
}

/** จำนวนแถวทั้งหมดที่คำสั่งชุดนี้จะเขียน (ใช้ในสคริปต์ seed และเทสต์) */
export function countRows(statements: readonly SqlStatement[]): number {
  return statements.reduce((total, statement) => total + statement.values.length / CONTENT_FIELD_COLUMNS.length, 0);
}

/** ค่าเริ่มต้นของ "ใครแก้" สำหรับการ seed ครั้งแรก (ไม่ใช่ข้อมูลส่วนบุคคลของคนจริง) */
export const SEED_ACTOR = "seed";
