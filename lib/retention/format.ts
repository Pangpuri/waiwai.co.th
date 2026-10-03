/**
 * แปลง "จำนวนวันเก็บ" เป็นข้อความที่คนอ่านรู้เรื่อง (X2b)
 *
 * ใช้ที่หน้า `/privacy` และบนการ์ดหลังบ้าน — **ตัวเลขมาจาก `RETENTION_DAYS` ที่เดียว**
 * ไฟล์นี้แปลงแค่ "รูปคำ" เท่านั้น จึงไม่มีทางที่เอกสารสาธารณะกับตัวลบจะไม่ตรงกัน
 *
 * แนวเดียวกับ `lib/format/bytes.ts` ที่เป็นที่เดียวของหน่วย (KB/MB)
 */

export type RetentionUnit = "day" | "month" | "year";

export type RetentionPhrase = {
  readonly count: number;
  readonly unit: RetentionUnit;
};

/**
 * เลือกหน่วยที่อ่านง่ายโดยไม่ "ปัดให้ดูสั้นกว่าเดิม"
 * - หาร 365 ลงตัว → ปี · หาร 30 ลงตัว **และอย่างน้อย 60 วัน** → เดือน · นอกนั้น → วัน
 *   (30 วันคงไว้เป็น "30 วัน" ไม่เรียกว่า "1 เดือน" เพราะเดือนจริงไม่เท่ากับ 30 วันเสมอ)
 */
export function retentionPhrase(days: number): RetentionPhrase {
  if (!Number.isInteger(days) || days < 1) {
    throw new Error(`retention phrase needs a positive integer (got ${String(days)})`);
  }
  if (days % 365 === 0) return { count: days / 365, unit: "year" };
  if (days >= 60 && days % 30 === 0) return { count: days / 30, unit: "month" };
  return { count: days, unit: "day" };
}

const UNITS: Readonly<Record<"th" | "en", Readonly<Record<RetentionUnit, string>>>> = {
  th: { day: "วัน", month: "เดือน", year: "ปี" },
  en: { day: "day", month: "month", year: "year" },
};

/** "365 → 1 ปี" · "180 → 6 เดือน" · "30 → 30 วัน" (ภาษาอังกฤษเติม s เมื่อมากกว่า 1) */
export function describeRetention(days: number, locale: "th" | "en"): string {
  const { count, unit } = retentionPhrase(days);
  const word = UNITS[locale][unit];
  const plural = locale === "en" && count > 1 ? "s" : "";
  return `${count} ${word}${plural}`;
}
