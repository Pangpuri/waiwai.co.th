/**
 * ตัวลบอัตโนมัติของ "ถังขยะสไลด์หน้าแรก" (รอบที่ 191 · ปิดหนี้ที่จดไว้)
 *
 * ⚠️ ก่อนหน้านี้สไลด์ที่ลบจะค้างในถังตลอดไป (ต้องกด "ลบถาวร" เอง) — ต่างจากถังขยะภาพ/เนื้อหา
 * รอบนี้ต่อเข้าตัวลบกลาง ⇒ สไลด์ในถังเกิน **`TRASH_RETENTION_DAYS`** (แหล่งความจริงเดียวที่ `lib/retention/plan.ts`)
 * จะถูกลบถาวรอัตโนมัติเมื่อรัน `db:purge` / ตอนล็อกอินหลังบ้าน / cron
 *
 * กติกา
 * - **ประตูอยู่ใน SQL**: ลบเฉพาะแถวที่ `deleted_at is not null` และเก่ากว่ากำหนด ⇒ ของที่ยังใช้งานอยู่ไม่โดน
 * - `dryRun: true` = **นับอย่างเดียว** (ไม่ลบ) และใช้เส้นทางเดียวกัน ⇒ จำนวนที่รายงานตรงกับของจริง
 * - (รอบที่ 205) ตาราง `campaign_slide` ถูกถอดออกแล้ว — ไม่มีลิงก์ค้างให้ต้องกังวล
 * - ไม่มี DB/ตารางหาย = คืน 0 (ไม่ทำให้ตัวลบกลางล้ม)
 */

import { getPool, isDatabaseConfigured } from "@/db/pool";
import { recordAudit } from "@/lib/audit/log";
import { deleteHeroPageSlideForever, restoreHeroPageSlide } from "@/lib/hero/repository";
import { TRASH_RETENTION_DAYS } from "@/lib/retention/plan";
import {
  TRASH_AUDIT_ACTIONS,
  emptyHeroTrashCounts,
  heroTrashTotal,
  summarizeHeroTrash,
  type HeroTrashKind,
} from "@/lib/trash/plan";

/** ระยะเก็บของถังขยะสไลด์ — อ่านจากค่ากลาง (ห้ามพิมพ์ตัวเลขซ้ำที่อื่น) */
export const HERO_TRASH_RETENTION_DAYS = TRASH_RETENTION_DAYS;

/** วันตัด (อะไรที่ `deleted_at <= cutoff` = หมดอายุแล้ว) */
export function heroTrashCutoff(now: Date): string {
  return new Date(now.getTime() - HERO_TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * ลบสไลด์ที่อยู่ในถังเกินกำหนด
 * @returns จำนวนแถวที่ลบ (หรือจำนวนที่จะลบเมื่อ `dryRun`)
 */
export async function purgeExpiredHeroTrash(options: { readonly now: Date; readonly dryRun?: boolean }): Promise<number> {
  if (!isDatabaseConfigured()) return 0;
  const cutoff = heroTrashCutoff(options.now);
  const pool = getPool();
  try {
    if (options.dryRun === true) {
      const result = await pool.query<{ total: string }>(
        "select count(*)::text as total from hero_slide where deleted_at is not null and deleted_at <= $1",
        [cutoff],
      );
      return Number(result.rows[0]?.total ?? "0");
    }
    const result = await pool.query(
      "delete from hero_slide where deleted_at is not null and deleted_at <= $1",
      [cutoff],
    );
    return result.rowCount ?? 0;
  } catch {
    /* ตัวลบกลางต้องไม่ล้มเพราะถังขยะสไลด์ — รายงานเป็น 0 แล้วให้ตัวอื่นทำงานต่อ */
    return 0;
  }
}

/* ── ตารางรวมถังขยะ: ตัวนับ/รายการ/กู้คืน/ลบถาวร/ลบทั้งถัง (รอบที่ 237) ─────────────
 *
 * เจตนา (มติเจ้าของรอบที่ 176 "เห็นและจัดการจากที่เดียว"): ให้ `/admin/trash` และการ์ดบน `/admin`
 * เห็นสไลด์ในถังเหมือนของชนิดอื่น — ไม่ต้องเดาว่ามีของค้างอยู่ไหม
 *
 * กติกาเหมือน `lib/trash/content.ts` ทุกข้อ
 * - **ประตูอยู่ที่ SQL**: ทุกคำสั่งมี `deleted_at is not null` ⇒ ของที่ยังใช้งานอยู่ถูกลบ/กู้คืนไม่ได้
 * - **ไม่มี DB = คืน 0/[] ไม่โยน error** (หน้าภาพรวมหลังบ้านต้องไม่พังเพราะฐานข้อมูล)
 * - บันทึก audit ทุกครั้งที่ของออกจากถัง (`trash-restore` / `trash-delete`)
 * - ⚠️ `pg` คืน `timestamptz` เป็น `Date` ⇒ แปลงเป็น ISO ที่ชั้นข้อมูลเสมอ (บทเรียนรอบ 197)
 */

export type HeroTrashStats = Readonly<Record<HeroTrashKind, number>> & { readonly total: number };

/** แปลงวันที่จาก DB เป็น ISO — ค่าที่อ่านไม่ได้ = "" (หน้าจอไม่พัง) */
function toIsoStamp(value: Date | string | null): string {
  if (value === null) return "";
  const ms = value instanceof Date ? value.getTime() : Date.parse(String(value));
  return Number.isFinite(ms) ? new Date(ms).toISOString() : "";
}

/** นับสไลด์ในถังที่ **ยังกู้คืนได้** (ไม่สนวันหมดอายุ) — ตัวนับบนการ์ด `/admin` + หน้าถังขยะ */
export async function heroTrashStats(): Promise<HeroTrashStats> {
  if (!isDatabaseConfigured()) return { ...emptyHeroTrashCounts(), total: 0 };

  try {
    const { rows } = await getPool().query<{ n: number }>(
      "select count(*)::int as n from hero_slide where deleted_at is not null",
    );
    const counts = emptyHeroTrashCounts();
    counts.slide = rows[0]?.n ?? 0;
    return { ...counts, total: heroTrashTotal(counts) };
  } catch {
    /* ตารางหาย/อ่านไม่สำเร็จ = 0 (การ์ดต้องไม่พัง) */
    return { ...emptyHeroTrashCounts(), total: 0 };
  }
}

/** แถวของสไลด์ในถัง — รูปเดียวกับ `TrashEntry` ของภาพ/พรีเซ็ต/เนื้อหา (ตารางเดียวเรนเดอร์ได้) */
export type HeroTrashEntry = {
  readonly kind: HeroTrashKind;
  readonly id: string;
  /** ป้ายชื่อ: คำบรรยายภาพ (ไทย → อังกฤษ) ถ้ามี ไม่งั้นใช้รหัสสไลด์ */
  readonly label: string;
  /** พาธภาพ (ช่วยให้รู้ว่าใบไหน) — สไลด์ไม่มีขนาดไฟล์ในตาราง */
  readonly detail: string | null;
  readonly sizeBytes: null;
  readonly deletedAt: string;
  readonly deletedBy: string | null;
};

/** รายการสไลด์ในถัง (ใหม่สุดก่อน) */
export async function listHeroTrash(limit = 200): Promise<readonly HeroTrashEntry[]> {
  if (!isDatabaseConfigured()) return [];

  const capped = Math.max(1, Math.min(limit, 500));
  try {
    const { rows } = await getPool().query<{
      id: string;
      label: string;
      media_path: string;
      deleted_at: Date;
      deleted_by: string | null;
    }>(
      `select id,
              coalesce(nullif(alt_th, ''), nullif(alt_en, ''), id) as label,
              media_path,
              deleted_at,
              deleted_by
         from hero_slide
        where deleted_at is not null
        order by deleted_at desc, id asc
        limit $1`,
      [capped],
    );

    return rows.map((row) => ({
      kind: "slide" as const,
      id: row.id,
      label: row.label,
      detail: row.media_path.trim() === "" ? null : row.media_path,
      sizeBytes: null,
      deletedAt: toIsoStamp(row.deleted_at),
      deletedBy: row.deleted_by,
    }));
  } catch {
    return [];
  }
}

/**
 * กู้คืนสไลด์จากถัง — **ทำได้เฉพาะของที่อยู่ในถังแล้ว** (ประตูอยู่ใน `restoreHeroPageSlide`)
 * คืน `false` = ไม่มีแถวที่เข้าเงื่อนไข (ไม่มีจริง/ยังใช้งานอยู่/ถูกลบถาวรไปแล้ว)
 */
export async function restoreHeroTrashItem(id: string, actorEmail: string | null): Promise<boolean> {
  if (!isDatabaseConfigured() || id === "") return false;

  /* ⚠️ `hero_slide.updated_by` เป็น `text not null default ''` ⇒ ส่ง null ตรง ๆ ไม่ได้ (NOT NULL violation)
     ⇒ ใช้สตริงว่างแทน "ไม่ทราบผู้ทำ" (ฝั่ง action ส่งอีเมลของผู้ดูแลเสมอ) */
  const restored = await restoreHeroPageSlide(id, actorEmail ?? "");
  if (!restored) return false;

  await recordAudit({
    action: TRASH_AUDIT_ACTIONS.restore,
    actorEmail,
    target: `slide:${id}`,
    detail: "restored",
  });
  return true;
}

/**
 * ลบสไลด์ **ถาวรจากถังขยะ** — ประตูเดียวกับหน้าสไลด์ (`and deleted_at is not null`)
 * ⚠️ ลบแล้วภาพที่อ้างอยู่ไม่ถูกลบตาม (ภาพอยู่ในคลัง `media` ของตัวเอง) — ตั้งใจ
 */
export async function deleteHeroTrashItemPermanently(id: string, actorEmail: string | null): Promise<boolean> {
  if (!isDatabaseConfigured() || id === "") return false;

  const deleted = await deleteHeroPageSlideForever(id);
  if (!deleted) return false;

  await recordAudit({
    action: TRASH_AUDIT_ACTIONS.permanent,
    actorEmail,
    target: `slide:${id}`,
    detail: "permanent",
  });
  return true;
}

/**
 * ลบถาวร **ทุกสไลด์ในถัง** (ปุ่ม "ลบถาวรทั้งหมด" ที่หน้าถังขยะ) — คืนจำนวนที่ลบ
 * ⚠️ ยังไม่พ้นระยะก็ลบได้ (ผู้ดูแลสั่งเอง · มีด่านติ๊กยืนยันอยู่ที่ action)
 */
export async function emptyHeroTrash(actorEmail: string | null): Promise<number> {
  if (!isDatabaseConfigured()) return 0;

  const result = await getPool().query("delete from hero_slide where deleted_at is not null");
  const removed = result.rowCount ?? 0;
  if (removed > 0) {
    const counts = emptyHeroTrashCounts();
    counts.slide = removed;
    await recordAudit({
      action: TRASH_AUDIT_ACTIONS.permanent,
      actorEmail,
      target: "trash-hero",
      detail: summarizeHeroTrash(counts),
    });
  }
  return removed;
}
