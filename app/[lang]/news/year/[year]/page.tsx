import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { NewsListViewPage, newsViewMetadata } from "@/features/news/ui/news-list-page";

import { isLocale } from "@/lib/i18n/config";
import { christianYearOfLabel } from "@/lib/news/list-view";
import { listNewsYears } from "@/lib/news/repository";

export const revalidate = 300;

/**
 * `/news/year/<พ.ศ.>` — รายการข่าว **เฉพาะปีนั้น** (ล่าสุดก่อน) · รอบที่ 271 · มติเจ้าของ D29
 *
 * ทำไมใช้เส้นทาง static ไม่ใช้ `?year=`
 * - `searchParams` ทำให้หน้าเป็น dynamic ทั้งหน้า (เสีย static/ISR) ⇒ ทุกมุมมองเป็น static เท่ากัน
 * - ⚠️ ไม่ปิด `dynamicParams` — ปีใหม่ (จากข่าวใหม่) เปิดได้ทันทีโดยไม่ต้อง build ใหม่ (บทเรียนรอบ 139)
 */

export async function generateStaticParams() {
  const years = await listNewsYears();
  return years.map((row) => ({ year: String(row.year) }));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/news/year/[year]">): Promise<Metadata> {
  const { lang, year } = await params;
  if (!isLocale(lang)) return {};
  const christian = christianYearOfLabel(year);
  if (christian === null) return {};
  return newsViewMetadata(lang, { sort: "newest", year: christian, page: 1 });
}

export default async function NewsYearPage({ params }: PageProps<"/[lang]/news/year/[year]">) {
  const { lang, year } = await params;
  if (!isLocale(lang)) notFound();

  const christian = christianYearOfLabel(year);
  /* ปีที่ไม่ใช่ปี พ.ศ. ที่สมเหตุสมผล ⇒ 404 (ไม่ใช่ 500) */
  if (christian === null) notFound();

  return <NewsListViewPage lang={lang} view={{ sort: "newest", year: christian, page: 1 }} />;
}
