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

/* ── ตารางรวมที่ /admin/trash (รอบที่ 176) ────────────────────────────────────
 *
 * มติเจ้าของ 2026-10-07: "เห็นและจัดการจากที่เดียว" ⇒ หน้าถังขยะแสดงเนื้อหารวมกับภาพ/พรีเซ็ต
 * กติกาที่คงเดิม (ห้ามผ่อน)
 * - **ประตูอยู่ที่ SQL**: กู้คืน/ลบถาวรของเนื้อหาทุกคำสั่งมี `deleted_at is not null`
 *   ⇒ ของที่ยังใช้งานอยู่ถูกแตะไม่ได้ แม้ยิงฟอร์มปลอมเข้ามา
 * - ชื่อตารางมาจาก `CONTENT_TABLES` (ค่าคงที่) ⇒ ค่าจากฟอร์มไม่กลายเป็น SQL
 * - ไม่มี DB = คืนค่าว่าง/0/`false` ไม่โยน error
 * - ทุกการกระทำที่สำเร็จมีร่องรอยใน audit log (target `<kind>:<id>`)
 */

/** ชื่อที่คนอ่านรู้เรื่องของแต่ละตาราง — ค่าว่างทั้งคู่ถอยไปใช้ id (ไม่โชว์ช่องว่างให้สับสน) */
const CONTENT_LABEL_SQL: Readonly<Record<ContentTrashKind, string>> = {
  product: "coalesce(nullif(name_th, ''), nullif(name_en, ''), id)",
  recipe: "coalesce(nullif(title_th, ''), nullif(title_en, ''), id)",
  news: "coalesce(nullif(title_th, ''), nullif(title_en, ''), id)",
};

/** แถวของในถังของชนิดเนื้อหา — รูปเดียวกับ `TrashEntry` ของภาพ/พรีเซ็ต (ให้ตารางเดียวเรนเดอร์ได้) */
export type ContentTrashEntry = {
  readonly kind: ContentTrashKind;
  readonly id: string;
  readonly label: string;
  /** รหัสของรายการ (ช่วยหาต่อในจอของชนิดนั้น) — เนื้อหาไม่มีขนาดไฟล์ */
  readonly detail: string | null;
  readonly sizeBytes: null;
  readonly deletedAt: string;
  /**
   * ⚠️ ตารางเนื้อหา **ไม่มีคอลัมน์ `deleted_by`** (ต่างจาก media/block_preset/chrome_preset)
   * ⇒ ใช้ `updated_by` ซึ่งถูกเขียนตอนย้ายเข้าถัง · ถ้ามีคนแก้ของที่อยู่ในถังภายหลัง ค่านี้อาจเป็นคนนั้น
   *    (ข้อจำกัดของสคีมาเดิม — บันทึกใน § 10 รอบที่ 176)
   */
  readonly deletedBy: string | null;
};

/** รายการของในถังของเนื้อหา (ใหม่สุดก่อน) — แยกคิวรีต่อชนิดเพื่อใช้ดัชนีของแต่ละตาราง */
export async function listContentTrash(limit = 200): Promise<readonly ContentTrashEntry[]> {
  if (!isDatabaseConfigured()) return [];

  const capped = Math.max(1, Math.min(limit, 500));
  const pool = getPool();
  const entries: ContentTrashEntry[] = [];

  for (const kind of CONTENT_TRASH_KINDS) {
    const { rows } = await pool.query<{
      id: string;
      label: string;
      deleted_at: Date;
      updated_by: string | null;
    }>(
      `select id, ${CONTENT_LABEL_SQL[kind]} as label, deleted_at, updated_by
         from ${CONTENT_TABLES[kind]}
        where deleted_at is not null
        order by deleted_at desc
        limit $1`,
      [capped],
    );

    for (const row of rows) {
      entries.push({
        kind,
        id: row.id,
        label: row.label,
        detail: row.id,
        sizeBytes: null,
        deletedAt: new Date(row.deleted_at).toISOString(),
        deletedBy: row.updated_by,
      });
    }
  }

  return entries;
}

/**
 * กู้คืนเนื้อหาจากถัง — **ทำได้เฉพาะของที่อยู่ในถังแล้ว** (ประตูอยู่ที่ SQL)
 * คืน `false` = ไม่มีแถวที่เข้าเงื่อนไข (ไม่มีจริง/ยังใช้งานอยู่/ถูกลบถาวรไปแล้ว)
 */
export async function restoreContentTrashItem(
  kind: ContentTrashKind,
  id: string,
  actorEmail: string | null,
): Promise<boolean> {
  if (!isDatabaseConfigured() || id === "") return false;

  const result = await getPool().query(
    `update ${CONTENT_TABLES[kind]}
        set deleted_at = null, updated_at = now(), updated_by = $2
      where id = $1 and deleted_at is not null`,
    [id, actorEmail],
  );

  const restored = (result.rowCount ?? 0) > 0;
  if (restored) {
    await recordAudit({
      action: TRASH_AUDIT_ACTIONS.restore,
      actorEmail,
      target: `${kind}:${id}`,
      detail: "restored",
    });
  }
  return restored;
}

/**
 * ลบเนื้อหา **ถาวรจากถังขยะ** — ประตูเดียวกับจอของแต่ละชนิด (`and deleted_at is not null`)
 * ⚠️ ลบสินค้าแล้วส่วนผสมหายตาม (cascade) — ตั้งใจ (ของที่ยังใช้งานอยู่ไม่มีทางเข้าเงื่อนไขนี้)
 */
export async function deleteContentTrashItemPermanently(
  kind: ContentTrashKind,
  id: string,
  actorEmail: string | null,
): Promise<boolean> {
  if (!isDatabaseConfigured() || id === "") return false;

  const result = await getPool().query(`delete from ${CONTENT_TABLES[kind]} where id = $1 and deleted_at is not null`, [id]);

  const deleted = (result.rowCount ?? 0) > 0;
  if (deleted) {
    await recordAudit({
      action: TRASH_AUDIT_ACTIONS.permanent,
      actorEmail,
      target: `${kind}:${id}`,
      detail: "permanent",
    });
  }
  return deleted;
}

/**
 * ลบถาวร **ทุกอย่าง** ในถังขยะเนื้อหา (ปุ่ม "ลบถาวรทั้งหมด" ที่หน้าถังขยะ) — คืนจำนวนที่ลบ
 * ⚠️ ยังไม่พ้นระยะก็ลบได้ (ผู้ดูแลสั่งเอง · มีด่านติ๊กยืนยันอยู่ที่ action)
 */
export async function emptyContentTrash(actorEmail: string | null): Promise<number> {
  if (!isDatabaseConfigured()) return 0;

  const counts = emptyContentTrashCounts();
  for (const kind of CONTENT_TRASH_KINDS) {
    const result = await getPool().query(`delete from ${CONTENT_TABLES[kind]} where deleted_at is not null`);
    counts[kind] = result.rowCount ?? 0;
  }

  const total = contentTrashTotal(counts);
  if (total > 0) {
    await recordAudit({
      action: TRASH_AUDIT_ACTIONS.permanent,
      actorEmail,
      target: `${TRASH_AUDIT_TARGET}-content`,
      detail: `empty ${summarizeContentTrash(counts)}`,
    });
  }
  return total;
}
