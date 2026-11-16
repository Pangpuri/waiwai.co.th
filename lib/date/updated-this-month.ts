/** True when a valid timestamp falls in the current calendar month in Bangkok. */
export function isUpdatedThisBangkokMonth(updatedAt: string | null, now: Date): boolean {
  if (updatedAt === null || updatedAt.trim() === "" || Number.isNaN(now.getTime())) return false;
  const updated = new Date(updatedAt);
  if (Number.isNaN(updated.getTime())) return false;

  const yearMonthInBangkok = (date: Date): string => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
    }).formatToParts(date);
    const year = parts.find((part) => part.type === "year")?.value ?? "";
    const month = parts.find((part) => part.type === "month")?.value ?? "";
    return `${year}-${month}`;
  };

  return yearMonthInBangkok(updated) === yearMonthInBangkok(now);
}
