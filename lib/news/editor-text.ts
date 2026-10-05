import {
  MAX_NEWS_BLOCKS,
  MAX_NEWS_IMAGES,
  MAX_NEWS_TEXT_LENGTH,
  type NewsBlock,
} from "@/lib/news/body";

/**
 * ตัวแปลง "ข้อความในช่องเดียว" ↔ "บล็อกเนื้อหาข่าว" (รอบที่ 123) — pure ล้วน (ทดสอบได้โดยไม่ต้องมี DB/React)
 *
 * ทำไมต้องมี: เจ้าของเลือกให้แก้เนื้อหาข่าวด้วย **ฟอร์มง่าย** (ช่องข้อความยาว) ไม่ใช่ตัวแก้แบบบล็อก
 * แต่ข้อมูลที่นำเข้ามา (151 ข่าว) เก็บเป็น **บล็อก JSONB** (`paragraph` / `heading` / `image`)
 * ⇒ ต้องมีตัวแปลงสองทางที่ **ไป-กลับได้ไม่เพี้ยน** ไม่งั้นกดบันทึกแล้วเนื้อหาข่าวเดิมจะเสียรูป
 *
 * กติกามาร์กอัป (เรียบง่าย พอสำหรับงานข่าว — เหมือน WP classic editor)
 * - บรรทัดว่าง = ขึ้นย่อหน้าใหม่
 * - บรรทัดที่เริ่มด้วย `## ` = หัวข้อย่อย
 * - `[[img:<mediaId>|<alt>]]` = แทรกภาพจากคลัง (บรรทัดของตัวเอง — ระบบสร้างให้ตอนกด "แทรกภาพ")
 * - ข้อความอื่น = ย่อหน้าธรรมดา (ตัดช่องว่างหัวท้าย · ขึ้นบรรทัดใหม่ภายในย่อหน้าจะถูกยุบเป็นช่องว่างเดียว)
 */

export const NEWS_IMAGE_TOKEN_PREFIX = "[[img:";

/** สร้างโทเคนแทรกภาพ (ใช้ในหน้าจอหลังบ้าน) */
export function newsImageToken(mediaId: string, alt = ""): string {
  const id = mediaId.trim();
  const text = alt.trim().replace(/[|\]]/g, "").slice(0, 200);
  return `${NEWS_IMAGE_TOKEN_PREFIX}${id}|${text}]]`;
}

/** อ่านโทเคนภาพจากบรรทัด (null = บรรทัดนี้ไม่ใช่โทเคนภาพ) */
export function parseNewsImageToken(line: string): { readonly mediaId: string; readonly alt: string } | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith(NEWS_IMAGE_TOKEN_PREFIX) || !trimmed.endsWith("]]")) return null;

  const inner = trimmed.slice(NEWS_IMAGE_TOKEN_PREFIX.length, -2);
  const [rawId = "", ...rest] = inner.split("|");
  const mediaId = rawId.trim();
  if (mediaId === "") return null;

  return { mediaId, alt: rest.join("|").trim() };
}

/** บล็อก → ข้อความในช่องเดียว (ใช้ตอนเปิดหน้าจอแก้ไข) */
export function newsBlocksToText(blocks: readonly NewsBlock[]): string {
  return blocks
    .map((block) => {
      if (block.type === "heading") return `## ${block.text}`;
      if (block.type === "image") return newsImageToken(block.mediaId, block.alt);
      return block.text;
    })
    .join("\n\n");
}

/**
 * ข้อความ → บล็อก (ใช้ตอนบันทึก)
 * - ยุบหลายบรรทัดว่างติดกันเป็นตัวแบ่งย่อหน้าเดียว
 * - จำกัดจำนวนบล็อก/รูป/ความยาวตามเพดานกลาง (`lib/news/body.ts`) — ตัดส่วนเกินทิ้งอย่างเงียบ ๆ
 */
export function newsTextToBlocks(text: string): readonly NewsBlock[] {
  const blocks: NewsBlock[] = [];
  const chunks = text.replace(/\r\n?/g, "\n").split(/\n{2,}/);
  let imageCount = 0;

  for (const chunk of chunks) {
    const value = chunk.trim();
    if (value === "") continue;
    if (blocks.length >= MAX_NEWS_BLOCKS) break;

    const image = parseNewsImageToken(value);
    if (image !== null) {
      if (imageCount >= MAX_NEWS_IMAGES) continue;
      imageCount += 1;
      blocks.push({ type: "image", mediaId: image.mediaId, alt: image.alt });
      continue;
    }

    if (value.startsWith("## ")) {
      const heading = value.slice(3).trim();
      if (heading === "") continue;
      blocks.push({ type: "heading", text: heading.slice(0, MAX_NEWS_TEXT_LENGTH) });
      continue;
    }

    /* ย่อหน้าธรรมดา: ขึ้นบรรทัดใหม่ภายในย่อหน้า → ช่องว่างเดียว */
    const paragraph = value.replace(/\s*\n\s*/g, " ").trim();
    if (paragraph === "") continue;
    blocks.push({ type: "paragraph", text: paragraph.slice(0, MAX_NEWS_TEXT_LENGTH) });
  }

  return blocks;
}

/**
 * ตรวจว่าข้อความที่แปลงแล้ว "ครอบคลุม" สิ่งที่ผู้ใช้พิมพ์จริงไหม
 * ใช้เตือนในหน้าจอเมื่อมีบางอย่างถูกตัด (เกินเพดาน) — คืนจำนวนที่ถูกตัดไป
 */
export function newsTextLosses(text: string): { readonly droppedBlocks: number; readonly droppedImages: number } {
  const chunks = text
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk !== "");

  const blocks = newsTextToBlocks(text);
  const images = chunks.filter((chunk) => parseNewsImageToken(chunk) !== null).length;
  const keptImages = blocks.filter((block) => block.type === "image").length;

  return {
    droppedBlocks: Math.max(0, chunks.length - blocks.length),
    droppedImages: Math.max(0, images - keptImages),
  };
}
