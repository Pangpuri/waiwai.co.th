import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BlockDocumentView } from "@/features/blocks/block-renderer";
import { loadLiveBlockDocument } from "@/lib/blocks/page-loader";

import { AboutHero } from "@/features/about/ui/about-hero";
import { CompanyAwards } from "@/features/about/ui/company-awards";
import { CompanyDirection } from "@/features/about/ui/company-direction";
import { CompanyDistribution } from "@/features/about/ui/company-distribution";
import { CompanyExplore } from "@/features/about/ui/company-explore";
import { CompanyFacilities } from "@/features/about/ui/company-facilities";
import { CompanyPeople } from "@/features/about/ui/company-people";
import { CompanyProducts } from "@/features/about/ui/company-products";
import { CompanyResearch } from "@/features/about/ui/company-research";
import { CompanyStory } from "@/features/about/ui/company-story";
import { buildAlternates, isLocale } from "@/lib/i18n/config";
import { getMessages, getMessagesFor } from "@/lib/i18n/dictionaries";
import { loadPageSeo } from "@/lib/pages/repository";
import { withPageSeo } from "@/lib/seo/page-seo";

/*
  ต่ออายุเพจนี้เองทุก 5 นาที (ตาข่ายกันลืม) — กดเผยแพร่จากหลังบ้านจะสั่งให้สร้างใหม่ทันที (X1.7)
  ⚠️ ต้องเป็น **ค่าคงที่ literal** เท่านั้น · Next อ่านค่านี้จากซอร์สตอน build
     (ถ้าเขียน = PAGE_REVALIDATE_SECONDS จะพังด้วย "Invalid segment configuration export detected")
     เทสต์ scripts/test-isr.ts บังคับให้ค่านี้ตรงกับ PAGE_REVALIDATE_SECONDS ใน lib/cache/window.ts
*/
export const revalidate = 300;

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/about">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};

  const messages = await getMessagesFor(lang);

  /* ค่า SEO จากหลังบ้าน (W2) — ไม่ตั้งค่า = ใช้ค่าเดิมจากพจนานุกรมเป๊ะ */
  return withPageSeo(lang, "/about", {
    // ชื่อหน้ามีคำว่า "เกี่ยวกับไวไว" อยู่แล้ว จึงใช้ absolute เพื่อไม่ให้ต่อท้ายด้วยชื่อเว็บซ้ำ
    title: { absolute: messages.about.meta.title },
    description: messages.about.meta.description,
    alternates: buildAlternates(lang, "/about"),
    openGraph: {
      title: messages.about.meta.title,
      description: messages.about.meta.description,
    },
  }, () => loadPageSeo("about"));
}

export default async function AboutPage({ params }: PageProps<"/[lang]/about">) {
  const { lang } = await params;

  // ภาษาที่ไม่รองรับ → 404 (ไม่ใช่ 500) เหมือนหน้าแรก
  if (!isLocale(lang)) notFound();
  const messages = await getMessages(lang);

  /*
    ── เนื้อหาของหน้านี้มาจากไหน (S2 · รอบที่ 82) ────────────────────────────────
    1. ถ้าหลังบ้าน **กดเผยแพร่ + เปิดสวิตช์ "ใช้กับหน้าเว็บจริง"** ⇒ เรนเดอร์เอกสารบล็อกที่เผยแพร่
       (ตัวเรนเดอร์เดียวกับพรีวิว ⇒ "สิ่งที่เห็นตอนแก้ = สิ่งที่ขึ้นเว็บ" 1:1)
    2. ถ้าไม่ ⇒ ใช้เลย์เอาต์ที่ออกแบบไว้ด้านล่างเหมือนเดิม **ไม่มีการเปลี่ยนแปลงโดยไม่ตั้งใจ**
    หน้าเว็บยังเปิดได้เสมอ แม้ไม่มีฐานข้อมูล (เดโม) หรือฐานข้อมูลล่ม — ตัวโหลดคืน null ให้เอง
  */
  const liveDocument = await loadLiveBlockDocument("about");
  if (liveDocument !== null) {
    return <BlockDocumentView document={liveDocument} language={lang} />;
  }

  return (
    <>
      <AboutHero locale={lang} messages={messages} />
      <CompanyStory locale={lang} messages={messages} />
      <CompanyFacilities messages={messages} />
      <CompanyDirection messages={messages} />
      <CompanyResearch messages={messages} />
      <CompanyProducts messages={messages} />
      <CompanyDistribution messages={messages} />
      <CompanyPeople messages={messages} />
      <CompanyAwards locale={lang} messages={messages} />
      <CompanyExplore locale={lang} messages={messages} />
    </>
  );
}
