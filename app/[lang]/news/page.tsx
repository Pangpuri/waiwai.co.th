import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BlockDocumentView } from "@/features/blocks/block-renderer";
import { loadLiveBlockDocument } from "@/lib/blocks/page-loader";

import { CampaignCard, campaignAnchorStyle, campaignCardBoxClass } from "@/features/campaigns/ui/campaign-card";
import { NewsList, NewsListHeader, NewsPagination, newsListStringsOf } from "@/features/news/ui/news-list";
import { Breadcrumb } from "@/features/shell/ui/breadcrumb";
import { MockCardGrid } from "@/features/shell/ui/mock-card-grid";
import { SampleNotice } from "@/features/shell/ui/sample-notice";
import { buildAlternates, isLocale, localePath } from "@/lib/i18n/config";
import { getMessages, getMessagesFor } from "@/lib/i18n/dictionaries";
import { campaignCardView } from "@/lib/campaigns/card-view";
import { listLiveCampaignsOnPage } from "@/lib/campaigns/repository";
import { countNews, listNews, NEWS_PER_PAGE } from "@/lib/news/repository";
import { loadPageSeo } from "@/lib/pages/repository";
import { withPageSeo } from "@/lib/seo/page-seo";

/*
  ต่ออายุเพจนี้เองทุก 5 นาที (ตาข่ายกันลืม) — กดเผยแพร่จากหลังบ้านจะสั่งให้สร้างใหม่ทันที (X1.7)
  ⚠️ ต้องเป็น **ค่าคงที่ literal** เท่านั้น · Next อ่านค่านี้จากซอร์สตอน build
     (ถ้าเขียน = PAGE_REVALIDATE_SECONDS จะพังด้วย "Invalid segment configuration export detected")
     เทสต์ scripts/test-isr.ts บังคับให้ค่านี้ตรงกับ PAGE_REVALIDATE_SECONDS ใน lib/cache/window.ts
*/
export const revalidate = 300;

/**
 * หน้า /news (ข่าวสาร & กิจกรรม) — **เลย์เอาต์ยังเป็นหน้าตัวอย่าง รอการอนุมัติ** แต่มีข่าวจริงแล้ว
 *
 * ประวัติ
 * - รอบที่ 15: การ์ดทดสอบ 3×2 ไว้ดูโครง layout เท่านั้น (ไม่มีข้อมูลจริง ไม่มีวันที่ที่แต่งขึ้น)
 * - รอบที่ 105: **ข่าวจริง 151 ข่าวจากเว็บเดิมอยู่ในฐานข้อมูล** ⇒ แสดงการ์ดจริง + แบ่งหน้า
 *   หน้า 2 เป็นต้นไปอยู่ที่ `/news/page/<n>` (static/ISR เช่นกัน)
 * - รอบที่ 173 (มติเจ้าของ 2026-10-07): **เปิดให้จัดทำดัชนี** — มีเนื้อหาจริงแล้ว
 *   · หลังบ้านยังสั่ง `noindex` กลับได้รายหน้าผ่านช่อง SEO (W2) — `withPageSeo` จะตั้ง `robots` ให้เอง
 *
 * รายละเอียด/เหตุผลทั้งหมด: PRODUCT_ROADMAP.md § 10 รอบที่ 105
 */

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/news">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};

  const messages = await getMessagesFor(lang);

  /* ค่า SEO จากหลังบ้าน (W2) — ไม่ตั้งค่า = ใช้ค่าเดิมจากพจนานุกรมเป๊ะ */
  return withPageSeo(lang, "/news", {
    title: { absolute: messages.newsPage.meta.title },
    description: messages.newsPage.meta.description,
    alternates: buildAlternates(lang, "/news"),
    /* รอบที่ 173: เปิด index (เนื้อหาจริงแล้ว) · ถ้าหลังบ้านตั้ง noindex `applySeoToMetadata` ใส่กลับให้ */
    openGraph: {
      title: messages.newsPage.meta.title,
      description: messages.newsPage.meta.description,
    },
  }, () => loadPageSeo("news"));
}

export default async function NewsPage({ params }: PageProps<"/[lang]/news">) {
  const { lang } = await params;

  // ภาษาที่ไม่รองรับ → 404 (ไม่ใช่ 500) เหมือนหน้าอื่น
  if (!isLocale(lang)) notFound();
  const messages = await getMessages(lang);
  const m = messages.newsPage;

  /*
    ── เนื้อหาของหน้านี้มาจากไหน (S2 · รอบที่ 83 · รายการข่าวจริง เพิ่มรอบที่ 105) ──────────
    1. ถ้าหลังบ้าน **กดเผยแพร่ + เปิดสวิตช์ "ใช้กับหน้าเว็บจริง"** ⇒ เรนเดอร์เอกสารบล็อกที่เผยแพร่
       (ตัวเรนเดอร์เดียวกับพรีวิว ⇒ "สิ่งที่เห็นตอนแก้ = สิ่งที่ขึ้นเว็บ" 1:1)
    2. ถ้าไม่ ⇒ ใช้เลย์เอาต์ที่ออกแบบไว้ด้านล่างเหมือนเดิม **ไม่มีการเปลี่ยนแปลงโดยไม่ตั้งใจ**
    **ทั้งสองทางต่อด้วยรายการข่าวจากฐานข้อมูล** (ข่าวที่นำเข้าจากเว็บเดิม · รอบที่ 105)
      · เลย์เอาต์เดิม: ถ้ามีข่าวจริง ⇒ แสดงข่าวจริงแทนการ์ดทดสอบ (ไม่โชว์ของปลอมคู่ของจริง)
    หน้าเว็บยังเปิดได้เสมอ แม้ไม่มีฐานข้อมูล (เดโม) หรือฐานข้อมูลล่ม — ตัวโหลด/ตัวอ่านคืน null/0/[] ให้เอง
    ⚠️ เทมเพลตยังไม่ครอบคลุมทุกส่วน (ดู `blockCoverageGaps`) — หลังบ้านจะเตือนก่อนเปิดสวิตช์
  */
  const [liveDocument, total, items, placedCards] = await Promise.all([
    loadLiveBlockDocument("news"),
    countNews(),
    listNews(NEWS_PER_PAGE, 0),
    /* การ์ดแคมเปญที่ตั้งไว้ให้ขึ้น "บนหน้านี้" (รอบที่ 198) — จุดยึดเป็นของหน้านี้โดยเฉพาะ */
    listLiveCampaignsOnPage("news"),
  ]);

  /*
    ── เวทีการ์ดแคมเปญ (รอบที่ 198) ───────────────────────────────────────────────
    การ์ดที่หลังบ้านเปิด "แสดงบนหน้าข่าวสาร" จะลอยอยู่บนเวทีนี้ ตามจุดยึดของ **หน้านี้**
    · ไม่มีการ์ด = ไม่เรนเดอร์เวทีเลย (หน้าเว็บเหมือนเดิมเป๊ะ)
    · ใช้ตัวเรนเดอร์การ์ดตัวเดียวกับสไลด์หน้าแรก (`CampaignCard`) ⇒ หน้าตาไม่เพี้ยนจากกัน
  */
  const campaignStage =
    placedCards.length === 0 ? null : (
      <section className="container-site pt-6" aria-label={m.campaignStageLabel}>
        <div className="bg-bg-subtle relative min-h-[16rem] w-full overflow-hidden rounded-2xl">
          {placedCards.map((placed) => {
            const card = campaignCardView(placed.campaign, lang, { x: placed.anchorX, y: placed.anchorY });
            return (
              <div key={placed.campaign.id} className="pointer-events-none absolute inset-0 z-10">
                <div style={campaignAnchorStyle(card.anchorX, card.anchorY)} className={campaignCardBoxClass()}>
                  <CampaignCard card={card} />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );

  const listStrings = newsListStringsOf(m);
  const pageCount = Math.max(1, Math.ceil(total / NEWS_PER_PAGE));

  const listSection =
    items.length === 0 ? null : (
      <section className="container-site py-12 lg:py-16" aria-labelledby="news-list-title">
        <NewsListHeader total={total} strings={listStrings} />
        <div className="mt-8">
          <NewsList items={items} language={lang} strings={listStrings} />
        </div>
        <NewsPagination page={1} pageCount={pageCount} basePath={localePath(lang, "/news")} strings={listStrings} />
      </section>
    );

  if (liveDocument !== null) {
    return (
      <>
        {campaignStage}
        <BlockDocumentView document={liveDocument} language={lang} />
        {listSection}
      </>
    );
  }

  return (
    <>
      <section className="border-b border-line bg-bg-subtle">
        <div className="container-site py-12 lg:py-16">
          <Breadcrumb
            ariaLabel={messages.a11y.breadcrumb}
            items={[
              { label: messages.nav.home, href: localePath(lang, "/") },
              { label: messages.nav.news },
            ]}
          />

          <p className="mt-8 inline-flex items-center gap-2 text-xs font-bold tracking-[0.18em] text-accent uppercase">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-red" />
            {m.eyebrow}
          </p>

          <h1 className="mt-4 max-w-3xl font-display text-4xl leading-[1.12] font-extrabold tracking-tight text-fg sm:text-5xl">
            {m.title}
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-relaxed text-fg-muted sm:text-lg">
            {m.intro}
          </p>

          <SampleNotice text={m.notice} />
        </div>
      </section>

      {/*
        มีข่าวจริงในฐานข้อมูลแล้ว (รอบที่ 105) ⇒ แสดงของจริงแทนการ์ดทดสอบ
        ⚠️ ถ้าฐานข้อมูลว่าง/ล่ม ⇒ ยังเห็นการ์ดทดสอบเหมือนเดิม (ไม่ทำให้หน้าเว็บพัง)
      */}
      {campaignStage}
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
