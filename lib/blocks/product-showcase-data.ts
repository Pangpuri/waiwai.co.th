import type { Block, BlockDocument } from "@/lib/blocks/types";
import { listProductCategoryCards, listProductHighlights, type ProductCategoryCardRecord, type ProductHighlightRecord } from "@/lib/products/repository";

/**
 * โหลดข้อมูลจริงให้ **บล็อกไดนามิก "หมวดสินค้า + สินค้าแนะนำ"** — รอบที่ 212 (ขั้น 2 ส่วน ข)
 *
 * ทำไมแยกไฟล์: ตัวเรนเดอร์ (`block-renderer.tsx`) ถูกใช้ทั้งฝั่งเซิร์ฟเวอร์และใน "พรีวิวที่แก้ได้" (client)
 * ⇒ **ห้ามให้ตัวเรนเดอร์ยิงฐานข้อมูลเอง** ต้องมีคนโหลดข้อมูลให้แล้วส่งลงไปเป็น props
 *   (ที่เดียว = หน้านี้ แล้วส่งต่อผ่าน `BlockDocumentView` → `BlockRenderer`)
 *
 * กติกา: ไม่มี DB/อ่านพัง = คืน map ว่าง ⇒ บล็อกไดนามิกจะไม่เรนเดอร์ (หน้าเว็บไม่พัง)
 */
/** ข้อมูลจริงที่บล็อกไดนามิกต้องใช้ (โหลดครั้งเดียวต่อการเรนเดอร์หนึ่งครั้ง) */
export type ProductShowcaseData = {
  readonly categories: readonly ProductCategoryCardRecord[];
  readonly highlights: readonly ProductHighlightRecord[];
};

/**
 * โหลดข้อมูลจริงสำหรับบล็อกไดนามิก — **ไม่ยิงฐานข้อมูลเลยถ้าเอกสารไม่มีบล็อกชนิดนั้น**
 * (ประหยัด query) · ไม่มี DB/อ่านพัง = `null` ⇒ บล็อกไดนามิกไม่เรนเดอร์ (หน้าเว็บไม่พัง)
 */
export async function loadProductShowcaseData(document: BlockDocument | null): Promise<ProductShowcaseData | null> {
  if (collectShowcaseBlocks(document?.blocks ?? []).length === 0) return null;
  try {
    const [categories, highlights] = await Promise.all([listProductCategoryCards(), listProductHighlights()]);
    return { categories, highlights };
  } catch {
    return null;
  }
}

/** เก็บบล็อกชนิดนี้จากเอกสาร (รวมบล็อกที่ซ้อนใน "แถว/คอลัมน์") */
export function collectShowcaseBlocks(blocks: readonly Block[]): readonly Block[] {
  const found: Block[] = [];
  for (const block of blocks) {
    if (block.type === "productShowcase") {
      found.push(block);
      continue;
    }
    if (block.type === "row") {
      for (const column of block.columns) found.push(...collectShowcaseBlocks(column.blocks));
    }
  }
  return found;
}
