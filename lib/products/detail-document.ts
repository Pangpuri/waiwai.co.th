import { catalogSlugs, findCatalogItem } from "@/features/products/catalog";
import { TEMPLATE_BLOCK_VERSION, templateBlockId, templateMedia, templateStyle } from "@/lib/blocks/template-kit";
import type { Block, BlockDocument } from "@/lib/blocks/types";
import { en } from "@/lib/i18n/messages/en";
import { th } from "@/lib/i18n/messages/th";
import { productDetailPageId } from "@/lib/blocks/product-detail";
import { FALLBACK_CATEGORY_IMAGE_HEIGHT, FALLBACK_CATEGORY_IMAGE_WIDTH } from "@/lib/products/categories";

/**
 * ประกอบ **เอกสารบล็อกตั้งต้นของหน้า "รายละเอียดหมวดสินค้า"** (`/products/<slug>`) — รอบที่ 270 · มติเจ้าของ
 *
 * คำเจ้าของ: *"จอตัวสร้างหน้า รายละเอียดหมวดสินค้า 6 หน้า จัดการใส่ db พร้อมบล็อคเอกสาร
 * จัดการเรื่องการกดเผยแพร่ให้ขึ้นเว็บ พร้อมมีค่าดีฟอล ตามหน้าหน้าบ้าน หลังบ้านเพิ่มลบ จัดการได้ตาม
 * โครงสร้างหน้าบ้าน จัดการเปลี่ยนภาพ แก้ไขส่วนต่างๆได้อิสระ แต่ต้องบันทึกค่าเริ่มต้นตอนนี้เอาไว้"*
 *
 * ⇒ ไฟล์นี้คือ **"ค่าเริ่มต้น" ที่แหล่งเดียว** ของทั้ง 6 หน้า (มติเจ้าของ: เทมเพลต + ค่าจริงจาก DB)
 *   - ทะเบียนเทมเพลต (`lib/blocks/templates.ts`) เรียกผ่านปุ่ม **"เริ่มจากเทมเพลต"** ⇒ = คืนค่าเริ่มต้นเสมอ
 *   - ตัวนำเข้า `npm run products:detail-import` เรียกไฟล์นี้เพื่อเขียน **ฉบับร่าง** ในตาราง `page_document`
 *   สองทางเรียกตัวเดียวกัน ⇒ ไม่มี "เทมเพลตคนละชุดกับของจริง"
 *
 * กติกา
 * - **ค่าจริงจากฐานข้อมูลมาก่อน** (ชื่อ/คำอธิบาย/โลโก้หมวดที่แก้จาก `/admin/product-categories` — รอบ 254/264)
 *   · ว่าง/อ่านไม่ได้ ⇒ **ถอยไปใช้พจนานุกรม + ไฟล์ใน `public/products/`** (หน้าเว็บไม่พัง)
 * - **ไม่แต่งข้อความขึ้นเอง** — eyebrow/คำอธิบาย/ปุ่มย้อนกลับ มาจากพจนานุกรม `productsPage` ที่หน้าเว็บใช้อยู่
 * - ภาพต้องเป็น **พาธในเว็บ** (มติ D9) — ตัวนำเข้าส่ง `/media/<id>` มาให้
 * - slug ที่ไม่รู้จัก (ไม่อยู่ในโค้ดและไม่มีค่า DB) ⇒ `null` (ผู้เรียกต้องไม่เขียนทับหน้าอื่น — มติ Q-D)
 * - โครงเอกสาร = **1 บล็อกแบนเนอร์** ตามหน้าบ้านจริง: eyebrow (note) + ชื่อหมวด (title) + ภาพ + คำอธิบาย (subtitle) + ปุ่มย้อนกลับ
 *   · **ตารางสินค้าในหมวดไม่ใช่บล็อก** — หน้าเว็บต่อจากรายการจริงในฐานข้อมูลเสมอ (`ProductListSection`)
 *     ⇒ เจ้าของเพิ่ม/ลบ/ย้ายบล็อกได้อิสระโดยที่สินค้าจริงไม่มีทางหาย
 */

/**
 * ค่าจริงจากฐานข้อมูลของหมวด (ผู้เรียกที่อ่าน DB ได้เป็นคนส่งมา) — ไม่มี = ใช้ค่าในโค้ด/พจนานุกรม
 * ℹ️ `hasProducts` ยังอยู่ในชนิดข้อมูล (ผู้เรียกใช้ตัดสินใจ/แสดงผลได้) แต่ **เอกสารตั้งต้นไม่ใช้แล้ว**
 *    ตั้งแต่รอบที่ 272 — eyebrow ใช้ป้ายเดียวกับหน้าหมวด (ไม่มีสาขา "ตัวอย่าง/รออนุมัติ" อีก)
 */
export type ProductDetailCategoryValues = {
  readonly slug: string;
  readonly nameTh: string;
  readonly nameEn: string;
  readonly descriptionTh: string;
  readonly descriptionEn: string;
  /** โลโก้/ภาพหัวหมวดจากคลังภาพ (`/media/<id>`) — null = ใช้ไฟล์ใน `public/products/` */
  readonly imagePath: string | null;
  readonly imageWidth: number | null;
  readonly imageHeight: number | null;
  /** หมวดนี้มีสินค้าจริงแล้วหรือยัง — ใช้เลือกข้อความ eyebrow (แบบเดียวกับหน้าเว็บ) */
  readonly hasProducts: boolean;
};

/** ภาพหัวหน้าจากค่าจริง (เลือกโลโก้ก่อน แล้วจึงภาพหัวหมวด) — คืน null = ไม่มีภาพจากคลัง */
function mediaImageOf(
  values: ProductDetailCategoryValues,
): { readonly src: string; readonly width: number; readonly height: number } | null {
  if (values.imagePath === null || values.imagePath.trim() === "") return null;
  return {
    src: values.imagePath,
    width: values.imageWidth ?? FALLBACK_CATEGORY_IMAGE_WIDTH,
    height: values.imageHeight ?? FALLBACK_CATEGORY_IMAGE_HEIGHT,
  };
}

/** ข้อความเลือกภาษา: ค่าจาก DB → ค่าจากพจนานุกรม (ของในโค้ด) */
function textOf(primary: string, fallback: string): string {
  const value = primary.trim();
  return value === "" ? fallback : value;
}

/**
 * เอกสารตั้งต้นของหน้า detail 1 หน้า
 * @param slug slug ของหมวด (เช่น `instant-noodles`)
 * @param values ค่าจริงจากฐานข้อมูล (ไม่ส่ง = ใช้ค่าในโค้ด/พจนานุกรมล้วน)
 */
export function buildProductDetailDocument(
  slug: string,
  values: ProductDetailCategoryValues | null = null,
): BlockDocument | null {
  const item = findCatalogItem(slug);
  /* ไม่รู้จักทั้งในโค้ดและฐานข้อมูล ⇒ ไม่สร้าง (กันเขียนทับหน้าอื่น) */
  if (item === undefined && values === null) return null;

  const thPage = th.productsPage;
  const enPage = en.productsPage;
  const thCopy = item === undefined ? null : thPage.items[item.id];
  const enCopy = item === undefined ? null : enPage.items[item.id];

  const thImageAlt = thCopy?.imageAlt ?? thPage.detailStub.title;
  const enImageAlt = enCopy?.imageAlt ?? enPage.detailStub.title;
  const media = values === null ? null : mediaImageOf(values);

  const blocks: Block[] = [
    {
      id: templateBlockId(0),
      version: TEMPLATE_BLOCK_VERSION,
      type: "hero",
      style: templateStyle({ size: "lg", align: "left", width: "full" }),
      title: {
        th: values === null ? (thCopy?.name ?? slug) : textOf(values.nameTh, thCopy?.name ?? slug),
        en: values === null ? (enCopy?.name ?? slug) : textOf(values.nameEn, enCopy?.name ?? slug),
      },
      subtitle: {
        th: values === null ? thPage.detailStub.body : textOf(values.descriptionTh, thPage.detailStub.body),
        en: values === null ? enPage.detailStub.body : textOf(values.descriptionEn, enPage.detailStub.body),
      },
      /* รอบที่ 272: ป้ายเดียวกับหน้าหมวด (เดิมมีสาขา "ตัวอย่าง · รอการอนุมัติ" ที่ล้าสมัย) */
      note: { th: thPage.eyebrow, en: enPage.eyebrow },
      /* ภาพจริงจากคลังก่อน · ไม่มี ⇒ ไฟล์ที่นำเข้าจากเว็บเดิม (หมวดในโค้ดเท่านั้น) */
      image:
        media === null
          ? item === undefined
            ? null
            : templateMedia(item.image.src, thImageAlt, enImageAlt)
          : templateMedia(media.src, thImageAlt, enImageAlt),
      ctaLabel: { th: thPage.detailStub.back, en: enPage.detailStub.back },
      ctaHref: "/products",
    },
  ];

  return { page: productDetailPageId(slug), blocks };
}

/** slug ทั้งหมดที่สร้างเอกสารตั้งต้นได้ (หมวดในโค้ด) — ใช้กับตัวนำเข้า/เทสต์ */
export function defaultProductDetailSlugs(): readonly string[] {
  return catalogSlugs();
}
