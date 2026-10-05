/**
 * วันที่ไทยจากเว็บเดิม → ค่ารูปแบบมาตรฐาน (S3 ส่วนที่ 4 / S5 · รอบที่ 104–105) — **ตรรกะล้วน**
 *
 * ใช้ร่วมกันโดยตัวนำเข้าเมนูอาหาร (รอบที่ 104) และตัวนำเข้าข่าว (รอบที่ 105)
 * - รับปี พ.ศ. ได้ด้วย (มากกว่า 2400 ⇒ ลบ 543) เพื่อกันข้อมูลที่พิมพ์ปีไทย
 * - อ่านไม่ได้/ไม่สมเหตุสมผล = null (**ไม่เดา**)
 * - ตรรกะเส้นตายเวลา: เว็บเดิมแสดง "เวลาไทย" (Asia/Bangkok · UTC+7 · ไม่มี DST)
 *   ⇒ ผู้เรียกใช้ `bangkokInstantOf()` ต่อเมื่อต้องเก็บเป็น `timestamptz`
 */

const THAI_MONTHS: Readonly<Record<string, number>> = {
  มกราคม: 1,
  กุมภาพันธ์: 2,
  มีนาคม: 3,
  เมษายน: 4,
  พฤษภาคม: 5,
  มิถุนายน: 6,
  กรกฎาคม: 7,
  สิงหาคม: 8,
  กันยายน: 9,
  ตุลาคม: 10,
  พฤศจิกายน: 11,
  ธันวาคม: 12,
  "ม.ค.": 1,
  "ก.พ.": 2,
  "มี.ค.": 3,
  "เม.ย.": 4,
  "พ.ค.": 5,
  "มิ.ย.": 6,
  "ก.ค.": 7,
  "ส.ค.": 8,
  "ก.ย.": 9,
  "ต.ค.": 10,
  "พ.ย.": 11,
  "ธ.ค.": 12,
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** `9 ตุลาคม 2018` → `2018-10-09` (คืน null ถ้าอ่านไม่ได้) */
export function parseThaiDate(label: string): string | null {
  const match = label.match(/(\d{1,2})\s+([ก-๙.]+)\s+(\d{4})/);
  if (match === null) return null;

  const day = Number.parseInt(match[1] ?? "", 10);
  const month = THAI_MONTHS[(match[2] ?? "").trim()];
  let year = Number.parseInt(match[3] ?? "", 10);
  if (year > 2400) year -= 543;

  if (!Number.isFinite(day) || day < 1 || day > 31) return null;
  if (month === undefined) return null;
  if (year < 1900 || year > 2100) return null;

  return `${year}-${pad(month)}-${pad(day)}`;
}

/** `12 กันยายน 2026 11:28` → `2026-09-12T11:28` (เวลาไทย · ไม่มีเขตเวลา) */
export function parseThaiDateTime(label: string): string | null {
  const date = parseThaiDate(label);
  if (date === null) return null;

  const time = label.match(/(\d{1,2}):(\d{2})/);
  const hour = time === null ? 0 : Number.parseInt(time[1] ?? "", 10);
  const minute = time === null ? 0 : Number.parseInt(time[2] ?? "", 10);
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return null;
  if (!Number.isFinite(minute) || minute < 0 || minute > 59) return null;

  return `${date}T${pad(hour)}:${pad(minute)}`;
}

/** `2026-09-12T11:28` (เวลาไทย) → ค่าที่ใส่ `timestamptz` ได้ (`…+07:00`) */
export function bangkokInstantOf(localDateTime: string): string {
  return `${localDateTime}:00+07:00`;
}
