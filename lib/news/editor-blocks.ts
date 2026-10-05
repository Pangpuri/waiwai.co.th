import {
  MAX_NEWS_BLOCKS,
  MAX_NEWS_IMAGES,
  MAX_NEWS_TEXT_LENGTH,
  type NewsBlock,
} from "@/lib/news/body";

/**
 * "บล็อกสำหรับตัวแก้ข่าว" (รอบที่ 125) — pure ล้วน (ทดสอบได้โดยไม่ต้องมี DB/React)
 *
 * บริบท: เจ้าของทดลองใช้หลังบ้านแล้วบอกว่า **"ui ยังยากสำหรับคนไม่ได้สายเขียนเว็บ"**
 * (ไม่เห็นตัวอย่างภาพ · แทรกภาพผ่านชื่อไฟล์ · เห็นโทเคน `[[img:…]]`)
 * ⇒ เปลี่ยนจาก "ช่องข้อความยาว" เป็น **การ์ดเรียงลงมา** (ข้อความ / หัวข้อย่อย / ภาพ)
 *   ซึ่งตรงกับข้อมูลจริงที่นำเข้ามา (ภาพแทรกอยู่ระหว่างข้อความ ⇒ ห้ามย้ายไปรวมท้ายข่าว)
 *
 * หน้าที่ของโมดูลนี้
 * 1. `newsBlocksToEditor()` — แปลงบล็อกจากฐานข้อมูล → รายการสำหรับวาดการ์ด (มี id ชั่วคราวไว้ใช้เป็น key)
 * 2. `parseNewsEditorBlocks()` — **ตรวจค่าที่รับจากเบราว์เซอร์** (ห้ามเชื่อ) แล้วคืนบล็อกที่ปลอดภัย
 *    · ต้องมี mediaId จริงสำหรับภาพ · ตัดความยาว/จำนวนตามเพดานกลาง · ทิ้งรายการที่ว่างเปล่า
 *    · ภาพที่ไม่มีคำบรรยาย = ปล่อยว่างได้ (มติเจ้าของ: "ไม่บังคับ — ใส่ก็ได้ เว้นก็ได้")
 */

export type NewsEditorBlock =
  | { readonly id: string; readonly kind: "paragraph"; readonly text: string }
  | { readonly id: string; readonly kind: "heading"; readonly text: string }
  | { readonly id: string; readonly kind: "image"; readonly mediaId: string; readonly alt: string };

let editorBlockCounter = 0;

/** id ชั่วคราวสำหรับใช้เป็น `key` ของ React เท่านั้น (ไม่ถูกบันทึกลงฐานข้อมูล) */
function nextEditorId(): string {
  editorBlockCounter += 1;
  return `blk${String(editorBlockCounter)}`;
}

/** บล็อกจากฐานข้อมูล → รายการสำหรับตัวแก้ */
export function newsBlocksToEditor(blocks: readonly NewsBlock[]): readonly NewsEditorBlock[] {
  return blocks.map((block) => {
    if (block.type === "image") {
      return { id: nextEditorId(), kind: "image", mediaId: block.mediaId, alt: block.alt };
    }
    if (block.type === "heading") {
      return { id: nextEditorId(), kind: "heading", text: block.text };
    }
    return { id: nextEditorId(), kind: "paragraph", text: block.text };
  });
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * ตรวจค่าที่ส่งมาจากเบราว์เซอร์ (JSON ของรายการการ์ด) → บล็อกที่พร้อมบันทึก
 * - ไม่ใช่ array / โครงไม่ถูก = คืน `[]` (ผู้เรียกตัดสินใจว่าเป็น error)
 * - เพดาน: จำนวนบล็อก · จำนวนภาพ · ความยาวข้อความ (ตัดให้ ไม่ให้บันทึกพัง)
 * - ภาพที่ไม่มี mediaId (ค่าว่าง) = ทิ้งการ์ดนั้น (ไม่บันทึกภาพเปล่า)
 */
export function parseNewsEditorBlocks(raw: unknown): readonly NewsBlock[] {
  if (!Array.isArray(raw)) return [];

  const blocks: NewsBlock[] = [];
  let images = 0;

  for (const item of raw) {
    if (blocks.length >= MAX_NEWS_BLOCKS) break;
    if (typeof item !== "object" || item === null) continue;

    const record = item as Record<string, unknown>;
    const kind = readString(record["kind"]);

    if (kind === "image") {
      const mediaId = readString(record["mediaId"]);
      if (mediaId === "" || images >= MAX_NEWS_IMAGES) continue;
      images += 1;
      blocks.push({ type: "image", mediaId, alt: readString(record["alt"]).slice(0, 300) });
      continue;
    }

    const text = readString(record["text"]);
    if (text === "") continue;

    if (kind === "heading") {
      blocks.push({ type: "heading", text: text.slice(0, MAX_NEWS_TEXT_LENGTH) });
      continue;
    }

    blocks.push({ type: "paragraph", text: text.slice(0, MAX_NEWS_TEXT_LENGTH) });
  }

  return blocks;
}

/** นับภาพในตัวแก้ (ใช้แสดงผล/เตือนเมื่อใกล้เพดาน) */
export function countEditorImages(items: readonly NewsEditorBlock[]): number {
  return items.filter((item) => item.kind === "image").length;
}
