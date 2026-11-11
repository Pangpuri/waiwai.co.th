import { cache } from "react";

import { loadDocumentRow } from "@/lib/blocks/repository";
import { isDatabaseConfigured } from "@/lib/content/repository";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages/th";
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
 * เติมข้อความเดิม (จากพจนานุกรมของแต่ละภาษา) ลงช่องแก้ไขเมื่อยังไม่เคยตั้งค่า
 * ⇒ ผู้ดูแลเห็นข้อความที่เว็บกำลังแสดงอยู่จริงแล้วแก้ต่อได้ทันที
 * ⚠️ ใช้เฉพาะหน้าจอแก้ไข — ตัวโหลดฝั่งเว็บยังคืนค่าว่าง ⇒ `resolveNotice()` ถอยไปใช้ค่าเดิมเสมอ
 */
function withNoticeDefaults(value: SiteSettings, messagesTh: Messages, messagesEn: Messages): SiteSettings {
  const pick = (custom: string, fallbackText: string): string => (custom.trim() === "" ? fallbackText : custom);
  return {
    ...value,
    notices: {
      contactForm: {
        th: pick(value.notices.contactForm.th, messagesTh.contactPage.note),
        en: pick(value.notices.contactForm.en, messagesEn.contactPage.note),
      },
      careers: {
        th: pick(value.notices.careers.th, messagesTh.careersPage.note),
        en: pick(value.notices.careers.en, messagesEn.careersPage.note),
      },
    },
    pageCopy: {
      products: {
        eyebrow: {
          th: pick(value.pageCopy.products.eyebrow.th, messagesTh.productsPage.eyebrow),
          en: pick(value.pageCopy.products.eyebrow.en, messagesEn.productsPage.eyebrow),
        },
        title: {
          th: pick(value.pageCopy.products.title.th, messagesTh.productsPage.title),
          en: pick(value.pageCopy.products.title.en, messagesEn.productsPage.title),
        },
        intro: {
          th: pick(value.pageCopy.products.intro.th, messagesTh.productsPage.intro),
          en: pick(value.pageCopy.products.intro.en, messagesEn.productsPage.intro),
        },
      },
    },
  };
}

/**
 * โหลดค่าสำหรับ "หน้าจอแก้ไข" (หลังบ้าน) — ใช้ฉบับร่างถ้ามี ไม่มีก็ฉบับเผยแพร่ ไม่มีก็ค่าเริ่มต้น
 * ⇒ ผู้แก้เห็นงานที่ค้างไว้ของตัวเอง (หลักเดียวกับตัวแก้เพจ/ท้ายเว็บ)
 */
export async function loadSiteSettingsForEditing(): Promise<{
  readonly settings: SiteSettings;
  readonly draftUpdatedAt: string | null;
  readonly publishedAt: string | null;
}> {
  const [messages, messagesEn] = await Promise.all([getMessagesFor("th"), getMessagesFor("en")]);
  const fallback = withNoticeDefaults(defaultSiteSettings(messages), messages, messagesEn);
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
      settings: withNoticeDefaults(settings, messages, messagesEn),
      draftUpdatedAt: draftRow?.updatedAt ?? null,
      publishedAt: publishedRow?.publishedAt ?? null,
    };
  } catch {
    return { settings: fallback, draftUpdatedAt: null, publishedAt: null };
  }
}
