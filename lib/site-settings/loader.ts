import { cache } from "react";

import { loadDocumentRow } from "@/lib/blocks/repository";
import { isDatabaseConfigured } from "@/lib/content/repository";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import {
  SITE_SETTINGS_PAGE_KEY,
  defaultSiteSettings,
  parseSiteSettings,
  siteSettingsErrorsOf,
  validateSiteSettings,
  type SiteSettings,
} from "@/lib/site-settings/model";

/**
 * อ่าน "ตั้งค่าส่วนกลาง" ฉบับเผยแพร่ (X1.3)
 *
 * ⚠️ ต่างจาก navbar/footer: ที่นี่ **ไม่คืน null** — คืน "ค่าเริ่มต้น" แทนเสมอ
 *    เพราะค่าพวกนี้ใช้ประกอบ metadata ของทุกหน้า ⇒ ผู้เรียกไม่ต้องเขียนเงื่อนไขซ้ำ
 *    และ "ค่าเริ่มต้น" = พฤติกรรมเดิมของเว็บเป๊ะ
 */
export const loadSiteSettings = cache(async (locale: Locale): Promise<SiteSettings> => {
  const messages = await getMessagesFor(locale);
  const fallback = defaultSiteSettings(messages);
  if (!isDatabaseConfigured()) return fallback;

  try {
    const row = await loadDocumentRow(SITE_SETTINGS_PAGE_KEY, "published");
    if (row === null) return fallback;

    const parsed = parseSiteSettings(row.raw, messages);
    if (!parsed.ok) return fallback;
    if (siteSettingsErrorsOf(validateSiteSettings(parsed.value)).length > 0) return fallback;

    return parsed.value;
  } catch {
    return fallback;
  }
});

/**
 * โหลดค่าสำหรับ "หน้าจอแก้ไข" (หลังบ้าน) — ใช้ฉบับร่างถ้ามี ไม่มีก็ฉบับเผยแพร่ ไม่มีก็ค่าเริ่มต้น
 * ⇒ ผู้แก้เห็นงานที่ค้างไว้ของตัวเอง (หลักเดียวกับตัวแก้เพจ/ท้ายเว็บ)
 */
export async function loadSiteSettingsForEditing(): Promise<{
  readonly settings: SiteSettings;
  readonly draftUpdatedAt: string | null;
  readonly publishedAt: string | null;
}> {
  const messages = await getMessagesFor("th");
  const fallback = defaultSiteSettings(messages);
  if (!isDatabaseConfigured()) return { settings: fallback, draftUpdatedAt: null, publishedAt: null };

  try {
    const [draftRow, publishedRow] = await Promise.all([
      loadDocumentRow(SITE_SETTINGS_PAGE_KEY, "draft"),
      loadDocumentRow(SITE_SETTINGS_PAGE_KEY, "published"),
    ]);

    const fromDraft = draftRow === null ? null : parseSiteSettings(draftRow.raw, messages);
    const fromPublished = publishedRow === null ? null : parseSiteSettings(publishedRow.raw, messages);

    const settings =
      fromDraft !== null && fromDraft.ok
        ? fromDraft.value
        : fromPublished !== null && fromPublished.ok
          ? fromPublished.value
          : fallback;

    return {
      settings,
      draftUpdatedAt: draftRow?.updatedAt ?? null,
      publishedAt: publishedRow?.publishedAt ?? null,
    };
  } catch {
    return { settings: fallback, draftUpdatedAt: null, publishedAt: null };
  }
}
