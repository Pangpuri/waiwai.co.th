import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { NewsListViewPage, newsViewMetadata } from "@/features/news/ui/news-list-page";

import { isLocale } from "@/lib/i18n/config";
import { parseNewsPageNumber } from "@/lib/news/list-view";
import { countNews, listNewsYears, NEWS_PER_PAGE } from "@/lib/news/repository";

export const revalidate = 300;

/**
 * `/news/oldest/page/<n>` — หน้าที่ 2+ ของมุมมอง "เก่าสุดก่อน"
 * ⚠️ ไม่ปิด `dynamicParams` (บทเรียนรอบ 139) · เลขหน้าที่เกิน/ผิดรูป = 404 ในหน้าจวมุมมอง
 */

export async function generateStaticParams() {
  /* prerender ตามจำนวนข่าวรวมตอน build — หน้าใหม่เปิดได้เองโดยไม่ต้อง build ใหม่ */
  const [total, years] = await Promise.all([countNews(), listNewsYears()]);
  const totalAll = years.reduce((sum, row) => sum + row.count, 0);
  const count = Math.max(total, totalAll);
  const pageCount = Math.max(0, Math.ceil(count / NEWS_PER_PAGE));
  return Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) => ({ page: String(index + 2) }));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/news/oldest/page/[page]">): Promise<Metadata> {
  const { lang, page } = await params;
  if (!isLocale(lang)) return {};
  const number = parseNewsPageNumber(page);
  if (number === null) return {};
  return newsViewMetadata(lang, { sort: "oldest", year: null, page: number });
}

export default async function NewsOldestPageNumber({ params }: PageProps<"/[lang]/news/oldest/page/[page]">) {
  const { lang, page } = await params;
  if (!isLocale(lang)) notFound();
  const number = parseNewsPageNumber(page);
  if (number === null || number < 2) notFound();
  return <NewsListViewPage lang={lang} view={{ sort: "oldest", year: null, page: number }} />;
}
