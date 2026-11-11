import { loadDocumentRow, publishDraft, saveJsonDraft } from "@/lib/blocks/repository";
import { isDatabaseConfigured } from "@/lib/content/repository";

import { parsePageCopy, type PageCopy, withPageCopyFallback } from "./model";

/**
 * ชั้นโหลด/บันทึกข้อความหัวหน้าหน้าเนื้อหา — ใช้ `page_document` คีย์ของแต่ละหน้า
 *
 * - ค่าเริ่มต้น = ข้อความจากพจนานุกรมของภาษานั้น (ผู้เรียกส่งมา)
 * - กดบันทึกจากหน้าจอหลังบ้าน = บันทึกฉบับร่าง + เผยแพร่ทันที
 * - คีย์แยกกันต่อหน้า ⇒ ไม่ไปเผยแพร่งานค้างของหน้าอื่น
 */

/** ค่าที่เว็บใช้จริง (published) — ไม่มี/อ่านไม่ได้ = fallback */
export async function loadPublishedPageCopy(key: string, fallback: PageCopy): Promise<PageCopy> {
  if (!isDatabaseConfigured()) return fallback;

  try {
    const row = await loadDocumentRow(key, "published");
    if (row === null) return fallback;
    const parsed = parsePageCopy(row.raw);
    return parsed === null ? fallback : withPageCopyFallback(parsed, fallback);
  } catch {
    return fallback;
  }
}

/** ค่าสำหรับหน้าจอแก้ไข — draft ก่อน แล้วค่อย published แล้วค่อย fallback */
export async function loadPageCopyForEditing(key: string, fallback: PageCopy): Promise<PageCopy> {
  if (!isDatabaseConfigured()) return fallback;

  try {
    const [draftRow, publishedRow] = await Promise.all([
      loadDocumentRow(key, "draft"),
      loadDocumentRow(key, "published"),
    ]);
    const draft = draftRow === null ? null : parsePageCopy(draftRow.raw);
    const published = publishedRow === null ? null : parsePageCopy(publishedRow.raw);
    const current = draft ?? published;
    return current === null ? fallback : withPageCopyFallback(current, fallback);
  } catch {
    return fallback;
  }
}

/** บันทึก + เผยแพร่ทันที (ปุ่มเดียวบนหน้าจอหลังบ้าน) */
export async function saveAndPublishPageCopy(key: string, copy: PageCopy, actor: string): Promise<void> {
  await saveJsonDraft(key, copy, actor);
  await publishDraft(key, actor, key);
}
