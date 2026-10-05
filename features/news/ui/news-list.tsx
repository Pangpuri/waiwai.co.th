import Image from "next/image";
import Link from "next/link";

import { fillTemplate } from "@/lib/i18n/template";
import { localePath, type Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages/th";
import { formatNewsDate, newsPathOfSourceId } from "@/lib/news/model";
import type { NewsRecord } from "@/lib/news/repository";

/**
 * รายการข่าว (การ์ด + แบ่งหน้า) — Server Component (หน้า /news · รอบที่ 105)
 *
 * - **ไม่เพิ่ม JS**: การ์ดเป็นลิงก์ธรรมดาไปหน้ารายละเอียด `/news/<id>` · แบ่งหน้าเป็นลิงก์ static
 * - ที่มา: ข่าวที่นำเข้าจากเว็บเดิม (`lib/news/repository.ts`) · ข้อมูลทั้งหมดมาจาก DB ห้ามแต่งในหน้าจอ
 * - ⚠️ หน้าละ 15 ข่าว (เท่าเว็บเดิม) · หน้า 2 เป็นต้นไปอยู่ที่ `/news/page/<n>` (ยังเป็น static/ISR)
 */

export type NewsListStrings = {
  readonly listTitle: string;
  readonly count: string;
  readonly readMore: string;
  readonly noCover: string;
  readonly previous: string;
  readonly next: string;
  readonly pageLabel: string;
};

export function newsListStringsOf(page: Messages["newsPage"]): NewsListStrings {
  return {
    listTitle: page.dbListTitle,
    count: page.dbListCount,
    readMore: page.dbReadMore,
    noCover: page.dbNoCover,
    previous: page.dbPrevious,
    next: page.dbNext,
    pageLabel: page.dbPageLabel,
  };
}

function titleOf(record: NewsRecord, language: Locale): string {
  const english = record.titleEn.trim();
  return language === "en" && english !== "" ? english : record.titleTh;
}

function excerptOf(record: NewsRecord, language: Locale): string {
  const english = record.excerptEn.trim();
  if (language === "en" && english !== "") return english;
  return record.excerptTh.trim();
}

export function NewsCard({
  record,
  language,
  strings,
}: {
  readonly record: NewsRecord;
  readonly language: Locale;
  readonly strings: NewsListStrings;
}) {
  const title = titleOf(record, language);
  const date = formatNewsDate(record.publishedLocal, language);

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-bg">
      <Link href={localePath(language, newsPathOfSourceId(record.sourceId))} className="block">
        {record.coverPath === null ? (
          <span className="bg-bg-subtle text-fg-muted flex aspect-[4/3] items-center justify-center px-3 text-center text-xs">
            {strings.noCover}
          </span>
        ) : (
          <Image
            src={record.coverPath}
            alt={title}
            width={record.coverWidth ?? 400}
            height={record.coverHeight ?? 300}
            sizes="(max-width: 640px) 92vw, 380px"
            className="aspect-[4/3] h-auto w-full object-cover"
          />
        )}
      </Link>

      <div className="flex flex-1 flex-col p-5">
        {date === "" ? null : <p className="text-xs font-semibold tracking-wide text-accent uppercase">{date}</p>}
        <h3 className="mt-2 text-base leading-snug font-bold text-fg">
          <Link href={localePath(language, newsPathOfSourceId(record.sourceId))} className="hover:underline">
            {title}
          </Link>
        </h3>
        {excerptOf(record, language) === "" ? null : (
          <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-fg-muted">{excerptOf(record, language)}</p>
        )}
        <p className="mt-4 pt-1">
          <Link
            href={localePath(language, newsPathOfSourceId(record.sourceId))}
            className="text-sm font-bold text-accent hover:underline"
          >
            {strings.readMore}
          </Link>
        </p>
      </div>
    </article>
  );
}

export function NewsList({
  items,
  language,
  strings,
}: {
  readonly items: readonly NewsRecord[];
  readonly language: Locale;
  readonly strings: NewsListStrings;
}) {
  if (items.length === 0) return null;

  return (
    <ul className="grid list-none gap-6 p-0 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((record) => (
        <li key={record.id} className="h-full">
          <NewsCard record={record} language={language} strings={strings} />
        </li>
      ))}
    </ul>
  );
}

/** แบ่งหน้าแบบ static — `basePath` = `/news` (ผู้เรียกเติมภาษาแล้ว) · `page` เริ่มที่ 1 */
export function NewsPagination({
  page,
  pageCount,
  basePath,
  strings,
}: {
  readonly page: number;
  readonly pageCount: number;
  readonly basePath: string;
  readonly strings: NewsListStrings;
}) {
  if (pageCount <= 1) return null;

  const hrefOf = (target: number): string => (target <= 1 ? basePath : `${basePath}/page/${target}`);
  const numbers = Array.from({ length: pageCount }, (_, index) => index + 1);

  return (
    <nav className="mt-10 flex flex-wrap items-center justify-center gap-2" aria-label={strings.pageLabel}>
      {page > 1 ? (
        <Link
          href={hrefOf(page - 1)}
          rel="prev"
          className="rounded-lg border border-line px-3 py-2 text-sm font-semibold text-fg hover:bg-bg-subtle"
        >
          {strings.previous}
        </Link>
      ) : null}

      {numbers.map((number) =>
        number === page ? (
          <span
            key={number}
            aria-current="page"
            className="bg-brand-red text-on-brand rounded-lg px-3 py-2 text-sm font-bold"
          >
            {number}
          </span>
        ) : (
          <Link
            key={number}
            href={hrefOf(number)}
            className="rounded-lg border border-line px-3 py-2 text-sm font-semibold text-fg hover:bg-bg-subtle"
          >
            {number}
          </Link>
        ),
      )}

      {page < pageCount ? (
        <Link
          href={hrefOf(page + 1)}
          rel="next"
          className="rounded-lg border border-line px-3 py-2 text-sm font-semibold text-fg hover:bg-bg-subtle"
        >
          {strings.next}
        </Link>
      ) : null}
    </nav>
  );
}

/** หัวข้อ + จำนวน ของส่วนรายการข่าว (มี `id` ให้ส่วนอื่นอ้าง `aria-labelledby` ได้) */
export function NewsListHeader({
  total,
  strings,
}: {
  readonly total: number;
  readonly strings: NewsListStrings;
}) {
  return (
    <>
      <h2 id="news-list-title" className="font-display text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">
        {strings.listTitle}
      </h2>
      <p className="mt-2 text-sm text-fg-muted">{fillTemplate(strings.count, { count: total })}</p>
    </>
  );
}
