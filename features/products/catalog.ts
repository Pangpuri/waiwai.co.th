import { localePath, type Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages/th";

/**
 * แค็ตตาล็อกหมวดผลิตภัณฑ์ (หน้า `/products` + หน้ารายละเอียด) — pure module
 *
 * ภาพเป็นไฟล์จริงที่ผู้ใช้ให้มา (โลโก้หมวด/แบรนด์) เก็บใน `public/products/`
 * ชื่อหมวดและคำบรรยายภาพอยู่ในพจนานุกรมตาม id ส่วน slug/ไฟล์ภาพอยู่ที่นี่
 *
 * ⚠️ หน้านี้เป็น **ตัวอย่างเพื่อให้ฝ่ายการตลาดพิจารณา** — เนื้อหารายละเอียดสินค้า
 *    ยังไม่ได้ทำ (หน้ารายละเอียดเป็นเพียงหน้ารออนุมัติ) และภาพต้นทางมีความกว้างแค่ 300px
 *    ถ้าจะขึ้นใช้งานจริงควรขอไฟล์ความละเอียดสูงกว่านี้ (ดู PRODUCT_ROADMAP.md § 9)
 */

export type CatalogItemId = keyof Messages["productsPage"]["items"];

export type CatalogItem = {
  readonly id: CatalogItemId;
  /** ใช้เป็น path ของหน้ารายละเอียด (ยังไม่มีเนื้อหา — เป็นหน้า "ตัวอย่างรออนุมัติ") */
  readonly slug: string;
  readonly image: {
    /** path ใต้ public/ */
    readonly src: string;
    readonly width: number;
    readonly height: number;
  };
};

/** เรียงตามลำดับที่แสดงบนหน้า — หมวดรวมก่อน แล้วตามด้วยแบรนด์ในเครือ */
export const CATALOG_ITEMS: readonly CatalogItem[] = [
  {
    id: "instantNoodles",
    slug: "instant-noodles",
    image: { src: "/products/instant-noodles.png", width: 300, height: 224 },
  },
  {
    id: "driedVermicelli",
    slug: "dried-vermicelli",
    image: { src: "/products/dried-vermicelli.png", width: 300, height: 189 },
  },
  {
    id: "viroda",
    slug: "viroda",
    image: { src: "/products/viroda.png", width: 300, height: 257 },
  },
  {
    id: "quickZabb",
    slug: "quick-zabb",
    image: { src: "/products/quick-zabb.png", width: 300, height: 157 },
  },
  {
    id: "noodle",
    slug: "noodle",
    image: { src: "/products/noodle.png", width: 300, height: 196 },
  },
  {
    id: "rodDed",
    slug: "rod-ded",
    image: { src: "/products/rod-ded.png", width: 300, height: 253 },
  },
];

/** path ของหน้ารายละเอียดหมวด (ยังไม่มีเนื้อหา) */
export function catalogHref(locale: Locale, slug: string): string {
  return localePath(locale, `/products/${slug}`);
}

/** หาหมวดจาก slug — คืน undefined ถ้าไม่รู้จัก (ผู้เรียกต้อง notFound()) */
export function findCatalogItem(slug: string): CatalogItem | undefined {
  return CATALOG_ITEMS.find((item) => item.slug === slug);
}

/** slug ทั้งหมด — ใช้กับ generateStaticParams ของหน้ารายละเอียด */
export function catalogSlugs(): readonly string[] {
  return CATALOG_ITEMS.map((item) => item.slug);
}
