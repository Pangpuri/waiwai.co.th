import { cache } from "react";

import { parseBlockDocument } from "@/lib/blocks/parse";
import { isPageLive, loadDocumentRow } from "@/lib/blocks/repository";
import type { BlockDocument } from "@/lib/blocks/types";
import { documentErrorsOf, validateDocument } from "@/lib/blocks/validate";
import { isDatabaseConfigured } from "@/lib/content/repository";

/**
 * โหลด "เอกสารหน้าเว็บ" ฉบับที่เผยแพร่ **เพื่อใช้จริงบนหน้าเว็บสาธารณะ** (เซสชั่น S1)
 *
 * กติกาที่สำคัญ (เหมือนตัวโหลดป้ายประกาศ):
 * - ต้องมี `DATABASE_URL` · มีแถว `published` · ผ่าน parse + validate · และ **เปิดสวิตช์ `is_live`**
 * - ถ้าเงื่อนไขใดไม่ครบ → คืน `null` ⇒ หน้าเว็บกลับไปใช้เลย์เอาต์ที่ออกแบบไว้ **โดยไม่พัง**
 *   (สำคัญมาก: เดโมที่ไม่มีฐานข้อมูล/เซิร์ฟเวอร์ที่ฐานข้อมูลล่ม ต้องเปิดเว็บได้เสมอ)
 *
 * หน้าเว็บเป็น static (มติ D1) ⇒ การอ่านนี้เกิดตอน build · แก้แล้วต้อง rebuild (ปุ่มเผยแพร่สั่งให้แล้ว)
 */
export const loadLiveBlockDocument = cache(async (page: string): Promise<BlockDocument | null> => {
  if (!isDatabaseConfigured()) return null;

  try {
    if (!(await isPageLive(page))) return null;

    const row = await loadDocumentRow(page, "published");
    if (row === null) return null;

    const parsed = parseBlockDocument(page, row.raw);
    if (!parsed.ok) return null;
    if (documentErrorsOf(validateDocument(parsed.document)).length > 0) return null;
    if (parsed.document.blocks.length === 0) return null;

    return parsed.document;
  } catch {
    return null;
  }
});
