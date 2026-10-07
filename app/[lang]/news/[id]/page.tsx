import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { NewsBody } from "@/features/news/ui/news-body";
import { Breadcrumb } from "@/features/shell/ui/breadcrumb";
import { buildAlternates, isLocale, localePath, type Locale } from "@/lib/i18n/config";
import { getMessages, getMessagesFor } from "@/lib/i18n/dictionaries";
import { loadMediaSizes } from "@/lib/media/repository";
import { newsBodyImageIds } from "@/lib/news/body";
import { formatNewsDate, newsPathOfSourceId } from "@/lib/news/model";
import { listNewsSourceIds, loadNewsBySourceId, type NewsRecord } from "@/lib/news/repository";
import { withPageSeo } from "@/lib/seo/page-seo";

export const revalidate = 300;

/**
 * prerender ทุกข่าวที่มีในฐานข้อมูลตอน build (ให้เป็น ● static + ISR เหมือนหน้าอื่น)
 *
 * ⚠️ `dynamicParams` ปล่อยเป็นค่าเริ่มต้น (true) **โดยเจตนา**
 * - ข่าวใหม่ที่นำเข้าทีหลังยังเปิดได้ทันที (เรนเดอร์ครั้งแรกแล้ว cache 300 วิ) โดยไม่ต้อง build ใหม่
 * - เครื่องที่ไม่มี DB ตอน build (เช่น CI งานแรก) จะได้รายการว่าง ⇒ ยังเปิดได้ตามปกติ (ไม่ 404)
 */
export async function generateStaticParams() {
  const sourceIds = await listNewsSourceIds();
  return sourceIds.map((id) => ({ id }));
}

/**
 * หน้ารายละเอียดข่าว `/news/<source_id>` (หน้า /news · รอบที่ 105)
 *
 * มติเจ้าของ 2026-10-05: ทำ **หน้ารายละเอียดต่อข่าว** (ไม่ใช้โมดัล) เพราะ
 * - มี URL ของตัวเอง (แชร์/บุ๊กมาร์กได้) และขึ้นต้นด้วย id เดียวกับเว็บเดิม (`/th/news/<id>-<slug>`) ⇒ ทำ 301 ตรงรุ่นได้ในอนาคต
 * - ไม่ต้องเพิ่ม JS — เนื้อหาเป็น Server Component ล้วน (รูป lazy ตามค่าเริ่มต้น)
 *
 * ⚠️ ยัง `noindex` (ทั้งส่วนข่าวยังเป็น "หน้าตัวอย่างรออนุมัติ") — ต้องมีมติเจ้าของก่อนเปิด index
 * ⚠️ `params.id` เป็น **source_id ตัวเลข** (ไม่ใช้ slug ไทยของเว็บเดิม: มีอักขระ `!"` และเครื่องหมายคำพูดปนมาด้วย)
 */

function titleOf(record: NewsRecord, language: Locale): string {
  const english = record.titleEn.trim();
  return language === "en" && english !== "" ? english : record.titleTh;
}

function excerptOf(record: NewsRecord, language: Locale): string {
  const english = record.excerptEn.trim();
  if (language === "en" && english !== "") return english;
  return record.excerptTh.trim();
}

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/news/[id]">): Promise<Metadata> {
  const { lang, id } = await params;
  if (!isLocale(lang)) return {};

  const record = await loadNewsBySourceId(id);
  if (record === null) return {};

  const messages = await getMessagesFor(lang);
  const title = titleOf(record, lang);
  const description = excerptOf(record, lang);

  /*
    ⚠️ ข่าวแต่ละชิ้น **ไม่มีแถว SEO ของตัวเอง** ในฐานข้อมูล (ตาราง `page` ผูกกับหน้าเมนู)
    ⇒ ส่งตัวโหลดที่คืน null · ค่ามาจากข้อมูลข่าว + พจนานุกรมล้วน
  */
  return withPageSeo(
    lang,
    newsPathOfSourceId(record.sourceId),
    {
      title: { absolute: `${title} — ${messages.newsPage.title}` },
      description: description === "" ? messages.newsPage.meta.description : description,
      alternates: buildAlternates(lang, newsPathOfSourceId(record.sourceId)),
      /* รอบที่ 173 (มติเจ้าของ): เปิด index — ข่าวมีเนื้อหาจริง · หลังบ้านสั่ง noindex กลับได้ผ่าน withPageSeo
         ⚠️ ข่าวแต่ละชิ้นไม่มีแถว SEO ของตัวเอง ⇒ ตัวโหลดคืน null ⇒ ช่อง noindex สั่งกลับไม่ได้รายชิ้น */
      openGraph: {
        title,
        description: description === "" ? messages.newsPage.meta.description : description,
        images: record.coverPath === null ? undefined : [{ url: record.coverPath, alt: title }],
      },
    },
    async () => null,
  );
}

export default async function NewsDetailPage({ params }: PageProps<"/[lang]/news/[id]">) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();

  const record = await loadNewsBySourceId(id);
  if (record === null) notFound();

  const messages = await getMessages(lang);
  const m = messages.newsPage;
  const title = titleOf(record, lang);
  const date = formatNewsDate(record.publishedLocal, lang, true);
  const sizes = await loadMediaSizes(newsBodyImageIds(record.body));

  return (
    <>
      <section className="border-b border-line bg-bg-subtle">
        <div className="container-site py-10 lg:py-14">
          <Breadcrumb
            ariaLabel={messages.a11y.breadcrumb}
            items={[
              { label: messages.nav.home, href: localePath(lang, "/") },
              { label: messages.nav.news, href: localePath(lang, "/news") },
              { label: title },
            ]}
          />

          <h1 className="mt-8 max-w-4xl font-display text-3xl leading-[1.15] font-extrabold tracking-tight text-fg sm:text-4xl">
            {title}
          </h1>

          {date === "" ? null : <p className="mt-4 text-sm font-semibold text-fg-muted">{`${m.dbPublished} ${date}`}</p>}
        </div>
      </section>

      <article className="container-site py-10 lg:py-14">
        {record.coverPath === null ? null : (
          <Image
            src={record.coverPath}
            alt={title}
            width={record.coverWidth ?? 400}
            height={record.coverHeight ?? 300}
            sizes="(max-width: 768px) 92vw, 720px"
            priority
            className="mx-auto h-auto w-full max-w-3xl rounded-2xl border border-line"
          />
        )}

        <div className="mx-auto mt-10 max-w-3xl">
          <NewsBody blocks={record.body} sizes={sizes} />
        </div>

        <p className="mx-auto mt-12 max-w-3xl border-t border-line pt-6">
          <Link href={localePath(lang, "/news")} className="text-sm font-bold text-accent hover:underline">
            {m.dbBackToNews}
          </Link>
        </p>
      </article>
    </>
  );
}
