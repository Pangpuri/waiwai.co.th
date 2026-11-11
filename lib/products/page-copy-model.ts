/**
 * ข้อความหัวหน้า `/products` — ชื่อ/types เดิมของหน้า products
 * ตรรกะจริงอยู่ที่ `lib/page-copy/model.ts` (ใช้ร่วมกับ recipes/news)
 */
export {
  MAX_PAGE_COPY_EYEBROW as MAX_PRODUCTS_PAGE_COPY_EYEBROW,
  MAX_PAGE_COPY_TITLE as MAX_PRODUCTS_PAGE_COPY_TITLE,
  MAX_PAGE_COPY_INTRO as MAX_PRODUCTS_PAGE_COPY_INTRO,
  type PageCopy as ProductsPageCopy,
  parsePageCopy as parseProductsPageCopy,
  withPageCopyFallback as withProductsPageCopyFallback,
} from "@/lib/page-copy/model";

export const PRODUCTS_PAGE_COPY_KEY = "products-page-copy";
