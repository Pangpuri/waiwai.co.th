import { cache } from "react";

import { loadDocumentRow, publishDraft, saveJsonDraft } from "@/lib/blocks/repository";
import { isDatabaseConfigured } from "@/lib/content/repository";
import type { Locale } from "@/lib/i18n/config";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import { loadSiteSettings, loadSiteSettingsForEditing } from "@/lib/site-settings/loader";

import {
  PRODUCTS_PAGE_COPY_KEY,
  parseProductsPageCopy,
  type ProductsPageCopy,
  withProductsPageCopyFallback,
} from "./page-copy-model";

/**
 * ตัวโหลด/บันทึกข้อความหัวหน้า `/products` (รอบ 342 · คำเจ้าของ 2026-11-11)
 *
 * เดิมอยู่ใน `site-settings.pageCopy.products` และแก้ที่ `/admin/settings`
 * ⇒ เจ้าของขอให้ย้ายมาแก้ที่ **หน้าจอ "หมวดสินค้า"** (`/admin/product-categories`)
 *   เพราะเป็นบริบทเดียวกัน (ข้อความเหนือรายการหมวด)
 *
 * เก็บด้วย `page_document` คีย์ `products-page-copy`
 *   ⇒ ได้ draft/published/history ฟรี · **ไม่ปนกับตั้งค่าองค์กรอื่น**
 *   ⇒ กดบันทึกจากหน้าหมวดสินค้า = บันทึก + เผยแพร่ทันที (ไม่ต้องไปกดเผยแพร่ที่หน้าตั้งค่า)
 *
 * ⚠️ ค่าเก่าใน `site-settings.pageCopy.products` ยังถูกอ่านเป็น fallback
 *    เพื่อไม่ให้ข้อความที่เคยตั้งไว้หายเมื่อย้ายที่เก็บ
 */

/** ค่าเก่าก่อนย้ายที่เก็บ — อ่านจาก site settings */
async function legacyProductsPageCopy(locale: Locale): Promise<ProductsPageCopy> {
  const settings = await loadSiteSettings(locale);
  return settings.pageCopy.products;
}

/** ค่าที่เว็บใช้จริง: คีย์ใหม่ → ค่าเก่าใน site settings → พจนานุกรม */
export const loadProductsPageCopy = cache(async (locale: Locale): Promise<ProductsPageCopy> => {
  const fallback = await legacyProductsPageCopy(locale);
  if (!isDatabaseConfigured()) return fallback;

  try {
    const row = await loadDocumentRow(PRODUCTS_PAGE_COPY_KEY, "published");
    if (row === null) return fallback;

    const parsed = parseProductsPageCopy(row.raw);
    return parsed === null ? fallback : withProductsPageCopyFallback(parsed, fallback);
  } catch {
    return fallback;
  }
});

/**
 * ค่าสำหรับหน้าจอแก้ไข — ใช้ฉบับร่างถ้ามี ไม่มีก็ฉบับเผยแพร่
 * แล้วเติมช่องว่างด้วยข้อความเดิมจากพจนานุกรมทั้งสองภาษา
 */
export async function loadProductsPageCopyForEditing(): Promise<ProductsPageCopy> {
  const [messagesTh, messagesEn, legacy] = await Promise.all([
    getMessagesFor("th"),
    getMessagesFor("en"),
    loadSiteSettingsForEditing(),
  ]);
  const fallback: ProductsPageCopy = {
    eyebrow: {
      th: legacy.settings.pageCopy.products.eyebrow.th.trim() || messagesTh.productsPage.eyebrow,
      en: legacy.settings.pageCopy.products.eyebrow.en.trim() || messagesEn.productsPage.eyebrow,
    },
    title: {
      th: legacy.settings.pageCopy.products.title.th.trim() || messagesTh.productsPage.title,
      en: legacy.settings.pageCopy.products.title.en.trim() || messagesEn.productsPage.title,
    },
    intro: {
      th: legacy.settings.pageCopy.products.intro.th.trim() || messagesTh.productsPage.intro,
      en: legacy.settings.pageCopy.products.intro.en.trim() || messagesEn.productsPage.intro,
    },
  };
  if (!isDatabaseConfigured()) return fallback;

  try {
    const [draftRow, publishedRow] = await Promise.all([
      loadDocumentRow(PRODUCTS_PAGE_COPY_KEY, "draft"),
      loadDocumentRow(PRODUCTS_PAGE_COPY_KEY, "published"),
    ]);
    const parsed = draftRow === null ? null : parseProductsPageCopy(draftRow.raw);
    const published = publishedRow === null ? null : parseProductsPageCopy(publishedRow.raw);
    const current = parsed ?? published;
    return current === null ? fallback : withProductsPageCopyFallback(current, fallback);
  } catch {
    return fallback;
  }
}

/**
 * บันทึก + เผยแพร่ทันที (หน้าหมวดสินค้าใช้ปุ่มเดียว)
 * ⚠️ คีย์แยกจาก site settings ⇒ ไม่ไปเผยแพร่งานค้างของหน้าตั้งค่าองค์กร
 */
export async function saveAndPublishProductsPageCopy(copy: ProductsPageCopy, actor: string): Promise<void> {
  await saveJsonDraft(PRODUCTS_PAGE_COPY_KEY, copy, actor);
  await publishDraft(PRODUCTS_PAGE_COPY_KEY, actor, "products-page-copy");
}
