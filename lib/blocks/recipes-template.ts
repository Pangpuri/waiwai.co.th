import { en } from "@/lib/i18n/messages/en";
import { th } from "@/lib/i18n/messages/th";
import { TEMPLATE_BLOCK_VERSION, templateBlockId, templateStyle } from "@/lib/blocks/template-kit";
import type { Block, BlockDocument } from "@/lib/blocks/types";

/**
 * เทมเพลตตั้งต้นของหน้า "เมนูอาหาร" (`/recipes`) — S2 รอบที่ 83 · เพิ่มบล็อกเมนู รอบที่ 101
 *
 * ⚠️ หน้านี้เป็น **หน้าตัวอย่าง (mockup) รอการอนุมัติ** ⇒ เทมเพลต **ไม่แต่งเมนูปลอมขึ้นเอง**
 *    แต่ให้ "ส่วนหัว + บล็อกเมนูอาหารว่าง" ⇒ การตลาดกด "เพิ่มเมนู" แล้วใส่ชื่อ/ภาพ/ส่วนผสม/วิธีทำเองได้ทันที
 *    (ตอนเปิดใช้กับหน้าเว็บจริง การ์ดตัวอย่างเดิมจะหายไป — `blockCoverageGaps("recipes")` เตือนไว้แล้ว)
 */
export function buildRecipesTemplate(): BlockDocument {
  const blocks: Block[] = [
    {
      id: templateBlockId(0),
      version: TEMPLATE_BLOCK_VERSION,
      type: "hero",
      style: templateStyle({ size: "lg", align: "left" }),
      title: { th: th.recipesPage.title, en: en.recipesPage.title },
      subtitle: { th: th.recipesPage.intro, en: en.recipesPage.intro },
      note: { th: th.recipesPage.notice, en: en.recipesPage.notice },
      image: null,
      ctaLabel: { th: "", en: "" },
      ctaHref: "",
    },
    {
      id: templateBlockId(1),
      version: TEMPLATE_BLOCK_VERSION,
      type: "recipeCards",
      style: templateStyle({ width: "wide" }),
      heading: { th: th.recipesPage.eyebrow, en: en.recipesPage.eyebrow },
      body: { th: "", en: "" },
      columns: 2,
      items: [],
    },
    {
      id: templateBlockId(2),
      version: TEMPLATE_BLOCK_VERSION,
      type: "cta",
      style: templateStyle(),
      heading: { th: th.productsPage.title, en: en.productsPage.title },
      body: { th: th.productsPage.intro, en: en.productsPage.intro },
      label: { th: th.nav.products, en: en.nav.products },
      href: "/products",
      tone: "brand",
    },
  ];

  return { page: "recipes", blocks };
}
