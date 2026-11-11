import type { Locale } from "@/lib/i18n/config";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import { loadPageCopyForEditing, loadPublishedPageCopy, saveAndPublishPageCopy } from "@/lib/page-copy/store";
import type { PageCopy } from "@/lib/page-copy/model";

export const NEWS_PAGE_COPY_KEY = "news-page-copy";

function fallbackFor(messages: Awaited<ReturnType<typeof getMessagesFor>>): PageCopy {
  return {
    eyebrow: { th: messages.newsPage.eyebrow, en: messages.newsPage.eyebrow },
    title: { th: messages.newsPage.title, en: messages.newsPage.title },
    intro: { th: messages.newsPage.intro, en: messages.newsPage.intro },
  };
}

/** ข้อความหัวหน้า `/news` ที่เว็บใช้จริง */
export async function loadNewsPageCopy(locale: Locale): Promise<PageCopy> {
  const messages = await getMessagesFor(locale);
  return loadPublishedPageCopy(NEWS_PAGE_COPY_KEY, fallbackFor(messages));
}

/** ค่าเริ่มต้นสองภาษาสำหรับหน้าจอแก้ไข */
async function editingFallback(): Promise<PageCopy> {
  const [th, en] = await Promise.all([getMessagesFor("th"), getMessagesFor("en")]);
  return {
    eyebrow: { th: th.newsPage.eyebrow, en: en.newsPage.eyebrow },
    title: { th: th.newsPage.title, en: en.newsPage.title },
    intro: { th: th.newsPage.intro, en: en.newsPage.intro },
  };
}

export async function loadNewsPageCopyForEditing(): Promise<PageCopy> {
  return loadPageCopyForEditing(NEWS_PAGE_COPY_KEY, await editingFallback());
}

export async function saveAndPublishNewsPageCopy(copy: PageCopy, actor: string): Promise<void> {
  await saveAndPublishPageCopy(NEWS_PAGE_COPY_KEY, copy, actor);
}
