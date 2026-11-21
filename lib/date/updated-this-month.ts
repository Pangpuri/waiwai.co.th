/** ปี-เดือนตามปฏิทินไทยของ instant หนึ่ง (`YYYY-MM`) */
function bangkokYearMonth(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  return `${year}-${month}`;
}

/** True when a valid timestamp falls in the current calendar month in Bangkok. */
export function isUpdatedThisBangkokMonth(updatedAt: string | null, now: Date): boolean {
  if (updatedAt === null || updatedAt.trim() === "" || Number.isNaN(now.getTime())) return false;
  const updated = new Date(updatedAt);
  if (Number.isNaN(updated.getTime())) return false;
  return bangkokYearMonth(updated) === bangkokYearMonth(now);
}

/**
 * True when a `YYYY-MM-DD` calendar date falls in the current Bangkok month.
 * ใช้กับวันที่แบบ "วันอย่างเดียว" เช่น `recipe.published_on`
 */
export function isDateInCurrentBangkokMonth(date: string | null, now: Date): boolean {
  if (date === null || Number.isNaN(now.getTime())) return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (match === null) return false;
  const year = match[1] ?? "";
  const month = match[2] ?? "";
  const monthNumber = Number.parseInt(month, 10);
  if (year === "" || !Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) return false;
  return `${year}-${month}` === bangkokYearMonth(now);
}
