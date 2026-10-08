import { formatNewsDate, newsPathOfSourceId } from "@/lib/news/model";
import type { NewsRecord } from "@/lib/news/repository";
import type { Language } from "@/lib/content/home-section";

/**
 * ชั้นข้อมูล + ตรรกะของ **บล็อกไดนามิก "ข่าวล่าสุด"** — รอบที่ 223 (คิวข้อ 4)
 * เก็บแค่ตัวเลือก แล้วดึงข่าวจริงจากฐานข้อมูลตอนเรนเดอร์ (แบบเดียวกับสินค้า/เมนู)
 * - ไม่มีข้อมูล = ไม่เรนเดอร์ (`isEmpty`) · เก็บพาธ ไม่เก็บ URL เต็ม (มติ D9)
 * - วันที่ใช้ `formatNewsDate()` ตัวเดียวกับหน้าเว็บ · ลิงก์ใช้ `newsPathOfSourceId()` ตัวเดียวกับหน้าเว็บ
 * - ตรรกะล้วน (ไม่แตะ DB/React) ⇒ ทดสอบได้ด้วย `node --test`
 */
export type NewsShowcaseOptions = {
  readonly columns: 1 | 2 | 3;
  /** จำนวนข่าวที่แสดง (3–12) */
  readonly limit: number;
  readonly showDates: boolean;
  /** แสดงคำโปรย (ถ้ามี) */
  readonly showExcerpts: boolean;
};

export const DEFAULT_NEWS_SHOWCASE: NewsShowcaseOptions = { columns: 3, limit: 3, showDates: true, showExcerpts: true };

export const MIN_NEWS_SHOWCASE_LIMIT = 3;
export const MAX_NEWS_SHOWCASE_LIMIT = 12;

export function clampNewsShowcaseOptions(options: Partial<NewsShowcaseOptions>): NewsShowcaseOptions {
  const columns = options.columns === 1 || options.columns === 2 || options.columns === 3 ? options.columns : DEFAULT_NEWS_SHOWCASE.columns;
  const limit = options.limit;
  return {
    columns,
    limit:
      typeof limit === "number" && Number.isFinite(limit)
        ? Math.min(MAX_NEWS_SHOWCASE_LIMIT, Math.max(MIN_NEWS_SHOWCASE_LIMIT, Math.round(limit)))
        : DEFAULT_NEWS_SHOWCASE.limit,
    showDates: options.showDates ?? DEFAULT_NEWS_SHOWCASE.showDates,
    showExcerpts: options.showExcerpts ?? DEFAULT_NEWS_SHOWCASE.showExcerpts,
  };
}

/** อ่านตัวเลือกจากก้อนข้อมูลดิบ (JSONB) ที่ไม่เชื่อถือได้ */
export function newsShowcaseOptionsFromUnknown(raw: Readonly<Record<string, unknown>>): NewsShowcaseOptions {
  const columns = raw["columns"];
  const limit = raw["limit"];
  return clampNewsShowcaseOptions({
    columns: columns === 1 || columns === 2 || columns === 3 ? columns : undefined,
    limit: typeof limit === "number" ? limit : undefined,
    showDates: typeof raw["showDates"] === "boolean" ? raw["showDates"] : undefined,
    showExcerpts: typeof raw["showExcerpts"] === "boolean" ? raw["showExcerpts"] : undefined,
  });
}

export type NewsShowcaseItemView = {
  readonly id: string;
  readonly title: string;
  readonly excerpt: string;
  readonly dateLabel: string;
  readonly image: string | null;
  /** พาธในเว็บ เช่น `/news/146142` (พาธกลาง · ตัวเรนเดอร์เติม /<ภาษา>) */
  readonly href: string;
};

export type NewsShowcaseView = {
  readonly items: readonly NewsShowcaseItemView[];
  readonly isEmpty: boolean;
};

export function newsShowcaseView(
  news: readonly NewsRecord[],
  rawOptions: Partial<NewsShowcaseOptions>,
  language: Language,
): NewsShowcaseView {
  const options = clampNewsShowcaseOptions(rawOptions);
  const items: readonly NewsShowcaseItemView[] = news.slice(0, options.limit).map((record) => ({
    id: record.id,
    title: language === "en" && record.titleEn.trim() !== "" ? record.titleEn : record.titleTh,
    excerpt: options.showExcerpts ? (language === "en" && record.excerptEn.trim() !== "" ? record.excerptEn : record.excerptTh) : "",
    dateLabel: options.showDates ? formatNewsDate(record.publishedLocal, language) : "",
    image: record.coverPath,
    href: newsPathOfSourceId(record.sourceId),
  }));
  return { items, isEmpty: items.length === 0 };
}

export const NEWS_SHOWCASE_BLOCK_DEFAULTS = {
  columns: DEFAULT_NEWS_SHOWCASE.columns,
  limit: DEFAULT_NEWS_SHOWCASE.limit,
  showDates: DEFAULT_NEWS_SHOWCASE.showDates,
  showExcerpts: DEFAULT_NEWS_SHOWCASE.showExcerpts,
} as const;
