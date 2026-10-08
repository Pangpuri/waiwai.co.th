import { formatRecipeDate } from "@/lib/recipes/model";
import type { RecipeRecord } from "@/lib/recipes/repository";
import type { Language } from "@/lib/content/home-section";

/**
 * ชั้นข้อมูล + ตรรกะของ **บล็อกไดนามิก "เมนูล่าสุด"** — รอบที่ 221 (คิวข้อ 3)
 *
 * เจ้าของสั่ง *"ลุยคิวถัดไปเลยครับ"* ต่อจากบล็อกหมวดสินค้า (รอบ 211–220)
 * บล็อกนี้เก็บแค่ **ตัวเลือก** แล้วดึงเมนูจริงจากฐานข้อมูลตอนเรนเดอร์ (แบบเดียวกับ `product-showcase.ts`)
 *
 * กติกา
 * - **ไม่มีข้อมูล = ไม่เรนเดอร์** (`isEmpty`) — หน้าเว็บต้องไม่พังเพราะฐานข้อมูลว่าง/ล่ม
 * - เก็บ **พาธ** ไม่เก็บ URL เต็ม (มติ D9) · **ไม่เก็บ URL YouTube** (มติ D20) — การ์ดไม่ได้เล่นวิดีโอในตัว
 *   (ผู้ใช้กดดูที่หน้า `/recipes` ซึ่งมี facade ของจริง)
 * - ตรรกะล้วน (ไม่แตะ DB/React) ⇒ ทดสอบได้ด้วย `node --test`
 */
export type RecipeShowcaseOptions = {
  readonly columns: 1 | 2 | 3;
  /** จำนวนเมนูที่แสดง (3–12) */
  readonly limit: number;
  /** แสดงวันที่เผยแพร่บนการ์ด */
  readonly showDates: boolean;
};

export const DEFAULT_RECIPE_SHOWCASE: RecipeShowcaseOptions = { columns: 3, limit: 3, showDates: true };

export const MIN_RECIPE_SHOWCASE_LIMIT = 3;
export const MAX_RECIPE_SHOWCASE_LIMIT = 12;

/** บีบค่าตัวเลือกให้อยู่ในช่วงที่ใช้ได้ (ค่าจากเอกสารไม่เชื่อถือได้) */
export function clampRecipeShowcaseOptions(options: Partial<RecipeShowcaseOptions>): RecipeShowcaseOptions {
  const columns = options.columns === 1 || options.columns === 2 || options.columns === 3 ? options.columns : DEFAULT_RECIPE_SHOWCASE.columns;
  const limit = options.limit;
  return {
    columns,
    limit:
      typeof limit === "number" && Number.isFinite(limit)
        ? Math.min(MAX_RECIPE_SHOWCASE_LIMIT, Math.max(MIN_RECIPE_SHOWCASE_LIMIT, Math.round(limit)))
        : DEFAULT_RECIPE_SHOWCASE.limit,
    showDates: options.showDates ?? DEFAULT_RECIPE_SHOWCASE.showDates,
  };
}

/** อ่านตัวเลือกจากก้อนข้อมูลดิบ (JSONB) ที่ไม่เชื่อถือได้ */
export function recipeShowcaseOptionsFromUnknown(raw: Readonly<Record<string, unknown>>): RecipeShowcaseOptions {
  const columns = raw["columns"];
  const limit = raw["limit"];
  return clampRecipeShowcaseOptions({
    columns: columns === 1 || columns === 2 || columns === 3 ? columns : undefined,
    limit: typeof limit === "number" ? limit : undefined,
    showDates: typeof raw["showDates"] === "boolean" ? raw["showDates"] : undefined,
  });
}

export type RecipeShowcaseItemView = {
  readonly id: string;
  readonly title: string;
  /** วันที่แบบไทย/อังกฤษ (ว่าง = ไม่มีวันที่) */
  readonly dateLabel: string;
  /** `/media/<id>` หรือ null */
  readonly image: string | null;
};

export type RecipeShowcaseView = {
  readonly items: readonly RecipeShowcaseItemView[];
  /** true = ไม่มีเมนูจริง ⇒ ตัวเรนเดอร์ต้องไม่แสดงบล็อกนี้ */
  readonly isEmpty: boolean;
};

/**
 * ประกอบวิวจากเมนูจริง — เรียงตามลำดับที่ฐานข้อมูลคืนมา (เมนูล่าสุดก่อน) แล้วตัดตาม `limit`
 * ⚠️ ไม่เล่นวิดีโอในบล็อก (มติ D20) — การ์ดพาไปหน้า `/recipes` ที่มี facade จริง
 */
export function recipeShowcaseView(
  recipes: readonly RecipeRecord[],
  rawOptions: Partial<RecipeShowcaseOptions>,
  language: Language,
): RecipeShowcaseView {
  const options = clampRecipeShowcaseOptions(rawOptions);
  const items: readonly RecipeShowcaseItemView[] = recipes.slice(0, options.limit).map((recipe) => ({
    id: recipe.id,
    title: language === "en" && recipe.titleEn.trim() !== "" ? recipe.titleEn : recipe.titleTh,
    dateLabel: options.showDates ? formatRecipeDate(recipe.publishedOn, language) : "",
    image: recipe.coverPath,
  }));
  return { items, isEmpty: items.length === 0 };
}

/** ตัวเลือกเริ่มต้นของบล็อก (ใช้ตอนเพิ่มบล็อกใหม่/เทมเพลต) */
export const RECIPE_SHOWCASE_BLOCK_DEFAULTS = {
  columns: DEFAULT_RECIPE_SHOWCASE.columns,
  limit: DEFAULT_RECIPE_SHOWCASE.limit,
  showDates: DEFAULT_RECIPE_SHOWCASE.showDates,
} as const;
