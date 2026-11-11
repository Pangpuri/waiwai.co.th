/**
 * ตรรกะ "กันนับวิวซ้ำ 24 ชั่วโมงต่อเครื่อง" — pure module (ทดสอบได้โดยไม่ต้องมี DB/Next)
 *
 * ใช้คุกกี้เดียวเก็บรายการ `newsId:timestamp` ของข่าวที่เพิ่งเปิด (ไม่เก็บ IP/ข้อมูลส่วนบุคคล)
 * - เก็บไม่เกิน 30 รายการล่าสุด ⇒ คุกกี้เล็ก
 * - รายการที่เก่ากว่า 24 ชม. ถูกตัดทิ้งตอนอ่าน
 */
export const NEWS_VIEW_COOKIE = "waiwai_news_view";
export const NEWS_VIEW_DEDUPE_MS = 24 * 60 * 60 * 1000;
export const MAX_NEWS_VIEW_MARKS = 30;

export type NewsViewMark = {
  readonly id: string;
  readonly at: number;
};

/** อ่านค่าคุกกี้ → รายการที่ยังไม่หมดอายุ (ค่าขยะถูกข้าม ไม่ทำให้ request ล้ม) */
export function parseNewsViewMarks(value: string | undefined, now: number): readonly NewsViewMark[] {
  if (typeof value !== "string" || value.trim() === "") return [];
  const marks: NewsViewMark[] = [];
  for (const entry of value.split(",")) {
    const [id = "", stamp = ""] = entry.split(":");
    const at = Number.parseInt(stamp, 10);
    if (!/^\d{3,}$/.test(id)) continue;
    if (!Number.isFinite(at) || at <= 0) continue;
    if (now - at >= NEWS_VIEW_DEDUPE_MS) continue;
    marks.push({ id, at });
  }
  return marks.slice(-MAX_NEWS_VIEW_MARKS);
}

/** ควรนับวิวครั้งนี้ไหม — มีรอยเดิมภายใน 24 ชม. = ไม่นับ */
export function shouldCountNewsView(marks: readonly NewsViewMark[], id: string, now: number): boolean {
  return !marks.some((mark) => mark.id === id && now - mark.at < NEWS_VIEW_DEDUPE_MS);
}

/** เพิ่มรอยการเปิดข่าว (ตัดของเก่า/ของซ้ำ แล้วเก็บไม่เกินเพดาน) */
export function withNewsViewMark(marks: readonly NewsViewMark[], id: string, now: number): string {
  const kept = marks.filter((mark) => mark.id !== id && now - mark.at < NEWS_VIEW_DEDUPE_MS);
  kept.push({ id, at: now });
  return kept
    .slice(-MAX_NEWS_VIEW_MARKS)
    .map((mark) => `${mark.id}:${String(mark.at)}`)
    .join(",");
}
