import type { LocalizedValue } from "@/lib/content/types";

/**
 * ข้อความหัวหน้าหน้าเนื้อหา (eyebrow / title / intro) — **ตรรกะล้วน ไม่มี Next/DB**
 *
 * ใช้ร่วมกันหลายหน้า:
 *   · `/products` → คีย์ `products-page-copy`
 *   · `/recipes` → คีย์ `recipes-page-copy`
 *   · `/news` → คีย์ `news-page-copy`
 *
 * ⚠️ แยกจากชั้นโหลด/บันทึก (`lib/page-copy/store.ts`) เพื่อให้
 *    · client component ใช้ชนิดได้โดยไม่ดึงโค้ดเซิร์ฟเวอร์
 *    · เทสต์รันด้วย `node --test` โดยไม่ต้องมี Next runtime
 */

export const MAX_PAGE_COPY_EYEBROW = 80;
export const MAX_PAGE_COPY_TITLE = 120;
export const MAX_PAGE_COPY_INTRO = 600;

export type PageCopy = {
  readonly eyebrow: LocalizedValue;
  readonly title: LocalizedValue;
  readonly intro: LocalizedValue;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function readLocalized(value: unknown, max: number): LocalizedValue {
  const record = isRecord(value) ? value : {};
  return {
    th: readText(record["th"], max),
    en: readText(record["en"], max),
  };
}

/** แปลง JSON จาก DB/ฟอร์ม — คืน null เมื่อรูปทรงไม่ใช่ออบเจ็กต์ */
export function parsePageCopy(raw: unknown): PageCopy | null {
  if (!isRecord(raw)) return null;
  return {
    eyebrow: readLocalized(raw["eyebrow"], MAX_PAGE_COPY_EYEBROW),
    title: readLocalized(raw["title"], MAX_PAGE_COPY_TITLE),
    intro: readLocalized(raw["intro"], MAX_PAGE_COPY_INTRO),
  };
}

/** เติมช่องว่างด้วยข้อความเดิม (ใช้ทั้งหน้าเว็บและหน้าจอแก้ไข) */
export function withPageCopyFallback(copy: PageCopy, fallback: PageCopy): PageCopy {
  const pick = (value: string, fallbackValue: string): string => (value.trim() === "" ? fallbackValue : value);
  return {
    eyebrow: {
      th: pick(copy.eyebrow.th, fallback.eyebrow.th),
      en: pick(copy.eyebrow.en, fallback.eyebrow.en),
    },
    title: {
      th: pick(copy.title.th, fallback.title.th),
      en: pick(copy.title.en, fallback.title.en),
    },
    intro: {
      th: pick(copy.intro.th, fallback.intro.th),
      en: pick(copy.intro.en, fallback.intro.en),
    },
  };
}

/** ค่าเริ่มต้นของหน้าเมื่อยังไม่เคยตั้งค่า — ใช้ข้อความจากพจนานุกรมของภาษานั้น */
export function defaultPageCopy(eyebrow: string, title: string, intro: string): PageCopy {
  return {
    eyebrow: { th: eyebrow, en: eyebrow },
    title: { th: title, en: title },
    intro: { th: intro, en: intro },
  };
}
