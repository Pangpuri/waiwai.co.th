import { en } from "@/lib/i18n/messages/en";
import { th } from "@/lib/i18n/messages/th";
import { TEMPLATE_BLOCK_VERSION, templateBlockId, templateStyle } from "@/lib/blocks/template-kit";
import type { Block, BlockDocument } from "@/lib/blocks/types";

/**
 * เทมเพลตตั้งต้นของหน้า "ข่าวสาร" (`/news`) — S2 รอบที่ 83
 *
 * ⚠️ หน้านี้เป็น **หน้าตัวอย่าง (mockup) รอการอนุมัติ** — การ์ดในหน้านั้นเป็นข้อมูลทดสอบ
 *    ⇒ เทมเพลตนี้ให้เฉพาะ "ส่วนหัว + คำเตือนตัวอย่าง" และ **ไม่แต่งการ์ดข่าว/เมนูขึ้นเอง**
 *    (ผู้ใช้ต้องเพิ่มบล็อกและใส่เนื้อหาจริงเองเมื่อมีข้อมูล)
 */
export function buildNewsTemplate(): BlockDocument {
  const blocks: Block[] = [
    {
      id: templateBlockId(0),
      version: TEMPLATE_BLOCK_VERSION,
      type: "hero",
      style: templateStyle({ size: "lg", align: "left" }),
      title: { th: th.newsPage.title, en: en.newsPage.title },
      subtitle: { th: th.newsPage.intro, en: en.newsPage.intro },
      note: { th: th.newsPage.notice, en: en.newsPage.notice },
      image: null,
      ctaLabel: { th: "", en: "" },
      ctaHref: "",
    },
    {
      id: templateBlockId(1),
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

  return { page: "news", blocks };
}
