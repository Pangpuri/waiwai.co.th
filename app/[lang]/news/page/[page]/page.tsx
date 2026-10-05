import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { NewsList, NewsListHeader, NewsPagination, newsListStringsOf } from "@/features/news/ui/news-list";
import { Breadcrumb } from "@/features/shell/ui/breadcrumb";
import { buildAlternates, isLocale, localePath } from "@/lib/i18n/config";
import { getMessages, getMessagesFor } from "@/lib/i18n/dictionaries";
import { countNews, listNews, NEWS_PER_PAGE } from "@/lib/news/repository";
import { withPageSeo } from "@/lib/seo/page-seo";

export const revalidate = 300;

/**
 * หน้า /news/page/<n> — หน้าที่ 2 เป็นต้นไปของรายการข่าว (หน้า /news · รอบที่ 105)
 *
 * ทำไมใช้ `/news/page/<n>` ไม่ใช้ `?page=`
 * - `searchParams` ทำให้หน้าเป็น dynamic ทั้งหน้า (เสีย static/ISR) — โปรเจกต์นี้ยึด static ก่อน
 * - โครงสร้างนี้ทำให้ทุกหน้าเป็น static/ISR เท่ากัน และแชร์/บุ๊กมาร์กได้
 *
 * ⚠️ prerender หน้าที่มีอยู่จริงตอน build (หน้า 2..N) — แต่ **ไม่ปิด `dynamicParams`**
 *    (ค่าเริ่มต้น = true) ⇒ ถ้าข่าวเพิ่มจนมีหน้าใหม่ จะเปิดได้ทันทีโดยไม่ต้อง build ใหม่ · เกินจำนวน = `notFound()`
 */

function parsePageNumber(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const page = Number.parseInt(value, 10);
  return Number.isFinite(page) && page >= 2 ? page : null;
}

/** หน้า 2..N ที่มีอยู่จริงตอน build (หน้า 1 อยู่ที่ `/news`) */
export async function generateStaticParams() {
  const total = await countNews();
  const pageCount = Math.max(0, Math.ceil(total / NEWS_PER_PAGE));
  return Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) => ({ page: String(index + 2) }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/news/page/[page]">): Promise<Metadata> {
  const { lang, page } = await params;
  if (!isLocale(lang)) return {};

  const number = parsePageNumber(page);
  const messages = await getMessagesFor(lang);
  const m = messages.newsPage;
  const suffix = number === null ? "" : ` (${number})`;

  /*
    ⚠️ หน้าที่ 2+ ไม่มีแถว SEO ของตัวเองในฐานข้อมูล (ค่า SEO ผูกกับ "หน้า" ไม่ใช่เลขหน้า)
    ⇒ ส่งตัวโหลดที่คืน null (ใช้ค่าจากพจนานุกรมล้วน)
  */
  return withPageSeo(
    lang,
    `/news/page/${page}`,
    {
      title: { absolute: `${m.meta.title}${suffix}` },
      description: m.meta.description,
      alternates: buildAlternates(lang, `/news/page/${page}`),
      robots: { index: false, follow: false },
      openGraph: { title: `${m.meta.title}${suffix}`, description: m.meta.description },
    },
    async () => null,
  );
}

export default async function NewsPageNumber({ params }: PageProps<"/[lang]/news/page/[page]">) {
  const { lang, page } = await params;
  if (!isLocale(lang)) notFound();

  const number = parsePageNumber(page);
  if (number === null) notFound();

  const messages = await getMessages(lang);
  const m = messages.newsPage;

  const [total, items] = await Promise.all([countNews(), listNews(NEWS_PER_PAGE, (number - 1) * NEWS_PER_PAGE)]);
  const pageCount = Math.max(1, Math.ceil(total / NEWS_PER_PAGE));

  /* ไม่มีข่าวในหน้านี้ (เกินจำนวนหน้า/ฐานข้อมูลว่าง) ⇒ 404 ไม่ใช่หน้าว่าง */
  if (items.length === 0 || number > pageCount) notFound();

  const listStrings = newsListStringsOf(m);

  return (
    <>
      <section className="border-b border-line bg-bg-subtle">
        <div className="container-site py-12 lg:py-16">
          <Breadcrumb
            ariaLabel={messages.a11y.breadcrumb}
            items={[
              { label: messages.nav.home, href: localePath(lang, "/") },
              { label: messages.nav.news, href: localePath(lang, "/news") },
              { label: `${m.title} (${number})` },
            ]}
          />

          <h1 className="mt-8 font-display text-3xl leading-tight font-extrabold tracking-tight text-fg sm:text-4xl">
            {m.title}
          </h1>
        </div>
      </section>

      <section className="container-site py-12 lg:py-16" aria-labelledby="news-list-title">
        <NewsListHeader total={total} strings={listStrings} />
        <div className="mt-8">
          <NewsList items={items} language={lang} strings={listStrings} />
        </div>
        <NewsPagination
          page={number}
          pageCount={pageCount}
          basePath={localePath(lang, "/news")}
          strings={listStrings}
        />
      </section>
    </>
  );
}
