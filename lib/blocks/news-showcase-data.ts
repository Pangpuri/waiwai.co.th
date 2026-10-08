import type { Block, BlockDocument } from "@/lib/blocks/types";
import { listNews, type NewsRecord } from "@/lib/news/repository";

/**
 * โหลดข่าวจริงให้ **บล็อกไดนามิก "ข่าวล่าสุด"** — รอบที่ 223 (คิวข้อ 4)
 * ตัวเรนเดอร์ถูกใช้ในพรีวิวที่แก้ได้ (client) ⇒ **ห้ามยิงฐานข้อมูลเอง**
 * ไม่มีบล็อกชนิดนี้ = ไม่ยิง query · ไม่มี DB/อ่านพัง = null (หน้าเว็บไม่พัง)
 */
export type NewsShowcaseData = { readonly news: readonly NewsRecord[] };

export async function loadNewsShowcaseData(document: BlockDocument | null): Promise<NewsShowcaseData | null> {
  if (collectNewsShowcaseBlocks(document?.blocks ?? []).length === 0) return null;
  try {
    return { news: await listNews() };
  } catch {
    return null;
  }
}

/** เก็บบล็อกชนิดนี้จากเอกสาร (รวมบล็อกที่ซ้อนใน "แถว/คอลัมน์") */
export function collectNewsShowcaseBlocks(blocks: readonly Block[]): readonly Block[] {
  const found: Block[] = [];
  for (const block of blocks) {
    if (block.type === "newsShowcase") {
      found.push(block);
      continue;
    }
    if (block.type === "row") {
      for (const column of block.columns) found.push(...collectNewsShowcaseBlocks(column.blocks));
    }
  }
  return found;
}
