import type { Locale } from "@/lib/i18n/config";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import { loadPageCopyForEditing, loadPublishedPageCopy, saveAndPublishPageCopy } from "@/lib/page-copy/store";
import type { PageCopy } from "@/lib/page-copy/model";

export const RECIPES_PAGE_COPY_KEY = "recipes-page-copy";

function fallbackFor(messages: Awaited<ReturnType<typeof getMessagesFor>>): PageCopy {
  return {
    eyebrow: { th: messages.recipesPage.eyebrow, en: messages.recipesPage.eyebrow },
    title: { th: messages.recipesPage.title, en: messages.recipesPage.title },
    intro: { th: messages.recipesPage.intro, en: messages.recipesPage.intro },
  };
}

/** ข้อความหัวหน้า `/recipes` ที่เว็บใช้จริง */
export async function loadRecipesPageCopy(locale: Locale): Promise<PageCopy> {
  const messages = await getMessagesFor(locale);
  return loadPublishedPageCopy(RECIPES_PAGE_COPY_KEY, fallbackFor(messages));
}

/** ค่าเริ่มต้นสองภาษาสำหรับหน้าจอแก้ไข */
async function editingFallback(): Promise<PageCopy> {
  const [th, en] = await Promise.all([getMessagesFor("th"), getMessagesFor("en")]);
  return {
    eyebrow: { th: th.recipesPage.eyebrow, en: en.recipesPage.eyebrow },
    title: { th: th.recipesPage.title, en: en.recipesPage.title },
    intro: { th: th.recipesPage.intro, en: en.recipesPage.intro },
  };
}

export async function loadRecipesPageCopyForEditing(): Promise<PageCopy> {
  return loadPageCopyForEditing(RECIPES_PAGE_COPY_KEY, await editingFallback());
}

export async function saveAndPublishRecipesPageCopy(copy: PageCopy, actor: string): Promise<void> {
  await saveAndPublishPageCopy(RECIPES_PAGE_COPY_KEY, copy, actor);
}
