import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { NewsListViewPage, newsViewMetadata } from "@/features/news/ui/news-list-page";

import { isLocale } from "@/lib/i18n/config";
import { christianYearOfLabel } from "@/lib/news/list-view";
import { listNewsYears } from "@/lib/news/repository";

export const revalidate = 300;

/**
 * `/news/year/<พ.ศ.>/oldest` — เฉพาะปีนั้น · **เก่าสุดก่อน** (รอบที่ 271 · มติเจ้าของ D29)
 */

export async function generateStaticParams() {
  const years = await listNewsYears();
  return years.map((row) => ({ year: String(row.year) }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/news/year/[year]/oldest">): Promise<Metadata> {
  const { lang, year } = await params;
  if (!isLocale(lang)) return {};
  const christian = christianYearOfLabel(year);
  if (christian === null) return {};
  return newsViewMetadata(lang, { sort: "oldest", year: christian, page: 1 });
}

export default async function NewsYearOldestPage({ params }: PageProps<"/[lang]/news/year/[year]/oldest">) {
  const { lang, year } = await params;
  if (!isLocale(lang)) notFound();

  const christian = christianYearOfLabel(year);
  if (christian === null) notFound();

  return <NewsListViewPage lang={lang} view={{ sort: "oldest", year: christian, page: 1 }} />;
}
