import type { Block, BlockDocument } from "@/lib/blocks/types";
import { listRecipes, type RecipeRecord } from "@/lib/recipes/repository";

/**
 * โหลดเมนูจริงให้ **บล็อกไดนามิก "เมนูล่าสุด"** — รอบที่ 222 (คิวข้อ 3)
 * ตัวเรนเดอร์ถูกใช้ในพรีวิวที่แก้ได้ (client) ⇒ **ห้ามยิงฐานข้อมูลเอง**; ผู้เรียกโหลดให้แล้วส่งลงมา
 * ไม่มีบล็อกชนิดนี้ในเอกสาร = **ไม่ยิง query เลย** · ไม่มี DB/อ่านพัง = null (หน้าเว็บไม่พัง)
 */
export type RecipeShowcaseData = { readonly recipes: readonly RecipeRecord[] };

export async function loadRecipeShowcaseData(document: BlockDocument | null): Promise<RecipeShowcaseData | null> {
  if (collectRecipeShowcaseBlocks(document?.blocks ?? []).length === 0) return null;
  try {
    return { recipes: await listRecipes() };
  } catch {
    return null;
  }
}

/** เก็บบล็อกชนิดนี้จากเอกสาร (รวมบล็อกที่ซ้อนใน "แถว/คอลัมน์") */
export function collectRecipeShowcaseBlocks(blocks: readonly Block[]): readonly Block[] {
  const found: Block[] = [];
  for (const block of blocks) {
    if (block.type === "recipeShowcase") {
      found.push(block);
      continue;
    }
    if (block.type === "row") {
      for (const column of block.columns) found.push(...collectRecipeShowcaseBlocks(column.blocks));
    }
  }
  return found;
}
