import { CATALOG_ITEMS } from "@/features/products/catalog";
import type { ProductCategoryCardRecord, ProductHighlightRecord } from "@/lib/products/repository";
import { catalogHref } from "@/features/products/catalog";
/* รวมหมวดในโค้ด + หมวดจากฐานข้อมูล (มติ D25 · รอบที่ 264) */
import { mergeSiteCategories, siteCategoryDescription, siteCategoryName } from "@/lib/products/categories";
import { formatRecipeDate } from "@/lib/recipes/model";
import { formatNewsDate, newsPathOfId } from "@/lib/news/model";
import { localePath, type Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages/th";
import type { RecipeRecord } from "@/lib/recipes/repository";
import type { NewsRecord } from "@/lib/news/repository";

/**
 * แปลงข้อมูลจริงจากฐานข้อมูล → ข้อมูลที่ "หน้าแรก" ใช้แสดง (รอบที่ 108) — **ตรรกะล้วน ไม่มี DB/DOM**
 *
 * ทำไมต้องแยกมาไว้ที่นี่
 * - หน้าแรกมี 3 ส่วนที่ต้องเอาของจริงมาแสดง (สินค้า · เมนูอาหาร · ข่าว) — การแปลง/เรียง/ถอยค่าภาษา
 *   เป็นตรรกะที่ต้อง **เทสต์ได้โดยไม่ต้องมีฐานข้อมูล** (เทสต์เร็วและไม่พังตอน CI ไม่มี DB)
 * - **slug ต้องมาจาก `CATALOG_ITEMS` เท่านั้น** (แหล่งความจริงเดียว) — บทเรียนจริงรอบที่ 108:
 *   หน้าแรกเคยฝัง slug เอง (`/products/cup-noodles`) ซึ่งไม่มีอยู่จริง ⇒ ลิงก์เสีย 4 เส้น
 *
 * กติกาภาษา (เหมือนส่วนอื่นของโปรเจกต์): อังกฤษว่าง → ถอยไปใช้ไทย · ไทยว่าง → คืนสตริงว่าง (ผู้เรียกซ่อนช่องนั้น)
 */

export type HomeImage = {
  /** พาธ `/media/<id>` หรือไฟล์ใน `public/` */
  readonly src: string;
  readonly width: number;
  readonly height: number;
};

export type HomeCategoryCard = {
  /** slug ของหมวด (= `id` ในฐานข้อมูล) — หมวดที่สร้างใหม่จากหลังบ้านไม่มีคีย์พจนานุกรม */
  readonly id: string;
  readonly slug: string;
  readonly href: string;
  readonly name: string;
  readonly description: string;
  /** จำนวนสินค้าในหมวด — 0 = ไม่มีข้อมูล (ซ่อนตัวเลขได้) */
  readonly productCount: number;
  readonly image: HomeImage;
  /** ข้อความ alt ของภาพหมวด — มาจากพจนานุกรม (หมวดในโค้ด) หรือชื่อหมวด (หมวดใหม่) */
  readonly imageAlt: string;
  /** true = ภาพมาจากคลัง (ฐานข้อมูล) · false = ภาพในโค้ด `public/products/*` */
  readonly imageFromDatabase: boolean;
};

export type HomeProductHighlight = {
  readonly id: string;
  readonly href: string;
  readonly name: string;
  readonly categoryName: string;
  readonly image: HomeImage;
};

export type HomeRecipeItem = {
  readonly id: string;
  readonly title: string;
  readonly href: string;
  readonly date: string;
  readonly image: HomeImage | null;
};

export type HomeNewsItem = {
  readonly id: string;
  readonly title: string;
  readonly excerpt: string;
  readonly href: string;
  readonly published: string;
  readonly dateTime: string;
  readonly image: HomeImage | null;
};

/** เลือกข้อความตามภาษา (อังกฤษว่าง = ใช้ไทย) */
function pick(th: string, en: string, language: Locale): string {
  const english = en.trim();
  return language === "en" && english !== "" ? english : th.trim();
}

/**
 * การ์ดหมวดสินค้าของหน้าแรก
 *
 * รอบที่ 264 (มติ D25): **หมวดในโค้ด 6 ใบ + หมวดที่สร้างใหม่จากหลังบ้าน + ลำดับที่ผู้ดูแลจัด**
 * ฐานข้อมูลเติม "คำอธิบาย · ภาพจริง · จำนวนสินค้า" ให้ — ไม่มี DB ก็ยังเป็นการ์ดที่ลิงก์ถูกทุกใบ
 * ⚠️ หมวดที่ถูก **"ซ่อนจากเว็บ"** ไม่ถูกส่งมาแล้ว (`listProductCategoryCards()` กรองที่ SQL และ merge กรองซ้ำ)
 */
export function homeCategoryCards(
  rows: readonly ProductCategoryCardRecord[],
  language: Locale,
  messages: Messages,
): readonly HomeCategoryCard[] {
  const builtIn = CATALOG_ITEMS.map((item) => ({
    slug: item.slug,
    name: messages.productsPage.items[item.id].name,
    imageAlt: messages.productsPage.items[item.id].imageAlt,
    imageSrc: item.image.src,
    imageWidth: item.image.width,
    imageHeight: item.image.height,
  }));

  return mergeSiteCategories(builtIn, rows, language).map((category) => ({
    id: category.slug,
    slug: category.slug,
    href: catalogHref(language, category.slug),
    name: siteCategoryName(category, language),
    description: siteCategoryDescription(category, language),
    productCount: category.productCount,
    image: { src: category.imageSrc, width: category.imageWidth, height: category.imageHeight },
    imageAlt: category.imageAlt,
    imageFromDatabase: category.imageSrc.startsWith("/media/"),
  }));
}

/**
 * สินค้าเด่น — 1 ตัวต่อหมวด **ตามลำดับการ์ดหมวดที่แสดงจริง** · **ไม่มีข้อมูล = คืน []** (ผู้เรียกซ่อนส่วนนี้)
 * ⚠️ ไม่มีข้อมูลจำลอง: ห้ามแต่งชื่อสินค้าขึ้นเอง (บทเรียน: การ์ด "ข้อมูลทดสอบ" บนหน้าเว็บจริง)
 * ⚠️ รอบที่ 264: รับ "การ์ดหมวดที่แสดงจริง" เข้ามา ⇒ หมวดที่ถูกซ่อนไม่โผล่ · หมวดใหม่ก็มีสินค้าเด่นได้
 */
export function homeProductHighlights(
  rows: readonly ProductHighlightRecord[],
  language: Locale,
  categories: readonly HomeCategoryCard[],
): readonly HomeProductHighlight[] {
  const byCategory = new Map(rows.map((row) => [row.categoryId, row]));

  const items: HomeProductHighlight[] = [];
  for (const category of categories) {
    /* ⚠️ `category_id` ในฐานข้อมูล = slug (ไม่ใช่คีย์พจนานุกรม) */
    const row = byCategory.get(category.slug);
    if (row === undefined || row.imagePath === null || row.imageWidth === null || row.imageHeight === null) continue;

    const name = pick(row.nameTh, row.nameEn, language);
    if (name === "") continue;

    items.push({
      id: row.id,
      /* ยังไม่มีหน้ารายละเอียดสินค้ารายชิ้น ⇒ พาไปหน้าหมวดของสินค้านั้น (ไม่ใช่ลิงก์ตาย) */
      href: catalogHref(language, category.slug),
      name,
      categoryName: category.name,
      image: { src: row.imagePath, width: row.imageWidth, height: row.imageHeight },
    });
  }
  return items;
}

/** เมนูอาหารล่าสุด (วิดีโอ) — เรียงตามที่ฐานข้อมูลส่งมา (ตัวใหม่สุดก่อน) แล้วตัดตามจำนวนที่ขอ */
export function homeRecipeItems(
  rows: readonly RecipeRecord[],
  language: Locale,
  limit: number,
): readonly HomeRecipeItem[] {
  const items: HomeRecipeItem[] = [];
  for (const row of rows) {
    if (items.length >= limit) break;
    const title = pick(row.titleTh, row.titleEn, language);
    if (title === "") continue;
    items.push({
      id: row.id,
      title,
      /* หน้าแรกไม่มีวิดีโอในตัว — กดแล้วไปดูที่หน้ารวมเมนู (ซึ่งมี facade โหลด YouTube เมื่อผู้ใช้กด) */
      href: localePath(language, "/recipes"),
      date: formatRecipeDate(row.publishedOn, language),
      image:
        row.coverPath === null || row.coverWidth === null || row.coverHeight === null
          ? null
          : { src: row.coverPath, width: row.coverWidth, height: row.coverHeight },
    });
  }
  return items;
}

/** ข่าวล่าสุด — **การ์ดต้องกดไปหน้าข่าวนั้นได้จริง** (รอบที่ 108) */
export function homeNewsItems(
  rows: readonly NewsRecord[],
  language: Locale,
  limit: number,
): readonly HomeNewsItem[] {
  const items: HomeNewsItem[] = [];
  for (const row of rows) {
    if (items.length >= limit) break;
    const title = pick(row.titleTh, row.titleEn, language);
    if (title === "") continue;
    items.push({
      id: row.id,
      title,
      excerpt: pick(row.excerptTh, row.excerptEn, language),
      href: localePath(language, newsPathOfId(row.id)),
      published: formatNewsDate(row.publishedLocal, language),
      dateTime: row.publishedLocal ?? "",
      image:
        row.coverPath === null || row.coverWidth === null || row.coverHeight === null
          ? null
          : { src: row.coverPath, width: row.coverWidth, height: row.coverHeight },
    });
  }
  return items;
}
