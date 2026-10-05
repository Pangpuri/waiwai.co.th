/**
 * โมเดล "ข่าวสาร & กิจกรรม" ที่นำเข้าจากเว็บเดิม (หน้า /news · รอบที่ 105) — **ตรรกะล้วน ทดสอบได้**
 *
 * - `id = n<source_id>` (เช่น `n148398`) และ **พาธหน้าเว็บ = `/news/<source_id>`** (ตัวเลขล้วน)
 *   ⇒ URL คงที่ ปลอดภัย และขึ้นต้นด้วย id เดียวกับเว็บเดิม (ทำ 301 ให้ตรงรุ่นได้ในอนาคต)
 * - วันที่จากเว็บเดิมเป็น **เวลาไทย** (Asia/Bangkok · UTC+7) ⇒ เก็บเป็น `timestamptz` ด้วย `bangkokInstantOf()`
 *   และ **อ่านกลับเป็นสตริงเวลาไทย** (ดู `lib/news/repository.ts`) ⇒ ไม่มีปัญหาย้ายเซิร์ฟเวอร์/เขตเวลา
 * - EN: เว็บเดิมไม่มีเนื้อหาอังกฤษเลย ⇒ ฟิลด์ EN ว่างได้ (ผู้แสดงผลถอยไปใช้ไทย — ธรรมเนียมเดียวกับสินค้า/เมนู)
 */

import { bangkokInstantOf } from "@/lib/import/thai-date";

export const MAX_NEWS_TITLE_LENGTH = 400;
export const MAX_NEWS_EXCERPT_LENGTH = 600;

export type NewsInput = {
  readonly id: string;
  readonly sourceId: string;
  /** พาธในเว็บเดิม */
  readonly sourceUrl: string;
  readonly titleTh: string;
  readonly titleEn: string;
  readonly excerptTh: string;
  readonly excerptEn: string;
  /** `YYYY-MM-DDTHH:MM` (เวลาไทย) หรือ null ถ้าอ่านวันที่ไม่ได้ */
  readonly publishedLocal: string | null;
  /** ข้อความวันที่ดิบจากต้นฉบับ */
  readonly publishedLabel: string;
};

export type NewsIssue = {
  readonly code: string;
  readonly path: string;
  readonly message: string;
};

export function newsIdOfSourceId(sourceId: string): string {
  return `n${sourceId.trim()}`;
}

/** `n148398` → `148398` (ใช้ทำพาธหน้าเว็บ) */
export function newsSourceIdOfId(id: string): string {
  return id.trim().replace(/^n/, "");
}

/** พาธหน้าเว็บของข่าว (ไม่มี `/th`/`/en` — ผู้เรียกเติมด้วย `localePath`) */
export function newsPathOfSourceId(sourceId: string): string {
  return `/news/${sourceId.trim()}`;
}

export function newsPathOfId(id: string): string {
  return newsPathOfSourceId(newsSourceIdOfId(id));
}

/** ค่าที่ใส่ `timestamptz` ได้ (เวลาไทย → มีเขตเวลา) — null = ไม่มีวันที่ */
export function newsInstantOf(publishedLocal: string | null): string | null {
  return publishedLocal === null || publishedLocal.trim() === "" ? null : bangkokInstantOf(publishedLocal.trim());
}

/**
 * แสดงวันที่ตามภาษา — `2026-09-12T11:28` (เวลาไทย) → `12 กันยายน 2569` / `12 September 2026`
 * ⚠️ ใช้ `timeZone: "UTC"` กับสตริงที่แปลว่า "เวลาไทยอยู่แล้ว" ⇒ ผลไม่ขึ้นกับเขตเวลาของเซิร์ฟเวอร์
 * ⚠️ ภาษาไทยที่ Intl ให้มาคือ **พุทธศักราช** (ตั้งใจ — ตรงกับที่หน้าเว็บเมนูอาหารแสดงอยู่)
 */
export function formatNewsDate(publishedLocal: string | null, language: "th" | "en", withTime = false): string {
  if (publishedLocal === null || publishedLocal.trim() === "") return "";
  const value = publishedLocal.trim();
  const date = new Date(`${value}:00Z`);
  if (Number.isNaN(date.getTime())) return value;

  const locale = language === "th" ? "th-TH" : "en-GB";
  try {
    const day = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
    if (!withTime) return day;
    const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" }).format(date);
    return `${day} · ${time}`;
  } catch {
    return value;
  }
}

export function validateNewsInput(input: NewsInput): readonly NewsIssue[] {
  const issues: NewsIssue[] = [];

  if (input.id !== newsIdOfSourceId(input.sourceId)) {
    issues.push({ code: "id-mismatch", path: "id", message: `id ต้องเป็น "${newsIdOfSourceId(input.sourceId)}"` });
  }
  if (!/^\d{3,}$/.test(input.sourceId.trim())) {
    issues.push({ code: "bad-source-id", path: "sourceId", message: `source id ต้องเป็นตัวเลข (ได้ "${input.sourceId}")` });
  }
  if (input.titleTh.trim() === "") {
    issues.push({ code: "empty-title", path: "titleTh", message: "หัวข้อข่าวห้ามว่าง" });
  }
  if (input.titleTh.length > MAX_NEWS_TITLE_LENGTH) {
    issues.push({ code: "title-too-long", path: "titleTh", message: `หัวข้อยาวเกิน ${MAX_NEWS_TITLE_LENGTH}` });
  }
  if (input.excerptTh.length > MAX_NEWS_EXCERPT_LENGTH) {
    issues.push({ code: "excerpt-too-long", path: "excerptTh", message: `คำโปรยยาวเกิน ${MAX_NEWS_EXCERPT_LENGTH}` });
  }
  if (input.publishedLocal !== null && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input.publishedLocal)) {
    issues.push({ code: "bad-date", path: "publishedLocal", message: `วันที่ต้องเป็น YYYY-MM-DDTHH:MM (ได้ "${input.publishedLocal}")` });
  }
  if (input.sourceUrl !== "" && !input.sourceUrl.startsWith("/")) {
    issues.push({ code: "bad-source-url", path: "sourceUrl", message: "เก็บพาธของเว็บเดิม (เริ่มด้วย /) ไม่ใช่ URL เต็ม" });
  }

  return issues;
}
