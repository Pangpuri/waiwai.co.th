import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { NewsListViewPage, newsViewMetadata } from "@/features/news/ui/news-list-page";
import { parseNewsPageNumber } from "@/lib/news/list-view";
import { isLocale } from "@/lib/i18n/config";
import { countNews, NEWS_PER_PAGE } from "@/lib/news/repository";

/*
  ต่ออายุเพจนี้เองทุก 5 นาที (ตาข่ายกันลืม) — กดเผยแพร่จากหลังบ้านจะสั่งให้สร้างใหม่ทันที (X1.7)
*/
export const revalidate = 300;

/**
 * `/news/page/<n>` — หน้าที่ 2 เป็นต้นไปของรายการข่าว (มุมมองค่าเริ่มต้น: ล่าสุดก่อน · ทุกปี)
 *
 * ทำไมใช้ `/news/page/<n>` ไม่ใช้ `?page=`
 * - `searchParams` ทำให้หน้าเป็น dynamic ทั้งหน้า (เสีย static/ISR) — โปรเจกต์นี้ยึด static ก่อน
 * - โครงสร้างนี้ทำให้ทุกหน้าเป็น static/ISR เท่ากัน และแชร์/บุ๊กมาร์กได้ (รอบที่ 271 ใช้แนวเดียวกันกับตัวกรองปี)
 *
 * ⚠️ prerender หน้าที่มีอยู่จริงตอน build (หน้า 2..N) — แต่ **ไม่ปิด `dynamicParams`**
 *    (ค่าเริ่มต้น = true) ⇒ ถ้าข่าวเพิ่มจนมีหน้าใหม่ จะเปิดได้ทันทีโดยไม่ต้อง build ใหม่ · เกินจำนวน = `notFound()`
 */

/** หน้า 2..N ที่มีอยู่จริงตอน build (หน้า 1 อยู่ที่ `/news`) */
export async function generateStaticParams() {
  const total = await countNews();
  const pageCount = Math.max(0, Math.ceil(total / NEWS_PER_PAGE));
  return Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) => ({ page: String(index + 2) }));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/news/page/[page]">): Promise<Metadata> {
  const { lang, page } = await params;
  if (!isLocale(lang)) return {};
  const number = parseNewsPageNumber(page);
  if (number === null) return {};
  return newsViewMetadata(lang, { sort: "newest", year: null, page: number });
}

export default async function NewsPageNumber({ params }: PageProps<"/[lang]/news/page/[page]">) {
  const { lang, page } = await params;
  if (!isLocale(lang)) notFound();

  const number = parseNewsPageNumber(page);
  if (number === null || number < 2) notFound();

  return <NewsListViewPage lang={lang} view={{ sort: "newest", year: null, page: number }} />;
}
