import { HERO_SLIDES } from "@/features/home/slides";
import { BLOCK_SCHEMA_VERSION, DEFAULT_BLOCK_STYLE, type Block, type BlockCard, type BlockDocument } from "@/lib/blocks/types";
import { en } from "@/lib/i18n/messages/en";
import { th } from "@/lib/i18n/messages/th";
import { SITE } from "@/lib/site";

/**
 * เทมเพลตตั้งต้นของหน้าแรก (ใช้ตอนกด "เริ่มจากเนื้อหาปัจจุบัน")
 *
 * **รอบที่ 210 (ขั้น 1 ของการรื้อให้ตรงกับหน้าแรกจริง)** — เจ้าของกำหนดทิศทาง:
 * *"เราจะทำใหม่ให้เข้ากับข้อมูลจริงทั้งโครงสร้าง … ทีละขั้น"* (กำหนดทิศทางกันที่ `/admin/builder/home`)
 *
 * กติกา
 * - **ใช้ข้อมูลจริงเท่าที่มีในโค้ด**: ชื่อ/ลิงก์/ภาพหมวดจาก `CATALOG_ITEMS` (แหล่งความจริงเดียวกับหน้าเว็บ)
 *   · ลิงก์ร้านจาก `SITE.marketplaces` · สไลด์ตั้งต้นจาก `HERO_SLIDES` · ข้อความชุดเดียวกับพจนานุกรมของหน้าเว็บ
 * - **ไม่ใส่ของปลอม**: การ์ดหมวดเดิมเคยใส่คำบรรยายจากพจนานุกรมที่เป็น "ข้อมูลทดสอบ" ⇒ รอบนี้ **ไม่ใส่มัน**
 * - ส่วนที่ต้องดึง **ข้อมูลจริงจากฐานข้อมูล** (จำนวนสินค้า/สินค้าแนะนำ · เมนูล่าสุด · ข่าวล่าสุด · ฟอร์มจดหมายข่าว)
 *   ยังทำในเทมเพลตไม่ได้ เพราะ "บล็อก" เป็นเนื้อหานิ่งที่พิมพ์เก็บในเอกสาร
 *   ⇒ ประกาศเป็น **ช่องที่ยังไม่ครอบคลุม** (`blockCoverageGaps("home")`) เพื่อให้หน้าจอเตือนก่อนกด "ใช้กับหน้าเว็บจริง"
 *   · ขั้นถัดไป = บล็อกไดนามิก (อ่านฐานข้อมูลตอนเรนเดอร์)
 */

function style(overrides: Partial<typeof DEFAULT_BLOCK_STYLE> = {}): typeof DEFAULT_BLOCK_STYLE {
  return { ...DEFAULT_BLOCK_STYLE, ...overrides };
}

/* พจนานุกรมของหมวดสินค้า/ช่องทาง — เปิดแบบกว้าง (คีย์มาจากทะเบียนกลาง ไม่ใช่พิมพ์เอง) */
/* alt ของสไลด์ชุดเดียวกับหน้าเว็บ — อยู่ในพื้นที่ hero ของพจนานุกรม */
const slideAltTh = (th.hero.slides ?? {}) as Readonly<Record<string, { alt: string } | undefined>>;
const slideAltEn = (en.hero.slides ?? {}) as Readonly<Record<string, { alt: string } | undefined>>;
const marketplaceTh = th.whereToBuy.marketplaces as Readonly<Record<string, string>>;
const marketplaceEn = en.whereToBuy.marketplaces as Readonly<Record<string, string>>;

/** การ์ดช่องทางจำหน่าย = ชื่อ (พจนานุกรม) + ลิงก์จริงจาก `SITE` */
function marketplaceCards(): readonly BlockCard[] {
  return SITE.marketplaces.map((marketplace) => ({
    title: { th: marketplaceTh[marketplace.id] ?? marketplace.id, en: marketplaceEn[marketplace.id] ?? "" },
    body: { th: "", en: "" },
    href: marketplace.href,
    image: null,
  }));
}

export function buildHomeTemplate(): BlockDocument {
  const blocks: Block[] = [
    {
      id: "block-1",
      version: BLOCK_SCHEMA_VERSION,
      type: "hero",
      style: style({ size: "lg", width: "full", align: "left" }),
      title: { th: th.hero.title, en: en.hero.title },
      subtitle: { th: th.hero.body, en: en.hero.body },
      note: { th: th.hero.note, en: en.hero.note },
      image: null,
      ctaLabel: { th: "", en: "" },
      ctaHref: "",
      /* สไลด์ตั้งต้นชุดเดียวกับหน้าเว็บ (จากโค้ด) */
      slides: HERO_SLIDES.map((slide, index) => ({
        id: `slide-${index + 1}`,
        image: {
          path: slide.src,
          /* alt ชุดเดียวกับหน้าเว็บ (พจนานุกรม) — ไม่ปล่อยว่าง */
          altTh: slideAltTh[slide.id]?.alt ?? "",
          altEn: slideAltEn[slide.id]?.alt ?? "",
          hasWatermark: false,
        },
        focusX: 50,
        focusY: 50,
        zoom: 1,
      })),
    },
    {
      /*
        บล็อกไดนามิก (รอบที่ 214): ดึง **ข้อมูลจริงจากฐานข้อมูล** ตอนเรนเดอร์
        (ชื่อหมวด/คำอธิบาย/ภาพ/จำนวนสินค้า + สินค้าแนะนำ) ⇒ ไม่มีข้อมูลปลอมค้างในเอกสาร
        ตัวเลือกเก็บในเอกสาร: คอลัมน์ · แสดงจำนวน · แสดงสินค้าแนะนำ — เลือกหมวดได้ (ว่าง = ทุกหมวด)
      */
      id: "block-2",
      version: BLOCK_SCHEMA_VERSION,
      type: "productShowcase",
      style: style(),
      heading: { th: th.products.categoriesTitle, en: en.products.categoriesTitle },
      body: { th: th.products.body, en: en.products.body },
      columns: 3,
      showFeatured: true,
      featuredPerCategory: 1,
      categoryIds: [],
      showCount: true,
    },
    {
      id: "block-3",
      version: BLOCK_SCHEMA_VERSION,
      type: "cards",
      style: style({ background: "subtle" }),
      heading: { th: th.whereToBuy.title, en: en.whereToBuy.title },
      body: { th: th.whereToBuy.body, en: en.whereToBuy.body },
      columns: 3,
      items: marketplaceCards(),
    },
  ];

  return { page: "home", blocks };
}
