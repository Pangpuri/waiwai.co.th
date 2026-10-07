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
 * - ลบสไลด์แล้ว ลิงก์แคมเปญของสไลด์นั้นหายตาม (`campaign_slide … on delete cascade`)
 * - ไม่มี DB/ตารางหาย = คืน 0 (ไม่ทำให้ตัวลบกลางล้ม)
 */

import { getPool, isDatabaseConfigured } from "@/db/pool";
import { TRASH_RETENTION_DAYS } from "@/lib/retention/plan";

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
