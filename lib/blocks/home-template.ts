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
 * ⚠️ **รอบที่ 217 — ไม่มี "บล็อกแบนเนอร์" ในเทมเพลตนี้โดยตั้งใจ**
 *   หน้าแรกใช้ **hero จากเมนู "สไลด์ & แคมเปญ" (`/admin/hero`)** เป็นแหล่งเดียว
 *   (สไลด์จริงจากฐานข้อมูล + การ์ด PR) · ถ้าใส่บล็อก hero ด้วย จะกลายเป็น **แก้ได้สองที่** ⇒ สับสนแน่นอน
 *   ⇒ หน้าเว็บเรนเดอร์ hero จริงให้เสมอ **ทั้งสองโหมด** (บล็อก/เลย์เอาต์ในโค้ด) แล้วต่อด้วยบล็อกที่เหลือ
 * - ส่วนที่ต้องดึง **ข้อมูลจริงจากฐานข้อมูล** (จำนวนสินค้า/สินค้าแนะนำ · เมนูล่าสุด · ข่าวล่าสุด · ฟอร์มจดหมายข่าว)
 *   ยังทำในเทมเพลตไม่ได้ เพราะ "บล็อก" เป็นเนื้อหานิ่งที่พิมพ์เก็บในเอกสาร
 *   ⇒ ประกาศเป็น **ช่องที่ยังไม่ครอบคลุม** (`blockCoverageGaps("home")`) เพื่อให้หน้าจอเตือนก่อนกด "ใช้กับหน้าเว็บจริง"
 *   · ขั้นถัดไป = บล็อกไดนามิก (อ่านฐานข้อมูลตอนเรนเดอร์)
 */

function style(overrides: Partial<typeof DEFAULT_BLOCK_STYLE> = {}): typeof DEFAULT_BLOCK_STYLE {
  return { ...DEFAULT_BLOCK_STYLE, ...overrides };
}

/* พจนานุกรมของหมวดสินค้า/ช่องทาง — เปิดแบบกว้าง (คีย์มาจากทะเบียนกลาง ไม่ใช่พิมพ์เอง) */

export function buildHomeTemplate(): BlockDocument {
  const blocks: Block[] = [
    {
      /*
        บล็อกไดนามิก (รอบที่ 214): ดึง **ข้อมูลจริงจากฐานข้อมูล** ตอนเรนเดอร์
        (ชื่อหมวด/คำอธิบาย/ภาพ/จำนวนสินค้า + สินค้าแนะนำ) ⇒ ไม่มีข้อมูลปลอมค้างในเอกสาร
        ตัวเลือกเก็บในเอกสาร: คอลัมน์ · แสดงจำนวน · แสดงสินค้าแนะนำ — เลือกหมวดได้ (ว่าง = ทุกหมวด)
      */
      id: "block-1",
      version: BLOCK_SCHEMA_VERSION,
      type: "productShowcase",
      style: style(),
      heading: { th: th.products.title, en: en.products.title },
      body: { th: th.products.body, en: en.products.body },
      /* ปุ่ม "ดูผลิตภัณฑ์ทั้งหมด" (รอบที่ 220) — พาธกลาง จะถูกเติม /<ภาษา> ตอนเรนเดอร์ */
      ctaLabel: { th: th.actions.viewAllProducts, en: en.actions.viewAllProducts },
      ctaHref: "/products",
      columns: 3,
      showFeatured: true,
      featuredPerCategory: 1,
      categoryIds: [],
      showCount: true,
    },
    {
      id: "block-2",
      version: BLOCK_SCHEMA_VERSION,
      type: "recipeShowcase",
      style: style(),
      heading: { th: th.recipes.title, en: en.recipes.title },
      body: { th: th.recipes.body, en: en.recipes.body },
      ctaLabel: { th: th.actions.viewAllRecipes, en: en.actions.viewAllRecipes },
      ctaHref: "/recipes",
      columns: 3,
      limit: 3,
      showDates: true,
    },
    {
      /*
        บล็อกไดนามิก "เมนูล่าสุด" (รอบที่ 222 · คิวข้อ 3) — ดึงเมนูจริงจากฐานข้อมูล
        การ์ดพาไปหน้า /recipes (มี facade วิดีโอจริง · มติ D20 — ไม่เล่นวิดีโอในบล็อก)
      */
      id: "block-3",
      version: BLOCK_SCHEMA_VERSION,
      type: "newsShowcase",
      style: style(),
      heading: { th: th.news.title, en: en.news.title },
      body: { th: th.news.body, en: en.news.body },
      ctaLabel: { th: th.actions.viewAllNews, en: en.actions.viewAllNews },
      ctaHref: "/news",
      columns: 3,
      limit: 3,
      showDates: true,
      showExcerpts: true,
    },
    {
      /*
        จดหมายข่าว (รอบที่ 224 · คิวข้อ 5) — ใช้ของจริง: `richText` เป็นหัวข้อ/คำโปรย แล้วต่อด้วย
        บล็อก `form` ชนิด `newsletter` ซึ่งฝัง **ฟอร์มจริง + Server Action + consent** (ไม่สร้างใหม่)
      */
      id: "block-4",
      version: BLOCK_SCHEMA_VERSION,
      type: "form",
      style: style(),
      kind: "newsletter",
      /* หัวข้อ/คำโปรยของส่วนจดหมายข่าว (รอบที่ 224 · คิวข้อ 5) — ฟอร์มจริง + consent มาจาก `SubmitForm` เดิม */
      heading: { th: th.newsletter.title, en: en.newsletter.title },
      body: { th: th.newsletter.body, en: en.newsletter.body },
    },
  ];

  return { page: "home", blocks };
}
