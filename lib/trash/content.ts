import { getPool } from "@/db/pool";
import { recordAudit } from "@/lib/audit/log";
import { isDatabaseConfigured } from "@/lib/content/repository";
import { trashCutoffIsoFor } from "@/lib/retention/plan";
import {
  CONTENT_TRASH_KINDS,
  TRASH_AUDIT_ACTIONS,
  TRASH_AUDIT_TARGET,
  contentTrashTotal,
  emptyContentTrashCounts,
  summarizeContentTrash,
  type ContentTrashKind,
} from "@/lib/trash/plan";

/**
 * ลบถาวร "เนื้อหาในถังขยะ" ที่พ้นระยะเก็บ (รอบที่ 170) — **ชั้นที่แตะฐานข้อมูล**
 *
 * ที่มา: สินค้า/เมนูอาหาร/ข่าว ถูกย้ายเข้าถังขยะได้ตั้งแต่รอบที่ 123/135/139 แต่ **ไม่มีตัวลบอัตโนมัติ**
 * ⇒ ของที่ผู้ดูแลลบแล้วค้างในตารางตลอดไป (กู้คืนได้ก็จริง แต่ไม่มีใครเก็บกวาด)
 * รอบนี้ทำให้ใช้กติกาเดียวกับถังขยะภาพ/พรีเซ็ต: `deleted_at` เก่ากว่า `TRASH_RETENTION_DAYS` (30) = ลบถาวร
 *
 * กติกาที่ตั้งใจ (เหมือน `lib/trash/repository.ts`)
 * - **ประตูอยู่ที่ SQL**: ทุกคำสั่งมี `deleted_at is not null` ⇒ ของที่ยังใช้งานอยู่ถูกลบไม่ได้เด็ดขาด
 * - `dryRun` ใช้คำสั่งรูปแบบเดียวกัน (count แทน delete) ⇒ ตัวเลขบนจอตรงกับสิ่งที่จะถูกลบจริง
 * - **ไม่มี DB = คืน `null` ไม่โยน error** (การลบต้องไม่ทำให้ระบบหลักพัง)
 * - ชื่อตารางมาจากค่าคงที่ในโค้ด (ไม่รับจากผู้ใช้) ⇒ ไม่มีทางกลายเป็น SQL injection
 * - ลบสินค้าแล้ว **ส่วนผสมถูกลบตาม** (`product_ingredient ... on delete cascade`)
 * - บันทึก audit (`trash-purge` · target `trash-content`) เมื่อลบจริงและมีของถูกลบ
 */

/** ชื่อตารางของแต่ละชนิด — คีย์คือ `ContentTrashKind` ที่ตรวจแล้วเท่านั้น */
const CONTENT_TABLES: Readonly<Record<ContentTrashKind, "product" | "recipe" | "news">> = {
  product: "product",
  recipe: "recipe",
  news: "news",
};

export type ContentTrashPurgeReport = {
  readonly at: string;
  readonly dryRun: boolean;
  readonly counts: Readonly<Record<ContentTrashKind, number>>;
  readonly total: number;
};

export type ContentTrashStats = Readonly<Record<ContentTrashKind, number>> & { readonly total: number };

function statsOf(counts: Readonly<Record<ContentTrashKind, number>>): ContentTrashStats {
  return { ...counts, total: contentTrashTotal(counts) };
}

/**
 * นับ **ของในถังเนื้อหาที่ยังกู้คืนได้** แยกชนิด (รอบที่ 175) — สำหรับการ์ด `/admin` + หน้าถังขยะ
 *
 * ต่างจาก `purgeExpiredContentTrash` ตรงที่ **ไม่สนวันหมดอายุ** — นับทุกแถวที่ `deleted_at is not null`
 * (คือ "ของที่ยังกู้คืนได้ตอนนี้") ⇒ การ์ดจึงบอกได้ครบว่าถังมีอะไรบ้าง ไม่ใช่แค่ที่ใกล้ถูกลบ
 *
 * ⚠️ **ไม่มี DB = คืน 0 ทุกชนิด** (ไม่โยน error) — หลักเดียวกับ `trashStats()` ของภาพ/พรีเซ็ต
 *    เพราะหน้าภาพรวมหลังบ้านต้องไม่พังเพราะเรื่องฐานข้อมูล (มีป้ายเตือนแยกอยู่แล้ว)
 */
export async function contentTrashStats(): Promise<ContentTrashStats> {
  if (!isDatabaseConfigured()) return statsOf(emptyContentTrashCounts());

  const pool = getPool();
  const counts = emptyContentTrashCounts();

  for (const kind of CONTENT_TRASH_KINDS) {
    const { rows } = await pool.query<{ n: number }>(
      `select count(*)::int as n from ${CONTENT_TABLES[kind]} where deleted_at is not null`,
    );
    counts[kind] = rows[0]?.n ?? 0;
  }

  return statsOf(counts);
}

/**
 * ลบถาวรของในถังขยะเนื้อหาที่พ้นระยะเก็บ — `dryRun` = นับเฉย ๆ
 * คืน `null` = ยังไม่ได้ตั้งฐานข้อมูล
 */
export async function purgeExpiredContentTrash(
  options: { readonly now?: Date; readonly dryRun?: boolean } = {},
): Promise<ContentTrashPurgeReport | null> {
  if (!isDatabaseConfigured()) return null;

  const now = options.now ?? new Date();
  const dryRun = options.dryRun === true;
  const cutoffIso = trashCutoffIsoFor(now);
  const counts = emptyContentTrashCounts();
  const pool = getPool();

  for (const kind of CONTENT_TRASH_KINDS) {
    const table = CONTENT_TABLES[kind];
    if (dryRun) {
      const { rows } = await pool.query<{ n: number }>(
        `select count(*)::int as n from ${table} where deleted_at is not null and deleted_at < $1`,
        [cutoffIso],
      );
      counts[kind] = rows[0]?.n ?? 0;
    } else {
      const result = await pool.query(`delete from ${table} where deleted_at is not null and deleted_at < $1`, [cutoffIso]);
      counts[kind] = result.rowCount ?? 0;
    }
  }

  const total = contentTrashTotal(counts);
  if (!dryRun && total > 0) {
    await recordAudit({
      action: TRASH_AUDIT_ACTIONS.purge,
      actorEmail: null,
      target: `${TRASH_AUDIT_TARGET}-content`,
      detail: summarizeContentTrash(counts),
    });
  }

  return { at: now.toISOString(), dryRun, counts, total };
}
