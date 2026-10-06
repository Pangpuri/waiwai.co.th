import { getPool, isDatabaseConfigured } from "@/db/pool";

import {
  REVISION_KINDS,
  revisionDiff,
  type RevisionKind,
  type RevisionMeta,
  type RevisionSnapshot,
} from "@/lib/revisions/model";

/**
 * ชั้นข้อมูล "ประวัติรุ่น" ของ สินค้า/เมนูอาหาร/ข่าว (B1 · รอบที่ 143)
 *
 * ตารางเดียว `entity_revision` (migration 0024) — กลไกเหมือน `page_document_revision` ของตัวสร้างหน้าเว็บ:
 *   เก็บ **ทุกครั้งที่บันทึก** · อ่านย้อนหลังได้ · กู้คืนได้ · ตัวลบกลางเก็บกวาดตามระยะ 1 ปี
 *
 * ⚠️ กติกาสำคัญ
 *   1. **การกู้คืนก็ถูกบันทึกเป็นรุ่นหนึ่งเสมอ** ⇒ กู้คืนผิดก็ย้อนกลับได้ (ประวัติไม่ขาด)
 *   2. เก็บ **"สถานะที่บันทึกลงฐานข้อมูลจริง"** (อ่านกลับหลังเขียน) ไม่ใช่ค่าที่ผู้ใช้พิมพ์
 *      ⇒ ประวัติตรงกับของจริงเสมอ
 *   3. ไม่มี DB ⇒ คืนค่าว่าง/ไม่เขียน (หน้าเว็บห้ามพังเพราะฐานข้อมูล — แนวเดียวกับที่อื่นในโปรเจกต์)
 */

export type EntityRevisionRow = RevisionMeta & {
  readonly snapshot: RevisionSnapshot;
};

function isKind(value: string): value is RevisionKind {
  return (REVISION_KINDS as readonly string[]).includes(value);
}

/** บันทึกรุ่นใหม่ (คืนเลขรุ่น) — เรียกหลังการบันทึก/กู้คืนสำเร็จเท่านั้น */
export async function recordEntityRevision(options: {
  readonly kind: RevisionKind;
  readonly entityId: string;
  readonly snapshot: RevisionSnapshot;
  readonly actor: string;
  readonly note?: string;
}): Promise<number | null> {
  if (!isDatabaseConfigured()) return null;
  const { kind, entityId, snapshot, actor } = options;
  try {
    const result = await getPool().query<{ revision: number }>(
      `insert into entity_revision (kind, entity_id, revision, snapshot, note, created_by)
       select $1, $2, coalesce(max(revision), 0) + 1, $3::jsonb, $4, $5
         from entity_revision where kind = $1 and entity_id = $2
       returning revision`,
      [kind, entityId, JSON.stringify(snapshot), options.note ?? "", actor],
    );
    return result.rows[0]?.revision ?? null;
  } catch {
    /* ประวัติคือ "ตาข่ายกันพลาด" — เขียนไม่ได้ต้องไม่ทำให้การบันทึกเนื้อหาล้ม */
    return null;
  }
}

/** รายการรุ่น (ใหม่ → เก่า) พร้อมจำนวนช่องที่เปลี่ยนเทียบกับรุ่นก่อนหน้า */
export async function listEntityRevisions(options: {
  readonly kind: RevisionKind;
  readonly entityId: string;
  readonly current: RevisionSnapshot;
  readonly limit?: number;
}): Promise<readonly EntityRevisionRow[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const result = await getPool().query<{
      id: string;
      revision: number;
      snapshot: RevisionSnapshot;
      note: string | null;
      created_by: string | null;
      created_local: string | null;
    }>(
      `select id::text as id, revision, snapshot, note, created_by,
              to_char(created_at at time zone 'Asia/Bangkok', 'YYYY-MM-DD HH24:MI') as created_local
         from entity_revision
        where kind = $1 and entity_id = $2
        order by revision desc
        limit $3`,
      [options.kind, options.entityId, options.limit ?? 30],
    );

    const rows: EntityRevisionRow[] = [];
    result.rows.forEach((row, index) => {
      /* เทียบกับ "รุ่นที่ใหม่กว่า" (รุ่นแรกเทียบกับสถานะปัจจุบันของแถว) */
      const newer = index === 0 ? options.current : result.rows[index - 1]?.snapshot ?? options.current;
      rows.push({
        id: row.id,
        revision: row.revision,
        snapshot: row.snapshot,
        note: row.note ?? "",
        createdBy: row.created_by ?? "",
        createdLocal: row.created_local ?? "",
        changeCount: revisionDiff(row.snapshot, newer).length,
        isCurrent: false,
      });
    });
    return rows;
  } catch {
    return [];
  }
}

/** อ่านสแนปช็อตของรุ่นหนึ่ง (ใช้ตอนกู้คืน) */
export async function loadEntityRevision(options: {
  readonly kind: RevisionKind;
  readonly entityId: string;
  readonly revisionId: string;
}): Promise<RevisionSnapshot | null> {
  if (!isDatabaseConfigured()) return null;
  try {
    const result = await getPool().query<{ snapshot: RevisionSnapshot }>(
      `select snapshot from entity_revision where kind = $1 and entity_id = $2 and id = $3::bigint`,
      [options.kind, options.entityId, options.revisionId],
    );
    return result.rows[0]?.snapshot ?? null;
  } catch {
    return null;
  }
}

/** จำนวนรุ่นทั้งหมด (ใช้ในด่านตรวจ/รายงาน) */
export async function countEntityRevisions(): Promise<number> {
  if (!isDatabaseConfigured()) return 0;
  try {
    const result = await getPool().query<{ n: number }>("select count(*)::int as n from entity_revision");
    return result.rows[0]?.n ?? 0;
  } catch {
    return 0;
  }
}

export { isKind as isRevisionKind };
