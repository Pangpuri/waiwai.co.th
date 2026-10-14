import type { MetadataRoute } from "next";

import { PRODUCT_DETAIL_PAGE_IDS } from "@/lib/blocks/product-detail";
import { LOCALES } from "@/lib/i18n/config";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import { NEWS_PER_PAGE, countNews, listNewsSourceIds } from "@/lib/news/repository";
import { defaultPages } from "@/lib/pages/model";
import { listPages } from "@/lib/pages/repository";
import { builtInCategorySlugs } from "@/lib/products/categories";
import { listProductDetailPagePaths, listPublicCategorySlugs } from "@/lib/products/repository";
import {
  buildNewsSitemapEntries,
  buildProductCategorySitemapEntries,
  buildSitemapEntries,
} from "@/lib/site-settings/sitemap";
import { SITE } from "@/lib/site";

/*
  ต่ออายุเพจนี้เองทุก 5 นาที (ตาข่ายกันลืม) — กดเผยแพร่จากหลังบ้านจะสั่งให้สร้างใหม่ทันที (X1.7)
  ⚠️ ต้องเป็น **ค่าคงที่ literal** เท่านั้น · Next อ่านค่านี้จากซอร์สตอน build
     (ถ้าเขียน = PAGE_REVALIDATE_SECONDS จะพังด้วย "Invalid segment configuration export detected")
     เทสต์ scripts/test-isr.ts บังคับให้ค่านี้ตรงกับ PAGE_REVALIDATE_SECONDS ใน lib/cache/window.ts
*/
export const revalidate = 300;

/**
 * `sitemap.xml` อัตโนมัติ (X1.4)
 *
 * มาจากตาราง `page` (หลังบ้าน) ⇒ เพิ่ม/ซ่อนหน้าแล้ว sitemap เปลี่ยนตาม
 * + **ข่าวรายชิ้น/หน้าจัดหน้า** จากตาราง `news` (รอบที่ 173 · เปิด index ข่าว)
 * ⚠️ สร้างตอน build (static) เหมือนหน้าอื่น ๆ (มติ D1) ⇒ เผยแพร่แล้วต้อง rebuild จึงอัปเดต
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const messages = await getMessagesFor("th");
  const [pages, sourceIds, totalNews, categorySlugs, productDetailPaths] = await Promise.all([
    listPages(defaultPages(messages)),
    listNewsSourceIds(),
    countNews(),
    listPublicCategorySlugs(),
    listProductDetailPagePaths(),
  ]);

  /*
    ที่อยู่หมวดสินค้า (รอบที่ 280 · มติ D30): อ่านจาก **ตาราง `product_category`** ไม่ใช่พาธคงที่ในโค้ด
    · หมวดที่ถูก "ซ่อน" ไม่ถูกส่งมาแล้ว (`listPublicCategorySlugs` กรองที่ SQL)
    · ไม่มีฐานข้อมูล/อ่านไม่ได้ ⇒ ถอยไปใช้ 6 หมวดในโค้ด (sitemap ไม่ว่างผิดปกติ)
  */
  const productPaths = categorySlugs.length > 0 ? categorySlugs : builtInCategorySlugs();

  /*
    ⚠️ ต้องข้าม **ทุกแถว `page` ของหน้ารายละเอียดหมวด** ไม่ใช่แค่ 6 ใบในโค้ด (รอบที่ 281)
    เพราะตั้งแต่รอบนี้ หมวดที่สร้างใหม่ก็มีแถว `page` (`product-<id>`) — ที่อยู่จริงมาจากตารางหมวด
    ⇒ ถ้าไม่ข้าม จะได้ทั้ง URL ที่ถูก (จากตารางหมวด) และ URL เก่าที่ derive จาก id (จากพาธคงที่)
  */
  const productDetailPageIds =
    productDetailPaths.size > 0 ? [...productDetailPaths.keys()] : [...PRODUCT_DETAIL_PAGE_IDS];

  const pageCount = Math.max(1, Math.ceil(totalNews / NEWS_PER_PAGE));
  const entries = [
    ...buildSitemapEntries({ siteUrl: SITE.url, pages, locales: LOCALES, skipPageIds: productDetailPageIds }),
    ...buildProductCategorySitemapEntries({ siteUrl: SITE.url, locales: LOCALES, slugs: productPaths }),
    ...buildNewsSitemapEntries({ siteUrl: SITE.url, locales: LOCALES, sourceIds, pageCount }),
  ];

  return entries.map((entry) => ({
    url: entry.url,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
  }));
}
