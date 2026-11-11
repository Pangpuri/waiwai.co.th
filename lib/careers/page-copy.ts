import type { Locale } from "@/lib/i18n/config";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import { loadPageCopyForEditing, loadPublishedPageCopy, saveAndPublishPageCopy } from "@/lib/page-copy/store";
import type { PageCopy } from "@/lib/page-copy/model";

export const CAREERS_PAGE_COPY_KEY = "careers-page-copy";

function fallbackFor(messages: Awaited<ReturnType<typeof getMessagesFor>>): PageCopy {
  return {
    eyebrow: { th: messages.careersPage.eyebrow, en: messages.careersPage.eyebrow },
    title: { th: messages.careersPage.title, en: messages.careersPage.title },
    intro: { th: messages.careersPage.intro, en: messages.careersPage.intro },
  };
}

/** ข้อความหัวหน้า `/careers` ที่เว็บใช้จริง */
export async function loadCareersPageCopy(locale: Locale): Promise<PageCopy> {
  const messages = await getMessagesFor(locale);
  return loadPublishedPageCopy(CAREERS_PAGE_COPY_KEY, fallbackFor(messages));
}

/** ค่าเริ่มต้นสองภาษาสำหรับหน้าจอแก้ไข */
async function editingFallback(): Promise<PageCopy> {
  const [th, en] = await Promise.all([getMessagesFor("th"), getMessagesFor("en")]);
  return {
    eyebrow: { th: th.careersPage.eyebrow, en: en.careersPage.eyebrow },
    title: { th: th.careersPage.title, en: en.careersPage.title },
    intro: { th: th.careersPage.intro, en: en.careersPage.intro },
  };
}

export async function loadCareersPageCopyForEditing(): Promise<PageCopy> {
  return loadPageCopyForEditing(CAREERS_PAGE_COPY_KEY, await editingFallback());
}

export async function saveAndPublishCareersPageCopy(copy: PageCopy, actor: string): Promise<void> {
  await saveAndPublishPageCopy(CAREERS_PAGE_COPY_KEY, copy, actor);
}
