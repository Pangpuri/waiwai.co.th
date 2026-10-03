import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BlockDocumentView } from "@/features/blocks/block-renderer";
import { BrandStory } from "@/features/home/ui/brand-story";
import { Hero } from "@/features/home/ui/hero";
import { NewsList } from "@/features/home/ui/news-list";
import { Newsletter } from "@/features/home/ui/newsletter";
import { ProductsShowcase } from "@/features/home/ui/products-showcase";
import { Recipes } from "@/features/home/ui/recipes";
import { Sustainability } from "@/features/home/ui/sustainability";
import { WhereToBuy } from "@/features/home/ui/where-to-buy";
import { loadLiveBlockDocument } from "@/lib/blocks/page-loader";
import { buildAlternates, isLocale } from "@/lib/i18n/config";
import { getMessages, getMessagesFor } from "@/lib/i18n/dictionaries";
import { JsonLd } from "@/features/shell/ui/json-ld";
import { loadPageSeo } from "@/lib/pages/repository";
import { loadSiteSettings } from "@/lib/site-settings/loader";
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
}: PageProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};

  const messages = await getMessagesFor(lang);

  /* ค่า SEO จากหลังบ้าน (W2) — ไม่ตั้งค่า = ใช้ค่าเดิมจากพจนานุกรมเป๊ะ */
  return withPageSeo(lang, "", {
    // หน้าแรกไม่ต้องต่อท้ายด้วยชื่อเว็บ เพราะหัวข้อมีชื่อแบรนด์อยู่แล้ว
    title: { absolute: messages.meta.homeTitle },
    description: messages.meta.homeDescription,
    alternates: buildAlternates(lang),
  }, () => loadPageSeo("home"));
}

export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;

  // ภาษาที่ไม่รองรับ → 404 (ไม่ใช่ 500)
  if (!isLocale(lang)) notFound();
  const messages = await getMessages(lang);

  /*
    ── เนื้อหาหน้าแรกมาจากไหน (เซสชั่น S1) ──────────────────────────────────────
    1. ถ้าหลังบ้าน **กดเผยแพร่ + เปิดสวิตช์ "ใช้กับหน้าเว็บจริง"** ⇒ เรนเดอร์เอกสารบล็อกที่เผยแพร่
       (ใช้ตัวเรนเดอร์ตัวเดียวกับพรีวิว ⇒ "สิ่งที่เห็นตอนแก้ = สิ่งที่ขึ้นเว็บ" 1:1)
    2. ถ้าไม่ ⇒ ใช้เลย์เอาต์ที่ออกแบบไว้ด้านล่างนี้เหมือนเดิม **ไม่มีการเปลี่ยนแปลงโดยไม่ตั้งใจ**
    หน้าเว็บยังเปิดได้เสมอ แม้ไม่มีฐานข้อมูล (เดโม) หรือฐานข้อมูลล่ม — ตัวโหลดคืน null ให้เอง
  */
  const liveDocument = await loadLiveBlockDocument("home");
  if (liveDocument !== null) {
    return <BlockDocumentView document={liveDocument} language={lang} />;
  }

  return (
    <>
      {/* JSON-LD (X1.4): องค์กร + เว็บไซต์ — ค่ามาจาก "ตั้งค่าส่วนกลาง" ในหลังบ้าน */}
      <JsonLd kind="organization" locale={lang} settings={await loadSiteSettings(lang)} />
      <Hero locale={lang} messages={messages} />
      <ProductsShowcase locale={lang} messages={messages} />
      <BrandStory locale={lang} messages={messages} />
      <Sustainability messages={messages} />
      <Recipes locale={lang} messages={messages} />
      <NewsList locale={lang} messages={messages} />
      <WhereToBuy locale={lang} messages={messages} />
      <Newsletter messages={messages} />
    </>
  );
}
