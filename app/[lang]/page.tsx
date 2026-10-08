import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BlockDocumentView } from "@/features/blocks/block-renderer";
import { loadProductShowcaseData } from "@/lib/blocks/product-showcase-data";
import { loadRecipeShowcaseData } from "@/lib/blocks/recipe-showcase-data";
import { Hero } from "@/features/home/ui/hero";
import { heroCardContentOf, type HeroCardContent } from "@/lib/content/home-card";
import { whereToBuyViewOf } from "@/lib/content/home-section";
import { SITE } from "@/lib/site";
import { cardRatioOf } from "@/lib/hero/pr-card-frame";
import { loadMediaSizes } from "@/lib/media/repository";
import { loadHomeContentSafely } from "@/lib/content/repository";
import { managedHeroSlideViews } from "@/features/home/slides";
import { NewsList } from "@/features/home/ui/news-list";
import { Newsletter } from "@/features/home/ui/newsletter";
import { ProductsShowcase } from "@/features/home/ui/products-showcase";
import { Recipes } from "@/features/home/ui/recipes";
import { WhereToBuy } from "@/features/home/ui/where-to-buy";
import {
  homeCategoryCards,
  homeNewsItems,
  homeProductHighlights,
  homeRecipeItems,
} from "@/features/home/view-models";
import { loadLiveBlockDocument } from "@/lib/blocks/page-loader";
import { listHeroPageSlides, loadHeroSetting } from "@/lib/hero/repository";
import { buildAlternates, isLocale } from "@/lib/i18n/config";
import { getMessages, getMessagesFor } from "@/lib/i18n/dictionaries";
import { countNews, listNews } from "@/lib/news/repository";
import { JsonLd } from "@/features/shell/ui/json-ld";
import { loadPageSeo } from "@/lib/pages/repository";
import { listProductCategoryCards, listProductHighlights } from "@/lib/products/repository";
import { listRecipes } from "@/lib/recipes/repository";
import { loadSiteSettings } from "@/lib/site-settings/loader";
import { withPageSeo } from "@/lib/seo/page-seo";
import { fillTemplate } from "@/lib/i18n/template";

/*
  ต่ออายุเพจนี้เองทุก 5 นาที (ตาข่ายกันลืม) — กดเผยแพร่จากหลังบ้านจะสั่งให้สร้างใหม่ทันที (X1.7)
  ⚠️ ต้องเป็น **ค่าคงที่ literal** เท่านั้น · Next อ่านค่านี้จากซอร์สตอน build
     (ถ้าเขียน = PAGE_REVALIDATE_SECONDS จะพังด้วย "Invalid segment configuration export detected")
     เทสต์ scripts/test-isr.ts บังคับให้ค่านี้ตรงกับ PAGE_REVALIDATE_SECONDS ใน lib/cache/window.ts
*/
export const revalidate = 300;

/**
 * จำนวนรายการจริงที่แสดงบนหน้าแรก (รอบที่ 108) — เจ้าของเลือก "ของจริงมาแสดง"
 * · เมนู/ข่าว = 3 ใบ (เท่ากับจำนวนการ์ดในเลย์เอาต์เดิม → ไม่ต้องปรับดีไซน์)
 */
const HOME_RECIPE_LIMIT = 3;
const HOME_NEWS_LIMIT = 3;

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
    การ์ด PR ที่ขยับ (รอบที่ 208) — รวม 3 อย่าง:
    1) ข้อความ/ภาพ = ค่าที่ตั้งในหลังบ้าน (ทับพจนานุกรม)
    2) กรอบที่เลือก = ตาราง `hero_setting.pr_card_frame` ('auto' = ยืดหดตามภาพ)
    3) สัดส่วนจริง = ขนาดภาพในตาราง `media` (มีเฉพาะภาพที่อยู่ในคลัง ⇒ ไฟล์ในโปรเจกต์ถอยไป 4:5)
  */
  const homeContent = await loadHomeContentSafely();
  const heroSetting = await loadHeroSetting();
  const cardContent = heroCardContentOf(homeContent, messages, lang);
  const cardMediaId = cardContent.image.src.startsWith("/media/") ? cardContent.image.src.slice("/media/".length) : "";
  const cardSizes = cardMediaId === "" ? null : await loadMediaSizes([cardMediaId]);
  /* "ที่ซื้อสินค้า" (รอบที่ 209) — ค่าที่ตั้งในหลังบ้านทับพจนานุกรม · ว่าง = ช่องทางเริ่มต้นจากโค้ด */
  const whereToBuyView = whereToBuyViewOf(homeContent, messages, lang, SITE.marketplaces);

  const heroCard: HeroCardContent = {
    ...cardContent,
    frame: heroSetting.prCardFrame,
    imageRatio: cardRatioOf(heroSetting.prCardFrame, cardSizes?.get(cardMediaId)),
  };

  /*
    ── เนื้อหาหน้าแรกมาจากไหน (เซสชั่น S1) ──────────────────────────────────────
    1. ถ้าหลังบ้าน **กดเผยแพร่ + เปิดสวิตช์ "ใช้กับหน้าเว็บจริง"** ⇒ เรนเดอร์เอกสารบล็อกที่เผยแพร่
       (ใช้ตัวเรนเดอร์ตัวเดียวกับพรีวิว ⇒ "สิ่งที่เห็นตอนแก้ = สิ่งที่ขึ้นเว็บ" 1:1)
    2. ถ้าไม่ ⇒ ใช้เลย์เอาต์ที่ออกแบบไว้ด้านล่างนี้เหมือนเดิม **ไม่มีการเปลี่ยนแปลงโดยไม่ตั้งใจ**
    หน้าเว็บยังเปิดได้เสมอ แม้ไม่มีฐานข้อมูล (เดโม) หรือฐานข้อมูลล่ม — ตัวโหลดคืน null ให้เอง
  */
  const liveDocument = await loadLiveBlockDocument("home");
  if (liveDocument !== null) {
    /* ส่งชื่อหน้าไปให้ตัวเรนเดอร์ออก <h1> (a11y · รอบที่ 149) — หน้าแรกจากบล็อกไม่มี h1 เลย */
    /*
      ⚠️ รอบที่ 217 — hero ของหน้าแรก **ไม่ใช่บล็อก** (แหล่งเดียวคือ `/admin/hero`)
      ⇒ โหมดบล็อกต้องเรนเดอร์ hero จริงก่อน แล้วต่อด้วยบล็อกที่เหลือ (กัน "แก้ได้สองที่")
    */
    return (
      <>
        <Hero
          locale={lang}
          messages={messages}
          dbSlides={managedHeroSlideViews(await listHeroPageSlides(), lang)}
          heroSetting={await loadHeroSetting()}
          heroCard={heroCard}
        />
        {/* บล็อกไดนามิก (รอบที่ 213): โหลดข้อมูลจริงครั้งเดียว (ไม่มีบล็อกชนิดนั้น = ไม่ยิง query) */}
        <BlockDocumentView
          document={liveDocument}
          language={lang}
          heading={messages.meta.homeTitle}
          productData={await loadProductShowcaseData(liveDocument)}
        recipeData={await loadRecipeShowcaseData(liveDocument)}
        />
      </>
    );
  }

  /*
    ── ของจริงจากฐานข้อมูลสำหรับ 3 ส่วน (S6 · รอบที่ 108) ────────────────────────
    ⚠️ บทเรียนรอบที่ 108: หน้าแรกเคยแสดง "ข้อมูลทดสอบ" ทั้ง 3 ส่วน และการ์ดหมวดสินค้า
       ฝัง slug เก่า (`/products/cup-noodles` ฯลฯ) ที่ไม่มีอยู่จริง ⇒ **ลิงก์เสีย 4 เส้น**
    ⇒ ตอนนี้ดึงของจริงคู่ขนาน (คำสั่งเดียวต่อส่วน) แล้วแปลงด้วย `features/home/view-models.ts`
       · ทุกตัวอ่านไม่สำเร็จ/ไม่มี DB ⇒ คืน [] ⇒ หน้าถอยไปใช้การ์ดตัวอย่างเดิม (ไม่พัง)
  */
  const [categoryRows, highlightRows, recipeRows, newsRows] = await Promise.all([
    listProductCategoryCards(),
    listProductHighlights(),
    listRecipes(),
    countNews().then(async (total) => (total === 0 ? [] : await listNews(HOME_NEWS_LIMIT, 0))),
  ]);

  const categories = homeCategoryCards(categoryRows, lang, messages);
  const highlights = homeProductHighlights(highlightRows, lang, messages);
  const recipes = homeRecipeItems(recipeRows, lang, HOME_RECIPE_LIMIT);
  const news = homeNewsItems(newsRows, lang, HOME_NEWS_LIMIT);

  return (
    <>
      {/* JSON-LD (X1.4): องค์กร + เว็บไซต์ — ค่ามาจาก "ตั้งค่าส่วนกลาง" ในหลังบ้าน */}
      <JsonLd kind="organization" locale={lang} settings={await loadSiteSettings(lang)} />
      <Hero
        locale={lang}
        messages={messages}
        dbSlides={managedHeroSlideViews(await listHeroPageSlides(), lang)}
        heroSetting={heroSetting}
        /* การ์ดประกาศที่ขยับ: ค่าจากหลังบ้าน (ถ้ามี) ทับพจนานุกรม — รอบที่ 200 */
        heroCard={heroCard}
      />
      <ProductsShowcase
        locale={lang}
        messages={messages}
        categories={categories}
        highlights={highlights}
        countLabel={(count) => fillTemplate(messages.products.countLabel, { count })}
      />
      <Recipes locale={lang} messages={messages} items={recipes} />
      <NewsList locale={lang} messages={messages} items={news} />
      <WhereToBuy messages={messages} view={whereToBuyView} />
      <Newsletter messages={messages} />
    </>
  );
}
