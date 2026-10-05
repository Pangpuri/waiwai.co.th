import { TEMPLATE_BLOCK_VERSION, templateBlockId, templateMedia, templateStyle } from "@/lib/blocks/template-kit";
import { productDetailPageId } from "@/lib/blocks/product-detail";
import type { Block, BlockDocument } from "@/lib/blocks/types";
import { findCatalogItem } from "@/features/products/catalog";
import { en } from "@/lib/i18n/messages/en";
import { th } from "@/lib/i18n/messages/th";

/**
 * เทมเพลตตั้งต้นของหน้า "รายละเอียดหมวดสินค้า" 1 หน้า — S3 ส่วนที่ 2 · รอบที่ 102
 *
 * ที่มา (ไม่แต่งเนื้อหาขึ้นเอง — ใช้ของจริง/ของที่เจ้าของให้)
 * - ชื่อหมวด + ไฟล์ภาพ: `CATALOG_ITEMS` (หมวดจริง 6 หมวด · ภาพใน `public/products/`)
 * - คำอธิบาย "ยังไม่เปิดใช้งาน" + ปุ่มย้อนกลับ: พจนานุกรม `productsPage.detailStub`
 *   ⇒ เทมเพลตนี้คือ **สำเนาของหน้า stub เดิมในรูปบล็อก** ⇒ เปิดสวิตช์ "ใช้กับหน้าเว็บจริง" แล้วหน้าไม่หายไป
 *
 * ⚠️ ล็อก 6 หมวด (มติ Q-D) ⇒ `slug` ที่ไม่รู้จักคืน `null` (ผู้เรียกต้องไม่เขียนทับหน้าอื่น)
 * ⚠️ ต้องผ่าน parser + validator ของระบบ (มีเทสต์บังคับ): ชื่อ/ภาพมี alt · `href` เป็นพาธกลาง (`/products`)
 */
export function buildProductDetailTemplate(slug: string): BlockDocument | null {
  const item = findCatalogItem(slug);
  if (item === undefined) return null;

  const thCopy = th.productsPage.items[item.id];
  const enCopy = en.productsPage.items[item.id];
  const thStub = th.productsPage.detailStub;
  const enStub = en.productsPage.detailStub;

  const blocks: Block[] = [
    {
      id: templateBlockId(0),
      version: TEMPLATE_BLOCK_VERSION,
      type: "hero",
      style: templateStyle({ size: "lg", align: "left", width: "full" }),
      title: { th: thCopy.name, en: enCopy.name },
      subtitle: { th: thStub.body, en: enStub.body },
      note: { th: thStub.eyebrow, en: enStub.eyebrow },
      image: templateMedia(item.image.src, thCopy.imageAlt, enCopy.imageAlt),
      ctaLabel: { th: thStub.back, en: enStub.back },
      ctaHref: "/products",
    },
  ];

  return { page: productDetailPageId(slug), blocks };
}
