import { walkBlocks, type Block, type BlockDocument } from "@/lib/blocks/types";
import type { LocalizedValue } from "@/lib/content/types";

/**
 * "สารบัญของหน้า" (X1.8 · เลย์เอาต์ `sidebar`)
 *
 * ทำไมสร้างอัตโนมัติจากบล็อก (ไม่ให้ผู้ใช้กรอกเอง)
 * - ผู้ใช้วางหัวข้อในบล็อกอยู่แล้ว ⇒ สารบัญที่กรอกซ้ำจะหลุดจากเนื้อหาทันทีที่มีคนแก้หัวข้อ
 * - ไม่ต้องมีโมเดลข้อมูลใหม่ (ไม่มี migration) และใช้ได้ทั้งพรีวิวหลังบ้านกับหน้าเว็บจริง (ตรรกะล้วน)
 *
 * หลักการ
 * - เดินทุกบล็อกด้วย `walkBlocks()` ตัวเดียวกับ validator/ตัวย้ายรุ่น ⇒ บล็อกที่ซ้อนในคอลัมน์ก็มีสารบัญ
 * - เอาเฉพาะบล็อกที่มี "หัวข้อ" (hero/heading/richText/… ) · บล็อกที่ไม่มีหัวข้อ (divider/quote/row) ข้าม
 * - `id` ที่คืนคือ **id ของบล็อก** ซึ่งตัวเรนเดอร์ใช้เป็น anchor (`#<id>`) ให้อยู่แล้ว
 * - ข้อความใช้ภาษาที่ขอ ถ้ายังไม่มีคำแปลใช้ภาษาไทยก่อน (เหมือนตัวเรนเดอร์) — ค่าที่ว่างทั้งคู่ถูกข้าม
 */

export type OutlineLevel = 1 | 2;

export type OutlineEntry = {
  /** id ของบล็อก (ใช้เป็น anchor) */
  readonly id: string;
  readonly label: string;
  /** 1 = หัวข้อหลักของส่วน · 2 = หัวข้อย่อย (เฉพาะบล็อก `heading` ระดับ h3) */
  readonly level: OutlineLevel;
};

/**
 * จำนวนรายการสารบัญสูงสุด (กันสารบัญยาวจนอ่านไม่ไหวในหน้าเนื้อหาเยอะผิดปกติ)
 * ⚠️ รอบที่ 92: ยกจาก 20 → 60 (20 ตัดหน้าเนื้อหาปกติทิ้ง — หน้าที่มีหัวข้อเยอะจะได้สารบัญไม่ครบ)
 */
export const MAX_OUTLINE_ENTRIES = 60;

function localizedLabel(value: LocalizedValue, language: "th" | "en"): string {
  const primary = value[language].trim();
  if (primary !== "") return primary;
  return value.th.trim() !== "" ? value.th.trim() : value.en.trim();
}

/** ข้อความหัวข้อของบล็อก (null = บล็อกนี้ไม่มีหัวข้อ) */
function headingTextOf(block: Block): LocalizedValue | null {
  switch (block.type) {
    case "hero":
      return block.title;
    case "heading":
      return block.text;
    case "richText":
    case "imageText":
    case "cards":
    case "cta":
    case "table":
    case "map":
    case "gallery":
    case "jobBoard":
    case "rosterText":
    case "recipeCards":
    case "form":
      return block.heading;
    case "quote":
    case "divider":
    /* แถวเองไม่มีหัวข้อ — บล็อกลูกถูกเดินด้วย walkBlocks อยู่แล้ว */
    case "row":
      return null;
  }
}

/** สารบัญของเอกสาร (เรียงตามลำดับที่ปรากฏบนหน้า) */
export function pageOutline(document: BlockDocument, language: "th" | "en" = "th"): readonly OutlineEntry[] {
  const entries: OutlineEntry[] = [];

  for (const node of walkBlocks(document.blocks)) {
    if (entries.length >= MAX_OUTLINE_ENTRIES) break;

    const heading = headingTextOf(node.block);
    if (heading === null) continue;

    const label = localizedLabel(heading, language);
    if (label === "") continue;

    entries.push({
      id: node.block.id,
      label,
      level: node.block.type === "heading" && node.block.level === 3 ? 2 : 1,
    });
  }

  return entries;
}
