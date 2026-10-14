import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { NewsListViewPage, newsViewMetadata } from "@/features/news/ui/news-list-page";

import { isLocale } from "@/lib/i18n/config";
import { christianYearOfLabel, parseNewsPageNumber } from "@/lib/news/list-view";
import { listNewsYears, NEWS_PER_PAGE } from "@/lib/news/repository";

export const revalidate = 300;

/**
 * `/news/year/<พ.ศ.>/page/<n>` — หน้าที่ 2+ ของมุมมอง "เฉพาะปี · ล่าสุดก่อน"
 * ⚠️ ไม่ปิด `dynamicParams` · เลขหน้าที่เกิน/ปีที่ผิดรูป = 404 ในหน้าจวมุมมอง
 */

export async function generateStaticParams() {
  const years = await listNewsYears();
  const params: { year: string; page: string }[] = [];
  for (const row of years) {
    const pageCount = Math.max(0, Math.ceil(row.count / NEWS_PER_PAGE));
    for (let page = 2; page <= pageCount; page += 1) params.push({ year: String(row.year), page: String(page) });
  }
  return params;
}

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/news/year/[year]/page/[page]">): Promise<Metadata> {
  const { lang, year, page } = await params;
  if (!isLocale(lang)) return {};
  const christian = christianYearOfLabel(year);
  const number = parseNewsPageNumber(page);
  if (christian === null || number === null) return {};
  return newsViewMetadata(lang, { sort: "newest", year: christian, page: number });
}

export default async function NewsYearPageNumber({
  params,
}: PageProps<"/[lang]/news/year/[year]/page/[page]">) {
  const { lang, year, page } = await params;
  if (!isLocale(lang)) notFound();

  const christian = christianYearOfLabel(year);
  const number = parseNewsPageNumber(page);
  if (christian === null || number === null || number < 2) notFound();

  return <NewsListViewPage lang={lang} view={{ sort: "newest", year: christian, page: number }} />;
}
