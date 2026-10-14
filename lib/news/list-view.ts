/**
 * ตรรกะล้วนของ **มุมมองรายการข่าว** (ปี พ.ศ. + การเรียง + เลขหน้า) — รอบที่ 271 · มติเจ้าของ D29
 *
 * คำเจ้าของ: *"มีหน้าข่าวสารและกิจกรรม ไม่ได้เรียงตามวันที่ล่าสุดลงมาหาเก่าสุดครับตอนนี้
 * อาจจะเพิ่มการปรับล่าสุดเป็นดีฟอลและเพิ่มตัวกรองว่าให้กรองจากอะไรในการโชว์หน้าครับ"*
 *
 * **มติ 3 ข้อ (เจ้าของเลือก "ตัวเลือกที่แนะนำ" ทั้งหมด):**
 * 1. ตัวกรอง = **ปี พ.ศ.** + **สลับการเรียง ล่าสุด/เก่าสุด** (ค่าเริ่มต้น = ล่าสุด)
 * 2. ทำเป็น **หน้า static แยกเส้นทาง** (prerender + ISR · ไม่ใช้ JS · ไม่มี query string)
 * 3. **`sort_order` ไม่มีผลกับหน้าเว็บ** — หน้าเว็บเรียงตามวันที่เสมอ (กันกับดักเดิมกลับมา)
 *
 * ทำไมต้องมีไฟล์นี้: เส้นทางของมุมมองต่าง ๆ ต้องถูกสร้าง/อ่านที่เดียว
 * (เดิมหน้าเว็บอ่าน `order by` ที่ยก `sort_order` มาก่อนวันที่ ⇒ ข่าว 151 แถวที่ตัวนำเข้าตั้ง `sort_order` ไว้
 *  จึงเรียงตามลำดับนำเข้า = **24 ก.พ. 2564 ขึ้นก่อน** แทนที่จะเป็นข่าวล่าสุด)
 *
 * เส้นทาง (พาธกลาง ไม่มี prefix ภาษา — ตัวเรียกใช้ `localePath()`):
 * - ล่าสุด: `/news` · `/news/page/<n>`
 * - เก่าสุด: `/news/oldest` · `/news/oldest/page/<n>`
 * - กรองปี (ล่าสุดในปีนั้น): `/news/year/<พ.ศ.>` · `/news/year/<พ.ศ.>/page/<n>`
 * - กรองปี + เก่าสุด: `/news/year/<พ.ศ.>/oldest` · `/news/year/<พ.ศ.>/oldest/page/<n>`
 */

export const NEWS_SORTS = ["newest", "oldest"] as const;
export type NewsSort = (typeof NEWS_SORTS)[number];

/** ค่าเริ่มต้นของผู้ใช้: ล่าสุดก่อน (มติเจ้าของ) */
export const DEFAULT_NEWS_SORT: NewsSort = "newest";

export function isNewsSort(value: string): value is NewsSort {
  return (NEWS_SORTS as readonly string[]).includes(value);
}

/** ปีพุทธศักราช = ค.ศ. + 543 (ใช้กับปีที่แสดงบนหน้าเว็บเท่านั้น · ไม่แตะข้อมูลในฐานข้อมูล) */
export const BUDDHIST_YEAR_OFFSET = 543;

/** ปี พ.ศ. ของวันที่ (ISO) — คืน null ถ้าอ่านวันที่ไม่ได้ */
export function buddhistYearOf(iso: string | null | undefined): number | null {
  if (iso === null || iso === undefined) return null;
  const match = /^(\d{4})-/.exec(iso.trim());
  if (match === null) return null;
  const year = Number.parseInt(match[1] ?? "", 10);
  return Number.isFinite(year) ? year + BUDDHIST_YEAR_OFFSET : null;
}

/**
 * แปลงค่าจาก URL (พ.ศ. เป็นสตริง) → ปี ค.ศ. ที่ใช้กรอง
 * ⚠️ จำกัดช่วง 2400–2699 (พ.ศ.) ⇒ ค่ามั่ว/ค่าที่ไม่ใช่ปี คืน null (ผู้เรียกตอบ 404 ไม่ใช่ 500)
 */
export function christianYearOfLabel(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d{4}$/.test(trimmed)) return null;
  const buddhist = Number.parseInt(trimmed, 10);
  if (buddhist < 2400 || buddhist > 2699) return null;
  return buddhist - BUDDHIST_YEAR_OFFSET;
}

export type NewsListView = {
  readonly sort: NewsSort;
  /** ปี **ค.ศ.** ที่กรอง (null = ทุกปี) */
  readonly year: number | null;
  /** เลขหน้า เริ่มที่ 1 */
  readonly page: number;
};

/** พาธกลางของมุมมองหนึ่ง ๆ (ไม่มี prefix ภาษา · หน้า 1 ไม่ใส่ `/page/1`) */
export function newsListPath(view: NewsListView): string {
  const segments = ["/news"];
  if (view.year !== null) segments.push("year", String(view.year + BUDDHIST_YEAR_OFFSET));
  if (view.sort === "oldest") segments.push("oldest");
  if (view.page > 1) segments.push("page", String(view.page));
  return segments.join("/");
}

/** จำนวนหน้าทั้งหมด (อย่างน้อย 1 หน้า เพื่อให้หน้าว่างยังแสดงผลได้) */
export function newsPageCount(total: number, perPage: number): number {
  if (perPage <= 0) return 1;
  return Math.max(1, Math.ceil(Math.max(0, total) / perPage));
}

/** เลขหน้าที่ใช้จริง: 1..pageCount (ค่าที่หลุดช่วงถูกดึงกลับ — ผู้เรียกตัดสินใจต่อว่าจะ 404 หรือไม่) */
export function clampNewsPage(page: number, pageCount: number): number {
  if (!Number.isFinite(page)) return 1;
  return Math.min(Math.max(1, Math.trunc(page)), Math.max(1, pageCount));
}

/** อ่านเลขหน้าจาก segment ของ URL — คืน null เมื่อไม่ใช่จำนวนเต็มบวก */
export function parseNewsPageNumber(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const page = Number.parseInt(value.trim(), 10);
  return page >= 1 && page <= 9999 ? page : null;
}

/**
 * ตัวเลือกของ "แถวกรอง" — ปีที่มีข่าวจริง (พ.ศ. มาก→น้อย) + จำนวนข่าวต่อปี
 * (แถวกรองแสดงเป็นลิงก์ ⇒ ใช้ได้แม้ปิด JS และไม่ต้องมี query string)
 */
export type NewsYearOption = {
  readonly year: number;
  /** ปี ค.ศ. (ใช้สร้างเส้นทาง/กรอง) */
  readonly christianYear: number;
  readonly count: number;
};

export function newsYearOptions(
  rows: readonly { readonly year: number; readonly count: number }[],
): readonly NewsYearOption[] {
  return [...rows]
    .filter((row) => Number.isFinite(row.year) && row.count > 0)
    .sort((a, b) => b.year - a.year)
    .map((row) => ({ year: row.year, christianYear: row.year - BUDDHIST_YEAR_OFFSET, count: row.count }));
}

/** มุมมองเริ่มต้น: ล่าสุดก่อน · ทุกปี · หน้า 1 (มติเจ้าของ: "ปรับล่าสุดเป็นดีฟอล") */
export function defaultNewsListView(): NewsListView {
  return { sort: DEFAULT_NEWS_SORT, year: null, page: 1 };
}
