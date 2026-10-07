/**
 * โมดูล "สไลด์ & แคมเปญ" — ชั้นฐานข้อมูล (รอบที่ 184 · เฟส 2)
 *
 * หลักการ
 * - **หน้าเว็บอ่านผ่านประตูอ่านอย่างเดียว** (`readQuery` → role `waiwai_public_ro`) ⇒ ต่อให้หน้าเว็บถูกยิงพัง ก็เขียนฐานข้อมูลไม่ได้
 * - **ไม่มี DB/อ่านไม่สำเร็จ/ตารางว่าง = คืนรายการว่าง** (ไม่โยน error) ⇒ หน้าเว็บถอยไปใช้สไลด์ในเทมเพลต ไม่มีทางพังเพราะฐานข้อมูล
 * - หลังบ้าน/ตัวนำเข้าใช้ `getPool()` (สิทธิ์เต็ม) เหมือนตารางเนื้อหาอื่น
 * - ⚠️ ยังไม่ต่อกับหน้าเว็บในรอบนี้ (เฟสถัดไป) — รอบนี้พิสูจน์สัญญาณของชั้นข้อมูลเท่านั้น
 */

import { getPool, isDatabaseConfigured } from "@/db/pool";
import { readQuery } from "@/lib/db/read";
import { sortHeroPageSlides, type HeroPageSlide } from "@/lib/hero/model";

/** เงื่อนไขกลางของ "สไลด์ที่หน้าเว็บควรเห็น" — ใช้ทุกคำสั่งฝั่งเว็บ (ห้ามพิมพ์ซ้ำ) */
export const PUBLIC_HERO_CONDITION = "deleted_at is null and is_active";

type HeroSlideRow = {
  readonly id: string;
  readonly sort_order: number;
  readonly media_path: string;
  readonly alt_th: string;
  readonly alt_en: string;
  readonly focus_x: number;
  readonly focus_y: number;
  readonly zoom: string | number;
  readonly is_active: boolean;
};

function toSlide(row: HeroSlideRow): HeroPageSlide {
  return {
    id: row.id,
    sortOrder: row.sort_order,
    mediaPath: row.media_path,
    altTh: row.alt_th,
    altEn: row.alt_en,
    focusX: row.focus_x,
    focusY: row.focus_y,
    /* `numeric` ของ Postgres กลับมาเป็นสตริง ⇒ แปลงเป็นตัวเลขก่อนใช้ */
    zoom: typeof row.zoom === "number" ? row.zoom : Number.parseFloat(row.zoom),
    isActive: row.is_active,
  };
}

/**
 * สไลด์ที่หน้าเว็บควรแสดง (เรียงตามลำดับ) — **คืน `[]` เสมอเมื่อมีปัญหา**
 * ไม่มี DB = ไม่ throw · ตารางยังไม่มี (ยังไม่ migrate) = จับ error แล้วคืน `[]`
 */
export async function listHeroPageSlides(): Promise<readonly HeroPageSlide[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const result = await readQuery<HeroSlideRow>(
      `select id, sort_order, media_path, alt_th, alt_en, focus_x, focus_y, zoom, is_active
         from hero_slide
        where ${PUBLIC_HERO_CONDITION}
        order by sort_order asc, id asc`,
    );
    const slides = result.rows.map(toSlide);
    return sortHeroPageSlides(slides.filter((slide) => slide.mediaPath.trim() !== ""));
  } catch {
    /* ฐานข้อมูลล่ม/ตารางหาย = หน้าเว็บต้องไม่พัง (ถอยไปใช้เทมเพลต) */
    return [];
  }
}

/** สำหรับหลังบ้าน — ทุกแถวรวมที่ปิดไว้ (ยังไม่รวมถังขยะ; ถังขยะจะทำพร้อมหน้าจอ) */
export async function listHeroPageSlidesForAdmin(): Promise<readonly HeroPageSlide[]> {
  if (!isDatabaseConfigured()) return [];
  const result = await getPool().query<HeroSlideRow>(
    `select id, sort_order, media_path, alt_th, alt_en, focus_x, focus_y, zoom, is_active
       from hero_slide
      where deleted_at is null
      order by sort_order asc, id asc`,
  );
  return sortHeroPageSlides(result.rows.map(toSlide));
}

/**
 * บันทึกสไลด์หนึ่งใบ (ใช้ทั้งตัวนำเข้าและหน้าจอหลังบ้าน)
 * - `preserveOrder` = true (ตัวนำเข้า) ⇒ **ไม่แตะ `sort_order` เดิม** ถ้ามีแถวอยู่แล้ว (กันลำดับที่คนจัดไว้หาย — บทเรียนรอบ 140)
 * - คืน `created` = เพิ่มใหม่จริง (ใช้รายงานผล)
 */
export async function saveHeroPageSlide(
  slide: HeroPageSlide,
  actor: string,
  options: { readonly preserveOrder?: boolean } = {},
): Promise<{ readonly created: boolean }> {
  const preserve = options.preserveOrder === true;
  const result = await getPool().query(
    `insert into hero_slide (id, sort_order, media_path, alt_th, alt_en, focus_x, focus_y, zoom, is_active, updated_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     on conflict (id) do update set
       sort_order = case when $11 then hero_slide.sort_order else excluded.sort_order end,
       media_path = excluded.media_path,
       alt_th = excluded.alt_th,
       alt_en = excluded.alt_en,
       focus_x = excluded.focus_x,
       focus_y = excluded.focus_y,
       zoom = excluded.zoom,
       is_active = excluded.is_active,
       updated_at = now(),
       updated_by = excluded.updated_by
     returning (xmax = 0) as created`,
    [
      slide.id,
      slide.sortOrder,
      slide.mediaPath,
      slide.altTh,
      slide.altEn,
      slide.focusX,
      slide.focusY,
      slide.zoom,
      slide.isActive,
      actor,
      preserve,
    ],
  );
  return { created: result.rows[0]?.created === true };
}
