import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { NewsListViewPage, newsViewMetadata } from "@/features/news/ui/news-list-page";

import { isLocale } from "@/lib/i18n/config";
import { type NewsListView } from "@/lib/news/list-view";

export const revalidate = 300;

/**
 * `/news/oldest` — รายการข่าว **เก่าสุดก่อน** (ทุกปี) · รอบที่ 271 · มติเจ้าของ D29
 * (ล่าสุดก่อน = `/news` ซึ่งเป็นค่าเริ่มต้น)
 */

const VIEW: NewsListView = { sort: "oldest", year: null, page: 1 };

export async function generateMetadata({ params }: PageProps<"/[lang]/news/oldest">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return newsViewMetadata(lang, VIEW);
}

export default async function NewsOldestPage({ params }: PageProps<"/[lang]/news/oldest">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return <NewsListViewPage lang={lang} view={VIEW} />;
}
