import { getPool } from "@/db/pool";
import { recordAudit } from "@/lib/audit/log";
import { isDatabaseConfigured } from "@/lib/content/repository";
import { trashCutoffIsoFor } from "@/lib/retention/plan";
import {
  TRASH_AUDIT_ACTIONS,
  TRASH_AUDIT_TARGET,
  TRASH_KINDS,
  emptyTrashCounts,
  isTrashKind,
  summarizeTrash,
  trashTotal,
  type TrashKind,
} from "@/lib/trash/plan";

/**
 * ถังขยะ (X2.4) — **ชั้นที่แตะฐานข้อมูล**
 *
 * กติกาที่ตั้งใจ
 * - **soft delete**: ย้ายเข้า/กู้คืน = แก้ `deleted_at` เท่านั้น (ไม่คัดลอกข้อมูล ⇒ ไฟล์สำรองไม่บวม)
 * - ทุกคำสั่งที่ "แตะของที่อยู่ในถัง" มีเงื่อนไข `deleted_at is not null` ในตัว SQL เอง
 *   ⇒ กดลบถาวรของที่ยังใช้งานอยู่ไม่ได้ แม้จะยิงฟอร์มปลอมเข้ามา (ด่านอยู่ที่ฐานข้อมูล ไม่ใช่แค่ UI)
 * - ชื่อตารางมาจาก **ค่าคงที่ในโค้ด** (`TABLES`) โดยเลือกด้วย `TrashKind` ที่ผ่านการตรวจแล้ว
 *   ⇒ ค่าจากฟอร์มไม่มีทางกลายเป็น SQL
 * - **ไม่มี DB = คืนค่าว่าง/`null` ไม่โยน error** (หน้าจอหลังบ้านต้องไม่พังเพราะเรื่องนี้)
 * - บันทึก audit ทุกครั้งที่ของย้ายเข้า/ออกจากถัง (ผู้ดูแลตรวจย้อนหลังได้)
 */

/** ชื่อตารางของแต่ละชนิด — คีย์คือ `TrashKind` ที่ตรวจแล้วเท่านั้น */
const TABLES: Readonly<Record<TrashKind, "media" | "block_preset" | "chrome_preset">> = {
  media: "media",
  preset: "block_preset",
  /* พรีเซ็ตของส่วนกลาง (W3b) — ใช้ถังเดียวกัน ไม่มีทางลบถาวรที่อื่น */
  chromePreset: "chrome_preset",
};

export type TrashEntry = {
  readonly kind: TrashKind;
  readonly id: string;
  /** ชื่อที่คนอ่านรู้เรื่อง (ชื่อไฟล์ / ชื่อพรีเซ็ต) */
  readonly label: string;
  /** รายละเอียดสั้น: mime + ขนาดภาพ หรือชนิดบล็อกของพรีเซ็ต */
  readonly detail: string | null;
  readonly sizeBytes: number | null;
  readonly deletedAt: string;
  readonly deletedBy: string | null;
};

export type TrashStats = Readonly<Record<TrashKind, number>> & { readonly total: number };

function statsOf(counts: Readonly<Record<TrashKind, number>>): TrashStats {
  return { ...counts, total: trashTotal(counts) };
}

/** รายการของในถัง (ใหม่สุดก่อน) — รวมสองตารางแล้วเรียงตามเวลาที่ลบ */
export async function listTrash(limit = 200): Promise<readonly TrashEntry[]> {
  if (!isDatabaseConfigured()) return [];

  const capped = Math.max(1, Math.min(limit, 500));
  const pool = getPool();

  const mediaRows = await pool.query<{
    id: string;
    filename: string;
    mime: string;
    size_bytes: number;
    deleted_at: Date;
    deleted_by: string | null;
  }>(
    `select id, filename, mime, size_bytes, deleted_at, deleted_by
       from media
      where deleted_at is not null
      order by deleted_at desc
      limit $1`,
    [capped],
  );

  const presetRows = await pool.query<{
    id: string;
    name: string;
    block_type: string;
    deleted_at: Date;
    deleted_by: string | null;
  }>(
    `select id, name, block_type, deleted_at, deleted_by
       from block_preset
      where deleted_at is not null
      order by deleted_at desc
      limit $1`,
    [capped],
  );

  const chromePresetRows = await pool.query<{
    id: string;
    name: string;
    kind: string;
    deleted_at: Date;
    deleted_by: string | null;
  }>(
    `select id, name, kind, deleted_at, deleted_by
       from chrome_preset
      where deleted_at is not null
      order by deleted_at desc
      limit $1`,
    [capped],
  );

  const entries: TrashEntry[] = [
    ...mediaRows.rows.map((row) => ({
      kind: "media" as const,
      id: row.id,
      label: row.filename,
      detail: row.mime,
      sizeBytes: row.size_bytes,
      deletedAt: new Date(row.deleted_at).toISOString(),
      deletedBy: row.deleted_by,
    })),
    ...presetRows.rows.map((row) => ({
      kind: "preset" as const,
      id: row.id,
      label: row.name,
      detail: row.block_type,
      sizeBytes: null,
      deletedAt: new Date(row.deleted_at).toISOString(),
      deletedBy: row.deleted_by,
    })),
    ...chromePresetRows.rows.map((row) => ({
      kind: "chromePreset" as const,
      id: row.id,
      label: row.name,
      detail: row.kind,
      sizeBytes: null,
      deletedAt: new Date(row.deleted_at).toISOString(),
      deletedBy: row.deleted_by,
    })),
  ];

  entries.sort((a, b) => (a.deletedAt < b.deletedAt ? 1 : a.deletedAt > b.deletedAt ? -1 : 0));
  return entries.slice(0, capped);
}

/** จำนวนของในถังแยกตามชนิด (ใช้บนการ์ดหน้าภาพรวม/หัวหน้าถังขยะ) */
export async function trashStats(): Promise<TrashStats> {
  if (!isDatabaseConfigured()) return statsOf(emptyTrashCounts());

  const { rows } = await getPool().query<{ kind: string; n: number }>(
    `select 'media'::text as kind, count(*)::int as n from media where deleted_at is not null
     union all
     select 'preset'::text as kind, count(*)::int as n from block_preset where deleted_at is not null
     union all
     select 'chromePreset'::text as kind, count(*)::int as n from chrome_preset where deleted_at is not null`,
  );

  const counts = emptyTrashCounts();
  for (const row of rows) {
    /* ใช้ตัวตรวจกลาง ⇒ เพิ่มชนิดใหม่แล้วไม่ต้องแก้เงื่อนไขซ้ำที่นี่ */
    if (isTrashKind(row.kind)) counts[row.kind] = row.n;
  }
  return statsOf(counts);
}

/** ย้ายของเข้าถังขยะ — คืน `false` ถ้าไม่พบ หรืออยู่ในถังอยู่แล้ว (ไม่ทับเวลาที่ลบเดิม) */
async function moveToTrash(kind: TrashKind, id: string, actorEmail: string | null): Promise<boolean> {
  if (!isDatabaseConfigured() || id === "") return false;

  const result = await getPool().query(
    `update ${TABLES[kind]} set deleted_at = now(), deleted_by = $2 where id = $1 and deleted_at is null`,
    [id, actorEmail],
  );

  const moved = (result.rowCount ?? 0) > 0;
  if (moved) {
    await recordAudit({
      action: TRASH_AUDIT_ACTIONS.move,
      actorEmail,
      target: `${kind}:${id}`,
      detail: "trashed",
    });
  }
  return moved;
}

export async function trashMedia(id: string, actorEmail: string | null): Promise<boolean> {
  return moveToTrash("media", id, actorEmail);
}

export async function trashBlockPreset(id: string, actorEmail: string | null): Promise<boolean> {
  return moveToTrash("preset", id, actorEmail);
}

/**
 * ย้าย **พรีเซ็ตของส่วนกลาง** (W3b) เข้าถัง — ใช้กลไกเดียวกับภาพ/พรีเซ็ตบล็อก
 * ⇒ ไม่มีทางลบถาวรของพรีเซ็ตส่วนกลางจากหน้าจอพรีเซ็ต (ต้องผ่านถังเท่านั้น)
 */
export async function trashChromePreset(id: string, actorEmail: string | null): Promise<boolean> {
  return moveToTrash("chromePreset", id, actorEmail);
}

/** กู้คืนจากถัง — คืน `false` ถ้าไม่พบ หรือของนั้นไม่ได้อยู่ในถัง */
export async function restoreTrashItem(kind: TrashKind, id: string, actorEmail: string | null): Promise<boolean> {
  if (!isDatabaseConfigured() || id === "") return false;

  const result = await getPool().query(
    `update ${TABLES[kind]} set deleted_at = null, deleted_by = null where id = $1 and deleted_at is not null`,
    [id],
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

/** ลบถาวรด้วยมือ — **ทำได้เฉพาะของที่อยู่ในถังแล้ว** (กันการลบของที่ใช้งานอยู่) */
export async function deleteTrashItemPermanently(
  kind: TrashKind,
  id: string,
  actorEmail: string | null,
): Promise<boolean> {
  if (!isDatabaseConfigured() || id === "") return false;

  const result = await getPool().query(`delete from ${TABLES[kind]} where id = $1 and deleted_at is not null`, [id]);

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

/** ลบถาวรทุกอย่างในถัง (ยังไม่พ้นระยะก็ลบได้ — ผู้ดูแลสั่งเอง) — คืนจำนวนที่ลบ */
export async function emptyTrash(actorEmail: string | null): Promise<number> {
  if (!isDatabaseConfigured()) return 0;

  const counts = emptyTrashCounts();
  for (const kind of TRASH_KINDS) {
    const result = await getPool().query(`delete from ${TABLES[kind]} where deleted_at is not null`);
    counts[kind] = result.rowCount ?? 0;
  }

  const total = trashTotal(counts);
  if (total > 0) {
    await recordAudit({
      action: TRASH_AUDIT_ACTIONS.permanent,
      actorEmail,
      target: TRASH_AUDIT_TARGET,
      detail: `empty ${summarizeTrash(counts)}`,
    });
  }
  return total;
}

export type TrashPurgeReport = {
  readonly at: string;
  readonly dryRun: boolean;
  readonly counts: Readonly<Record<TrashKind, number>>;
  readonly total: number;
};

/**
 * ลบถาวรของในถังที่พ้นระยะเก็บ — ใช้เวลาตัดจาก `lib/retention/plan.ts` (ที่เดียว)
 *
 * - `dryRun` ใช้จำนวนคำสั่งเดียวกัน (count แทน delete) ⇒ ตัวเลขบนหน้าจอตรงกับของจริง
 * - ไม่บันทึก audit ตอน dry run · บันทึกเมื่อลบจริงและมีของถูกลบ
 */
export async function purgeExpiredTrash(
  options: { readonly now?: Date; readonly dryRun?: boolean } = {},
): Promise<TrashPurgeReport | null> {
  if (!isDatabaseConfigured()) return null;

  const now = options.now ?? new Date();
  const dryRun = options.dryRun === true;
  const cutoffIso = trashCutoffIsoFor(now);
  const counts = emptyTrashCounts();

  for (const kind of TRASH_KINDS) {
    const table = TABLES[kind];
    if (dryRun) {
      const { rows } = await getPool().query<{ n: number }>(
        `select count(*)::int as n from ${table} where deleted_at is not null and deleted_at < $1`,
        [cutoffIso],
      );
      counts[kind] = rows[0]?.n ?? 0;
    } else {
      const result = await getPool().query(`delete from ${table} where deleted_at is not null and deleted_at < $1`, [
        cutoffIso,
      ]);
      counts[kind] = result.rowCount ?? 0;
    }
  }

  const total = trashTotal(counts);
  if (!dryRun && total > 0) {
    await recordAudit({
      action: TRASH_AUDIT_ACTIONS.purge,
      actorEmail: null,
      target: TRASH_AUDIT_TARGET,
      detail: summarizeTrash(counts),
    });
  }

  return { at: now.toISOString(), dryRun, counts, total };
}
