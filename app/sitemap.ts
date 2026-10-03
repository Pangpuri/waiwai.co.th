import type { MetadataRoute } from "next";

import { LOCALES } from "@/lib/i18n/config";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import { defaultPages } from "@/lib/pages/model";
import { listPages } from "@/lib/pages/repository";
import { buildSitemapEntries } from "@/lib/site-settings/sitemap";
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
 * ⚠️ สร้างตอน build (static) เหมือนหน้าอื่น ๆ (มติ D1) ⇒ เผยแพร่แล้วต้อง rebuild จึงอัปเดต
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const messages = await getMessagesFor("th");
  const pages = await listPages(defaultPages(messages));

  return buildSitemapEntries({ siteUrl: SITE.url, pages, locales: LOCALES }).map((entry) => ({
    url: entry.url,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
  }));
}
