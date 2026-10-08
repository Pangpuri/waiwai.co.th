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
import { frameOf, type PrCardFrame } from "@/lib/hero/pr-card-frame";
import {
  DEFAULT_HERO_SETTING,
  parseHeroSetting,
  sortHeroPageSlides,
  type HeroPageSlide,
  type HeroSetting,
} from "@/lib/hero/model";

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

/* ── ส่วนเขียน (หลังบ้าน) — รอบที่ 184 เฟส 3 ─────────────────────────────────────
   ⚠️ ทุกฟังก์ชันต้องผ่านการตรวจสิทธิ์ที่ action แล้ว (ชั้นนี้ไม่รู้จักผู้ใช้)
   ⚠️ ประตูลบ/ย้าย อยู่ใน SQL เสมอ (`where deleted_at is null`) — ไม่พึ่ง UI
*/

/** เพิ่มสไลด์ใหม่ (ยังไม่เลือกภาพ) — ต่อท้ายลำดับเสมอ · คืน id ที่สร้าง */
export async function createHeroPageSlide(actor: string): Promise<string | null> {
  const id = `hero-${Date.now().toString(36)}`;
  const result = await getPool().query(
    `insert into hero_slide (id, sort_order, media_path, alt_th, alt_en, focus_x, focus_y, zoom, is_active, updated_by)
     values ($1, (select coalesce(max(sort_order), 0) + 10 from hero_slide), '', '', '', 50, 50, 1, true, $2)
     on conflict (id) do nothing`,
    [id, actor],
  );
  return (result.rowCount ?? 0) > 0 ? id : null;
}

/** บันทึกภาพ/คำอธิบาย/จุดโฟกัส/ซูม/เปิด-ปิด ของสไลด์หนึ่งใบ (ไม่แตะลำดับ) */
export async function updateHeroPageSlide(
  id: string,
  input: { readonly mediaPath: string; readonly altTh: string; readonly altEn: string; readonly focusX: number; readonly focusY: number; readonly zoom: number; readonly isActive: boolean },
  actor: string,
): Promise<boolean> {
  const result = await getPool().query(
    `update hero_slide
        set media_path = $2, alt_th = $3, alt_en = $4, focus_x = $5, focus_y = $6, zoom = $7, is_active = $8,
            updated_at = now(), updated_by = $9
      where id = $1 and deleted_at is null`,
    [id, input.mediaPath, input.altTh, input.altEn, input.focusX, input.focusY, input.zoom, input.isActive, actor],
  );
  return (result.rowCount ?? 0) > 0;
}

/** ตั้งลำดับใหม่ทั้งชุด (ผู้เรียกส่งรายการ id ที่เรียงแล้ว) — ใช้ทั้งการลากสลับและปุ่มขึ้น/ลง */
export async function reorderHeroPageSlides(orderedIds: readonly string[], actor: string): Promise<number> {
  let changed = 0;
  for (const [index, id] of orderedIds.entries()) {
    const result = await getPool().query(
      `update hero_slide set sort_order = $2, updated_at = now(), updated_by = $3
        where id = $1 and deleted_at is null and sort_order <> $2`,
      [id, (index + 1) * 10, actor],
    );
    changed += result.rowCount ?? 0;
  }
  return changed;
}

/** ย้ายเข้าถังขยะ (soft delete) — ประตูอยู่ใน SQL */
export async function trashHeroPageSlide(id: string, actor: string): Promise<boolean> {
  const result = await getPool().query(
    `update hero_slide set deleted_at = now(), deleted_by = $2, updated_at = now(), updated_by = $2
      where id = $1 and deleted_at is null`,
    [id, actor],
  );
  return (result.rowCount ?? 0) > 0;
}

/* ── ตั้งค่าเอฟเฟค/ความเร็ว (รอบที่ 185) ──────────────────────────────────────── */

/** อ่านค่าตั้งค่า — **คืนค่าเริ่มต้นเสมอเมื่อมีปัญหา** (ไม่มี DB/ตารางหาย/ค่าเพี้ยน) ⇒ หน้าเว็บไม่พัง */
export async function loadHeroSetting(): Promise<HeroSetting> {
  if (!isDatabaseConfigured()) return DEFAULT_HERO_SETTING;
  try {
    const result = await readQuery<{ effect: string; interval_ms: number; pr_card_frame: string }>(
      "select effect, interval_ms, pr_card_frame from hero_setting where id = 'default'",
    );
    const row = result.rows[0];
    /* กรอบการ์ด PR (รอบที่ 208) — เก็บที่ตารางเดียวกับเอฟเฟคสไลด์ */
    return row === undefined
      ? DEFAULT_HERO_SETTING
      : { ...parseHeroSetting(row), prCardFrame: frameOf(row.pr_card_frame) };
  } catch {
    return DEFAULT_HERO_SETTING;
  }
}

/** บันทึกค่าตั้งค่า (หลังบ้าน) — บีบช่วงค่าที่ชั้นข้อมูลอีกชั้นก่อนเขียน */
/**
 * บันทึก **เฉพาะ "กรอบภาพการ์ด PR"** (รอบที่ 208) — ไม่แตะเอฟเฟค/ความเร็วของสไลด์
 * ประตูอยู่ที่ SQL: `update … where id = 'default'` (แถวเดียวของฮีโร่)
 */
export async function saveHeroCardFrame(frame: PrCardFrame, actor: string): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  try {
    const result = await getPool().query(
      `update hero_setting set pr_card_frame = $1, updated_at = now(), updated_by = $2 where id = 'default'`,
      [frame, actor],
    );
    return (result.rowCount ?? 0) > 0;
  } catch {
    return false;
  }
}

export async function saveHeroSetting(setting: HeroSetting, actor: string): Promise<boolean> {
  const safe = parseHeroSetting(setting);
  const result = await getPool().query(
    `insert into hero_setting (id, effect, interval_ms, updated_at, updated_by)
     values ('default', $1, $2, now(), $3)
     on conflict (id) do update set effect = excluded.effect, interval_ms = excluded.interval_ms,
       updated_at = now(), updated_by = excluded.updated_by`,
    [safe.effect, safe.intervalMs, actor],
  );
  return (result.rowCount ?? 0) > 0;
}

/* ── ถังขยะของสไลด์ (รอบที่ 186) ────────────────────────────────────────────────
   กติกา: **ประตูอยู่ที่ SQL เสมอ** — กู้คืน/ลบถาวรทำได้เฉพาะแถวที่ `deleted_at is not null`
   ⇒ ยิงคำสั่งผิดพลาดใส่ของที่ยังใช้งานอยู่ = ไม่มีผล (fail-closed · พิสูจน์ได้ในเทสต์/check:db)
*/

/*
  ⚠️ บทเรียนรอบที่ 197 (บั๊กจริงจากเจ้าของ: "ทดสอบลบภาพสไลด์" → หน้า `/admin/hero` 500 `iso.slice is not a function`)
  `timestamptz` ของ Postgres กลับมาเป็น **`Date`** ไม่ใช่สตริง (เหมือน `numeric` ที่กลับมาเป็นสตริง)
  เดิมประกาศชนิดเป็น `string` ⇒ ชนิดข้อมูล "โกหก" ⇒ หลุดถึงหน้าจอแล้วพังตอนจัดรูปแบบ
  ⇒ กติกา: **`Date` ต้องถูกแปลงเป็น ISO string ที่ชั้นข้อมูลเสมอ** ด้วย `toIsoStamp()`
*/
type TrashedHeroSlideRow = HeroSlideRow & { readonly deleted_at: Date | string | null };

/** `timestamptz` จาก DB (Date หรือสตริง) → ISO string · ค่าที่อ่านไม่ได้ = `""` (หน้าจอไม่พัง) */
function toIsoStamp(value: Date | string | null): string {
  if (value === null) return "";
  const ms = value instanceof Date ? value.getTime() : Date.parse(String(value));
  return Number.isFinite(ms) ? new Date(ms).toISOString() : "";
}

/** สไลด์ที่อยู่ในถัง (ใหม่สุดก่อน) — สำหรับหน้าจอหลังบ้านเท่านั้น */
export async function listTrashedHeroPageSlides(): Promise<readonly { slide: HeroPageSlide; deletedAt: string }[]> {
  if (!isDatabaseConfigured()) return [];
  const result = await getPool().query<TrashedHeroSlideRow>(
    `select id, sort_order, media_path, alt_th, alt_en, focus_x, focus_y, zoom, is_active, deleted_at
       from hero_slide
      where deleted_at is not null
      order by deleted_at desc, id asc`,
  );
  return result.rows.map((row) => ({
    slide: toSlide(row),
    deletedAt: toIsoStamp(row.deleted_at),
  }));
}

/** กู้คืนจากถังขยะ — ต้องเป็นของในถังเท่านั้น (ประตูใน SQL) */
export async function restoreHeroPageSlide(id: string, actor: string): Promise<boolean> {
  const result = await getPool().query(
    `update hero_slide
        set deleted_at = null, deleted_by = null, updated_at = now(), updated_by = $2
      where id = $1 and deleted_at is not null`,
    [id, actor],
  );
  return (result.rowCount ?? 0) > 0;
}

/** ลบถาวร — ต้องเป็นของในถังเท่านั้น (fail-closed) */
export async function deleteHeroPageSlideForever(id: string): Promise<boolean> {
  const result = await getPool().query(
    `delete from hero_slide where id = $1 and deleted_at is not null`,
    [id],
  );
  return (result.rowCount ?? 0) > 0;
}
