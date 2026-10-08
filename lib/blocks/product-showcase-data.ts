import type { Block, BlockDocument } from "@/lib/blocks/types";
import { productShowcaseView, type ProductShowcaseView } from "@/lib/blocks/product-showcase";
import { listProductCategoryCards, listProductHighlights } from "@/lib/products/repository";
import type { Language } from "@/lib/content/home-section";

/**
 * โหลดข้อมูลจริงให้ **บล็อกไดนามิก "หมวดสินค้า + สินค้าแนะนำ"** — รอบที่ 212 (ขั้น 2 ส่วน ข)
 *
 * ทำไมแยกไฟล์: ตัวเรนเดอร์ (`block-renderer.tsx`) ถูกใช้ทั้งฝั่งเซิร์ฟเวอร์และใน "พรีวิวที่แก้ได้" (client)
 * ⇒ **ห้ามให้ตัวเรนเดอร์ยิงฐานข้อมูลเอง** ต้องมีคนโหลดข้อมูลให้แล้วส่งลงไปเป็น props
 *   (ที่เดียว = หน้านี้ แล้วส่งต่อผ่าน `BlockDocumentView` → `BlockRenderer`)
 *
 * กติกา: ไม่มี DB/อ่านพัง = คืน map ว่าง ⇒ บล็อกไดนามิกจะไม่เรนเดอร์ (หน้าเว็บไม่พัง)
 */
export async function loadProductShowcasesFor(
  document: BlockDocument | null,
  language: Language,
): Promise<Readonly<Record<string, ProductShowcaseView>>> {
  const blocks = collectShowcaseBlocks(document?.blocks ?? []);
  if (blocks.length === 0) return {};

  try {
    const [categories, highlights] = await Promise.all([listProductCategoryCards(), listProductHighlights()]);
    const views: Record<string, ProductShowcaseView> = {};
    for (const block of blocks) {
      if (block.type !== "productShowcase") continue;
      views[block.id] = productShowcaseView(categories, highlights, block, language);
    }
    return views;
  } catch {
    return {};
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
