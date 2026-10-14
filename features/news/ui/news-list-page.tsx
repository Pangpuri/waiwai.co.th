import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BlockDocumentView } from "@/features/blocks/block-renderer";
import { NewsFilter, newsFilterStringsOf } from "@/features/news/ui/news-filter";
import { NewsList, NewsListHeader, NewsPagination, newsListStringsOf } from "@/features/news/ui/news-list";
import { Breadcrumb } from "@/features/shell/ui/breadcrumb";
import { MockCardGrid } from "@/features/shell/ui/mock-card-grid";
import { SampleNotice } from "@/features/shell/ui/sample-notice";
import { loadLiveBlockDocument } from "@/lib/blocks/page-loader";
import { buildAlternates, localePath, type Locale } from "@/lib/i18n/config";
import { getMessages, getMessagesFor } from "@/lib/i18n/dictionaries";
import {
  defaultNewsListView,
  newsListPath,
  newsPageCount,
  newsYearOptions,
  type NewsListView,
} from "@/lib/news/list-view";
import { countNews, listNews, listNewsYears, NEWS_PER_PAGE } from "@/lib/news/repository";
import { loadPageSeo } from "@/lib/pages/repository";
import { withPageSeo } from "@/lib/seo/page-seo";

/**
 * **หน้ารายการข่าวที่ใช้ร่วมกันทุกมุมมอง** (รอบที่ 271 · มติเจ้าของ D29)
 *
 * ใช้โดย 4 กลุ่มเส้นทาง (ไฟล์ละไม่กี่บรรทัด · ตรรกะอยู่ที่เดียว):
 * - `/news` · `/news/page/<n>` = ล่าสุดก่อน (ค่าเริ่มต้น)
 * - `/news/oldest` · `/news/oldest/page/<n>` = เก่าสุดก่อน
 * - `/news/year/<พ.ศ.>` · `/news/year/<พ.ศ.>/page/<n>` = เฉพาะปีนั้น (ล่าสุดก่อน)
 * - `/news/year/<พ.ศ.>/oldest` · `/news/year/<พ.ศ.>/oldest/page/<n>` = เฉพาะปีนั้น (เก่าสุดก่อน)
 *
 * ⚠️ **เรียงตามวันที่เสมอ — `sort_order` ไม่มีผลกับหน้าเว็บ** (มติ D29 ข้อ 3)
 *    เคสจริง: ข่าว 151 แถวถูกตั้ง `sort_order` ตั้งแต่ตอนนำเข้า ⇒ หน้าเว็บขึ้นข่าว 24 ก.พ. 2564 ก่อน
 *
 * ⚠️ **ห้ามปิด `dynamicParams`** ที่เส้นทางเหล่านี้ — `revalidatePath("/", "layout")` หลังบันทึกจากหลังบ้าน
 *    ทำให้รายการ prerender เก่าทั้งหมด ⇒ คำขอถัดไปเข้าเส้นทาง fallback (บทเรียนจริงรอบที่ 139)
 */

/** ชื่อมุมมองสำหรับ `<title>`/breadcrumb: (ปี พ.ศ. · เก่าสุดก่อน) */
function viewSuffix(view: NewsListView, messages: Awaited<ReturnType<typeof getMessagesFor>>): string {
  const parts: string[] = [];
  if (view.year !== null) parts.push(String(view.year + 543));
  if (view.sort === "oldest") parts.push(messages.newsPage.dbSortOldest);
  if (view.page > 1) parts.push(String(view.page));
  return parts.length === 0 ? "" : ` (${parts.join(" · ")})`;
}

/** SEO ของมุมมองหนึ่ง — canonical/hreflang ชี้ตัวมันเอง (ข้อมูลต่างกันจริงต่อมุมมอง) */
export async function newsViewMetadata(lang: Locale, view: NewsListView): Promise<Metadata> {
  const messages = await getMessagesFor(lang);
  const m = messages.newsPage;
  const path = newsListPath(view);
  const suffix = viewSuffix(view, messages);

  /* หน้าที่ 2+ / มุมมองกรอง ไม่มีแถว SEO ของตัวเอง ⇒ ใช้พจนานุกรมล้วน (แต่ค่า noindex จากหลังบ้านยังมีผล) */
  return withPageSeo(
    lang,
    path,
    {
      title: { absolute: `${m.meta.title}${suffix}` },
      description: m.meta.description,
      alternates: buildAlternates(lang, path),
      openGraph: { title: `${m.meta.title}${suffix}`, description: m.meta.description },
    },
    view.page === 1 && view.year === null && view.sort === "newest" ? () => loadPageSeo("news") : async () => null,
  );
}

export async function NewsListViewPage({ lang, view }: { readonly lang: Locale; readonly view: NewsListView }) {
  const messages = await getMessages(lang);
  const m = messages.newsPage;

  const offset = (view.page - 1) * NEWS_PER_PAGE;
  /*
    ── ที่มาของเนื้อหา (เหมือนเดิมตั้งแต่รอบ 83/105) ────────────────────────────
    1. กดเผยแพร่จากหลังบ้าน ⇒ เรนเดอร์เอกสารบล็อก แล้วต่อด้วยรายการข่าวจริงจากฐานข้อมูล
    2. ไม่มี ⇒ เลย์เอาต์ที่ออกแบบไว้ (hero + แถวกรอง + รายการข่าวจริง)
  */
  const [liveDocument, total, items, yearRows] = await Promise.all([
    loadLiveBlockDocument("news"),
    countNews(view.year),
    listNews(NEWS_PER_PAGE, offset, { sort: view.sort, year: view.year }),
    listNewsYears(),
  ]);

  const pageCount = newsPageCount(total, NEWS_PER_PAGE);
  /* เกินจำนวนหน้า/ไม่มีข่าวในมุมมองนี้ ⇒ 404 (ไม่ใช่หน้าว่าง) — ยังไม่ 404 เมื่อ "ทั้งเว็บยังไม่มีข่าว" */
  const databaseHasNews = yearRows.length > 0;
  if (databaseHasNews && (items.length === 0 || view.page > pageCount)) notFound();

  const listStrings = newsListStringsOf(m);
  const filterStrings = newsFilterStringsOf(m);
  const years = newsYearOptions(yearRows);
  const basePath = localePath(lang, newsListPath({ ...view, page: 1 }));

  const listSection =
    items.length === 0 ? null : (
      <section className="container-site py-12 lg:py-16" aria-labelledby="news-list-title">
        <NewsListHeader total={total} strings={listStrings} />
        <div className="mt-6">
          <NewsFilter lang={lang} view={view} total={years.reduce((sum, year) => sum + year.count, 0)} years={years} strings={filterStrings} />
        </div>
        <div className="mt-8">
          <NewsList items={items} language={lang} strings={listStrings} />
        </div>
        <NewsPagination page={view.page} pageCount={pageCount} basePath={basePath} strings={listStrings} />
      </section>
    );

  if (liveDocument !== null) {
    return (
      <>
        <BlockDocumentView document={liveDocument} language={lang} heading={m.title} />
        {listSection}
      </>
    );
  }

  const crumbLabel = view.year === null ? m.title : `${m.title} · ${String(view.year + 543)}`;

  return (
    <>
      <section className="border-b border-line bg-bg-subtle">
        <div className="container-site py-12 lg:py-16">
          <Breadcrumb
            ariaLabel={messages.a11y.breadcrumb}
            items={[
              { label: messages.nav.home, href: localePath(lang, "/") },
              view.year === null && view.sort === "newest" && view.page === 1
                ? { label: messages.nav.news }
                : { label: messages.nav.news, href: localePath(lang, "/news") },
              ...(view.year === null && view.sort === "newest" && view.page === 1
                ? []
                : [{ label: crumbLabel + viewSuffix({ ...view, year: null }, messages) }]),
            ]}
          />

          <p className="mt-8 inline-flex items-center gap-2 text-xs font-bold tracking-[0.18em] text-accent uppercase">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-red" />
            {m.eyebrow}
          </p>

          <h1 className="mt-4 max-w-3xl font-display text-4xl leading-[1.12] font-extrabold tracking-tight text-fg sm:text-5xl">
            {m.title}
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-relaxed text-fg-muted sm:text-lg">{m.intro}</p>

          <SampleNotice text={m.notice} />
        </div>
      </section>

      {listSection ?? (
        <section className="container-site py-16 lg:py-24">
          <MockCardGrid
            idPrefix="mock-news"
            titlePrefix={m.cardTitle}
            captionPrefix={m.figureCaption}
            badge={m.figureBadge}
            metaLabel={m.cardMeta}
            icon="news"
          />
        </section>
      )}
    </>
  );
}

/** มุมมองเริ่มต้น (ล่าสุด · ทุกปี · หน้า 1) — ให้เส้นทางที่ไม่มีพารามิเตอร์เรียกใช้ */
export const defaultNewsView = defaultNewsListView();
