import type { Locale } from "./i18n/config";

const INTL_LOCALE: Record<Locale, string> = {
  th: "th-TH",
  en: "en-GB",
};

/**
 * แปลงวันที่ ISO เป็นข้อความตามภาษา
 * คืนสตริงว่างถ้าวันที่ใช้ไม่ได้ — ดีกว่าปล่อยให้หน้าจอขึ้น "Invalid Date"
 */
export function formatDate(iso: string, locale: Locale): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(date);
}

/** แปลงตัวเลขเป็นรูปแบบของภาษา เช่น 1,250 → "1,250" / "๑,๒๕๐" */
export function formatNumber(value: number, locale: Locale): string {
  if (!Number.isFinite(value)) return "";
  return new Intl.NumberFormat(INTL_LOCALE[locale]).format(value);
}

/**
 * ปีที่แสดงบนหน้าจอได้ — รับเฉพาะปี 4 หลัก
 * กันค่าเพี้ยนจากแหล่งข้อมูลภายนอก (เช่น CMS) ไม่ให้หลุดไปเป็น "NaN" หรือปีติดลบบนหน้าจอ
 */
export function isDisplayableYear(value: number): boolean {
  return Number.isInteger(value) && value >= 1000 && value <= 9999;
}

/**
 * แปลงปี (ค.ศ. ในข้อมูลต้นทาง) เป็นข้อความตามภาษา
 * - ไทย: ICU แปลงเป็นพุทธศักราชให้เอง → 1972 = "2515"
 * - อังกฤษ: ค.ศ. → "1972"
 * คืนสตริงว่างถ้าปีนั้นแสดงไม่ได้ (ผู้เรียกต้องข้ามรายการนั้น ไม่ใช่ปล่อยให้หน้าพัง)
 */
export function formatYear(year: number, locale: Locale): string {
  if (!isDisplayableYear(year)) return "";

  // ปี >= 1000 จึงเติมศูนย์ได้ตรงเสมอ และใช้ UTC เพื่อไม่ให้ปีเลื่อนตาม timezone ของเครื่องที่รัน
  const date = new Date(`${year}-01-01T00:00:00Z`);
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
