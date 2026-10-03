import type { PageContent, PageSpec, ItemContent, LocalizedValue, MediaValue } from "@/lib/content/types";
import { groupKeyOfItem, itemKeyOf } from "@/lib/content/sql";

/**
 * แปลง "แถวจากฐานข้อมูล" ↔ "โครงเนื้อหา" (ตรรกะล้วน ทดสอบได้ ไม่ต้องมี DB)
 *
 * ตาราง `content_field` เก็บ 1 แถว = 1 ฟิลด์ (EAV) เพราะต้องรองรับ "เพิ่ม/ลบรายการ" ได้อิสระ
 * ชั้นนี้จึงทำหน้าที่ประกอบกลับเป็นโครงที่หน้าเว็บและฟอร์มเข้าใจ (PageContent)
 *
 * หลักการที่บังคับ
 * - **ไม่โยน exception กับข้อมูลที่แปลกปลอม** — แถวที่ไม่รู้จัก (section/field/group) ให้ข้ามและรายงานกลับ
 *   (ข้อมูลใน DB อาจมาจากการเปลี่ยนโครงในอนาคต · ห้ามทำให้หน้าหลังบ้านล่ม)
 * - ลำดับรายการใช้ `item_order` (ไม่ใช่ลำดับที่ DB คืนมา) เพื่อให้เหมือนเดิมทุกครั้ง
 */

/** แถวของ `content_field` ในรูปที่ชั้นนี้ต้องการ (ไม่ผูกกับ pg เพื่อให้เทสต์ได้) */
export type ContentRow = {
  readonly section: string;
  readonly itemKey: string;
  readonly itemOrder: number | null;
  readonly field: string;
  readonly kind: string;
  readonly th: string | null;
  readonly en: string | null;
  readonly mediaPath: string | null;
  readonly mediaAltTh: string | null;
  readonly mediaAltEn: string | null;
  readonly mediaHasWatermark: boolean | null;
};

export type AssembleResult = {
  readonly content: PageContent;
  /** คีย์ใน DB ที่โครงปัจจุบันไม่รู้จัก (ควรถูกลบตอนบันทึก) */
  readonly unknownKeys: readonly string[];
};

function textValue(row: ContentRow): LocalizedValue {
  return { th: row.th ?? "", en: row.en ?? "" };
}

/** ฟิลด์ภาพที่มีไฟล์จริงเท่านั้น → คืน MediaValue · ไม่มีไฟล์ = ไม่มีค่า (เหมือนตอน seed) */
function mediaValue(row: ContentRow): MediaValue | null {
  if (row.mediaPath === null || row.mediaPath === "") return null;
  return {
    path: row.mediaPath,
    altTh: row.mediaAltTh ?? "",
    altEn: row.mediaAltEn ?? "",
    hasWatermark: row.mediaHasWatermark ?? false,
  };
}

/**
 * ตัวสะสมชั่วคราว — ใช้ชนิดที่เขียนได้ (mutable) เพราะ `ItemContent` ของจริงเป็น readonly
 * แล้วค่อยสร้างออบเจ็กต์ readonly ตอน push (ทำให้ชนิดปลายทางยังกันการแก้พลาด)
 */
type SectionAccumulator = {
  readonly fields: Record<string, LocalizedValue>;
  readonly items: Record<string, ItemContent[]>;
};

type ItemAccumulator = {
  readonly sectionKey: string;
  readonly groupKey: string;
  readonly order: number;
  readonly fields: Record<string, LocalizedValue>;
  readonly media: Record<string, MediaValue>;
};

export function assemblePageContent(spec: PageSpec, rows: readonly ContentRow[]): AssembleResult {
  const sections: Record<string, SectionAccumulator> = {};
  const unknownKeys: string[] = [];

  for (const section of spec.sections) {
    const accumulator: SectionAccumulator = { fields: {}, items: {} };
    for (const group of section.items) {
      accumulator.items[group.key] = [];
    }
    sections[section.key] = accumulator;
  }

  const itemAccumulator = new Map<string, ItemAccumulator>();

  for (const row of rows) {
    const section = spec.sections.find((candidate) => candidate.key === row.section);
    if (section === undefined) {
      unknownKeys.push(`${row.section}|${row.itemKey}|${row.field}`);
      continue;
    }

    const target = sections[row.section];
    if (target === undefined) {
      unknownKeys.push(`${row.section}|${row.itemKey}|${row.field}`);
      continue;
    }

    if (row.itemKey === "") {
      const field = section.fields.find((candidate) => candidate.key === row.field);
      if (field === undefined) {
        unknownKeys.push(`${row.section}|${row.itemKey}|${row.field}`);
        continue;
      }
      target.fields[row.field] = textValue(row);
      continue;
    }

    const groupKey = groupKeyOfItem(row.itemKey, section.items.map((group) => group.key));
    const group = groupKey === null ? undefined : section.items.find((candidate) => candidate.key === groupKey);
    if (group === undefined) {
      unknownKeys.push(`${row.section}|${row.itemKey}|${row.field}`);
      continue;
    }

    const field = group.fields.find((candidate) => candidate.key === row.field);
    if (field === undefined) {
      unknownKeys.push(`${row.section}|${row.itemKey}|${row.field}`);
      continue;
    }

    const accumulatorKey = `${row.section}|${row.itemKey}`;
    let entry = itemAccumulator.get(accumulatorKey);
    if (entry === undefined) {
      entry = {
        sectionKey: row.section,
        groupKey: group.key,
        order: row.itemOrder ?? Number.parseInt(row.itemKey.slice(group.key.length + 1), 10),
        fields: {},
        media: {},
      };
      itemAccumulator.set(accumulatorKey, entry);
    }

    if (field.kind === "media") {
      const media = mediaValue(row);
      if (media !== null) entry.media[row.field] = media;
    } else {
      entry.fields[row.field] = textValue(row);
    }
  }

  for (const entry of itemAccumulator.values()) {
    const target = sections[entry.sectionKey]?.items[entry.groupKey];
    if (target === undefined) continue;
    target.push({
      order: Number.isFinite(entry.order) ? entry.order : target.length + 1,
      fields: entry.fields,
      media: entry.media,
    });
  }

  for (const target of Object.values(sections)) {
    for (const list of Object.values(target.items)) {
      list.sort((a, b) => a.order - b.order);
    }
  }

  return { content: { page: spec.page, sections }, unknownKeys };
}

/**
 * คีย์สามส่วนแบบเดียวกับที่ฐานข้อมูลประกอบ (`section|item_key|field`)
 *
 * ⚠️ **บทเรียนที่เจอจริง 2026-10-02:** `planOrphanKeys` เดิมสร้างคีย์ระดับ section เป็น `section|field` (2 ส่วน)
 * แต่ DB ใช้ `section||field` (3 ส่วน — `item_key` ของระดับ section เป็นค่าว่าง) → ไม่ตรงกัน
 * → แถวระดับ section ทั้ง 36 แถวถูกมองเป็น "แถวกำพร้า" แล้ว **ถูกลบทิ้ง** (140 → 104 แถว)
 * โดยไม่มี error จาก DB เลย · จับได้เพราะ "จำนวนแถวไม่ตรง" ⇒ ห้ามประกอบคีย์เองที่อื่น ให้เรียกฟังก์ชันนี้เท่านั้น
 */
export function rowKeyOf(section: string, itemKey: string, field: string): string {
  return `${section}|${itemKey}|${field}`;
}

/**
 * คีย์ใน DB ที่ไม่ปรากฏในเนื้อหาปัจจุบัน → ต้อง **ลบ** ตอนบันทึก
 * (สำคัญ: ถ้าไม่ลบ การลบรายการในหน้าจอจะไม่จริง — แถวเก่าจะค้างและกลับมาแสดงอีก)
 */
export function planOrphanKeys(
  spec: PageSpec,
  content: PageContent,
  existingKeys: readonly string[],
): readonly string[] {
  const wanted = new Set<string>();

  for (const section of spec.sections) {
    for (const field of section.fields) {
      wanted.add(rowKeyOf(section.key, "", field.key));
    }

    const items = content.sections[section.key]?.items;
    for (const group of section.items) {
      const list = items?.[group.key] ?? [];
      for (const item of list) {
        for (const field of group.fields) {
          wanted.add(rowKeyOf(section.key, itemKeyOf(group.key, item.order), field.key));
        }
      }
    }
  }

  return existingKeys.filter((key) => !wanted.has(key));
}
