import { en } from "@/lib/i18n/messages/en";
import { th } from "@/lib/i18n/messages/th";
import { TEMPLATE_BLOCK_VERSION, templateBlockId, templateMedia, templateStyle } from "@/lib/blocks/template-kit";
import type { Block, BlockDocument } from "@/lib/blocks/types";

import { CATALOG_ITEMS } from "@/features/products/catalog";

/**
 * เทมเพลตตั้งต้นของหน้า "ผลิตภัณฑ์" (/products) — S2 รอบที่ 83 · แก้ href รอบที่ 101
 *
 * ที่มา: หมวดสินค้าจริง (`CATALOG_ITEMS` — slug/ไฟล์ภาพ) + ชื่อ/คำบรรยายภาพจากพจนานุกรม
 * ⚠️ หน้านี้เป็น **ตัวอย่างรอการอนุมัติ** (หน้ารายละเอียดสินค้ายังไม่มีเนื้อหา) ⇒ การ์ดจึงพาไปที่หน้ารออนุมัติเดิม
 * ⚠️ `href` ต้องเป็น **พาธกลาง** (`/products/<slug>`) ไม่ใส่ prefix ภาษา — ตัวเรนเดอร์เติมภาษาของหน้าปัจจุบันให้เอง
 *    (รอบที่ 101: เดิมใส่ `catalogHref("th", …)` ⇒ หน้า `/en/products` การ์ดพาไปหน้าไทย)
 */
export function buildProductsTemplate(): BlockDocument {
  const blocks: Block[] = [
    {
      id: templateBlockId(0),
      version: TEMPLATE_BLOCK_VERSION,
      type: "hero",
      style: templateStyle({ size: "lg", align: "left" }),
      title: { th: th.productsPage.title, en: en.productsPage.title },
      subtitle: { th: th.productsPage.intro, en: en.productsPage.intro },
      note: { th: th.productsPage.notice, en: en.productsPage.notice },
      image: null,
      ctaLabel: { th: "", en: "" },
      ctaHref: "",
    },
    {
      id: templateBlockId(1),
      version: TEMPLATE_BLOCK_VERSION,
      type: "cards",
      style: templateStyle({ background: "cream" }),
      heading: { th: th.productsPage.eyebrow, en: en.productsPage.eyebrow },
      body: { th: th.productsPage.cardCta, en: en.productsPage.cardCta },
      columns: 3,
      items: CATALOG_ITEMS.map((item) => ({
        title: {
          th: th.productsPage.items[item.id].name,
          en: en.productsPage.items[item.id].name,
        },
        body: { th: "", en: "" },
        href: `/products/${item.slug}`,
        image: templateMedia(
          item.image.src,
          th.productsPage.items[item.id].imageAlt,
          en.productsPage.items[item.id].imageAlt,
        ),
      })),
    },
  ];

  return { page: "products", blocks };
}
