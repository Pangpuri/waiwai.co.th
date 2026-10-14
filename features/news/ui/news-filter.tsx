import Link from "next/link";

import { localePath, type Locale } from "@/lib/i18n/config";
import { fillTemplate } from "@/lib/i18n/template";
import { newsListPath, type NewsListView, type NewsYearOption } from "@/lib/news/list-view";

/**
 * แถวกรองของหน้ารายการข่าว — **ลิงก์ล้วน ไม่มี JS** (รอบที่ 271 · มติเจ้าของ D29)
 *
 * ผู้ใช้สั่ง: *"อาจจะเพิ่มการปรับล่าสุดเป็นดีฟอลและเพิ่มตัวกรองว่าให้กรองจากอะไรในการโชว์หน้าครับ"*
 * - กรอง **ปี พ.ศ.** (นับจากข่าวจริงในฐานข้อมูล — ปีไหนไม่มีข่าวไม่โชว์ปุ่ม)
 * - สลับ **การเรียง ล่าสุด/เก่าสุด** (ค่าเริ่มต้น = ล่าสุด)
 * - ทุกปุ่มเป็น `<Link>` ไปหน้า static (`/news`, `/news/year/2568`, `/news/oldest`, …)
 *   ⇒ ได้ ISR เต็มที่ · กดได้แม้ปิด JS · ลิงก์แชร์ได้ (ไม่มี query string)
 */

export type NewsFilterStrings = {
  readonly filterLabel: string;
  readonly allYears: string;
  readonly yearLabel: string;
  readonly sortLabel: string;
  readonly sortNewest: string;
  readonly sortOldest: string;
};

const CHIP = "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors";
const CHIP_IDLE = "border-line text-fg hover:bg-surface-raised";
const CHIP_ACTIVE = "border-brand-red bg-brand-red text-on-brand";

export function NewsFilter({
  lang,
  view,
  total,
  years,
  strings,
}: {
  readonly lang: Locale;
  readonly view: NewsListView;
  /** จำนวนข่าวทั้งหมด (ทุกปี) — ใช้กับปุ่ม "ทุกปี" */
  readonly total: number;
  readonly years: readonly NewsYearOption[];
  readonly strings: NewsFilterStrings;
}) {
  /* ไม่มีข่าวเลย = ไม่ต้องมีแถวกรอง (หน้าจะแสดงการ์ดทดสอบ/ข้อความว่างแทน) */
  if (total === 0) return null;

  const hrefOf = (next: { readonly year: number | null; readonly sort: NewsListView["sort"] }): string =>
    localePath(lang, newsListPath({ sort: next.sort, year: next.year, page: 1 }));

  const chipClass = (active: boolean): string => `${CHIP} ${active ? CHIP_ACTIVE : CHIP_IDLE}`;

  return (
    <div className="flex flex-col gap-3" data-news-filter="">
      <nav aria-label={strings.filterLabel} className="flex flex-wrap items-center gap-2">
        <span className="text-fg-muted text-xs font-semibold">{strings.filterLabel}</span>
        <Link
          href={hrefOf({ year: null, sort: view.sort })}
          aria-current={view.year === null ? "page" : undefined}
          className={chipClass(view.year === null)}
          data-year-option="all"
        >
          {strings.allYears}
          <span className="ml-1.5 text-xs opacity-80">{total}</span>
        </Link>
        {years.map((option) => {
          const active = view.year === option.christianYear;
          return (
            <Link
              key={option.year}
              href={hrefOf({ year: option.christianYear, sort: view.sort })}
              aria-current={active ? "page" : undefined}
              className={chipClass(active)}
              data-year-option={String(option.year)}
            >
              {fillTemplate(strings.yearLabel, { year: option.year })}
              <span className="ml-1.5 text-xs opacity-80">{option.count}</span>
            </Link>
          );
        })}
      </nav>

      <nav aria-label={strings.sortLabel} className="flex flex-wrap items-center gap-2">
        <span className="text-fg-muted text-xs font-semibold">{strings.sortLabel}</span>
        <Link
          href={hrefOf({ year: view.year, sort: "newest" })}
          aria-current={view.sort === "newest" ? "page" : undefined}
          className={chipClass(view.sort === "newest")}
          data-sort-option="newest"
        >
          {strings.sortNewest}
        </Link>
        <Link
          href={hrefOf({ year: view.year, sort: "oldest" })}
          aria-current={view.sort === "oldest" ? "page" : undefined}
          className={chipClass(view.sort === "oldest")}
          data-sort-option="oldest"
        >
          {strings.sortOldest}
        </Link>
      </nav>
    </div>
  );
}

/** ข้อความของแถวกรองจากพจนานุกรม (ตัวเดียวกับหน้าจออื่น) */
export function newsFilterStringsOf(page: {
  readonly dbFilterLabel: string;
  readonly dbFilterAllYears: string;
  readonly dbFilterYear: string;
  readonly dbSortLabel: string;
  readonly dbSortNewest: string;
  readonly dbSortOldest: string;
}): NewsFilterStrings {
  return {
    filterLabel: page.dbFilterLabel,
    allYears: page.dbFilterAllYears,
    yearLabel: page.dbFilterYear,
    sortLabel: page.dbSortLabel,
    sortNewest: page.dbSortNewest,
    sortOldest: page.dbSortOldest,
  };
}
