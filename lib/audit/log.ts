import { getPool } from "@/db/pool";
import { isDatabaseConfigured } from "@/lib/content/repository";

/**
 * บันทึก "ใครทำอะไร เมื่อไร" (X2.2 — เดิมตาราง `audit_log` มีอยู่แต่ยังไม่เคยเขียนแถวเลย)
 *
 * หลักการ
 * - **ห้ามทำให้การทำงานหลักล้มเพราะบันทึกไม่ได้** ⇒ เขียนแบบ "พยายาม" และกลืนข้อผิดพลาด
 *   (การเผยแพร่เพจต้องสำเร็จ แม้ตาราง audit จะมีปัญหา)
 * - เก็บ **ข้อความสั้น ๆ** ไม่เก็บข้อมูลอ่อนไหว/เนื้อหาเต็ม (เช่น รหัสผ่าน · เนื้อหาเพจทั้งก้อน)
 * - retention 90 วัน (มติ Q16) — งานลบอัตโนมัติยังเป็นหนี้ในแผน (X2)
 */

export type AuditAction =
  | "login-success"
  | "login-failure"
  | "logout"
  | "publish"
  | "restore-revision"
  | "preset-save"
  | "pages-update"
  /** ย้ายรุ่นรูปทรงบล็อกของข้อมูลที่เก็บไว้ (X1.1) */
  | "migrate-blocks"
  /** ลบข้อมูลที่หมดอายุตามนโยบายระยะเก็บ (X2b) — ร่องรอยว่าลบอะไรไปเท่าไร */
  | "retention-purge"
  /**
   * ลบข้อมูลทั้งหมดของเจ้าของข้อมูลตามคำขอใช้สิทธิ์ (PDPA · รอบที่ 77)
   * ⚠️ เก็บอีเมลแบบปิดบางส่วนเท่านั้น (`a***@domain`) — ดู `lib/privacy/erasure.ts`
   */
  | "erase-subject"
  /** ย้ายของเข้าถังขยะ (X2.4) — ภาพในคลัง/พรีเซ็ตบล็อก */
  | "trash-move"
  /** กู้คืนของจากถังขยะ (X2.4) */
  | "trash-restore"
  /** ลบถาวรด้วยมือจากถังขยะ (X2.4) */
  | "trash-delete"
  /** ลบถาวรของในถังเมื่อพ้นระยะเก็บ (X2.4) */
  | "trash-purge"
  /** สร้างลิงก์พรีวิวชั่วคราวให้ผู้จัดการ (X2.6) — ⚠️ ห้ามเก็บโทเคนใน detail */
  | "preview-link-create"
  /** ยกเลิกลิงก์พรีวิว (X2.6) */
  | "preview-link-revoke"
  /** เก็บกวาดลิงก์พรีวิวที่ปิดแล้วและพ้นอายุเก็บ (X2.6) */
  | "preview-link-purge"
  /** สร้างบัญชีผู้ดูแล (X1.10 · RBAC) */
  | "admin-user-create"
  /** เปลี่ยนบทบาทผู้ดูแล */
  | "admin-user-role"
  /** ปิดบัญชีผู้ดูแล (พนักงานออก/เครื่องหาย) */
  | "admin-user-disable"
  /** เปิดบัญชีผู้ดูแลกลับ */
  | "admin-user-enable"
  /** ตั้งรหัสผ่านใหม่ให้บัญชีผู้ดูแล */
  | "admin-user-password"
  /** **ลบบัญชีผู้ดูแลถาวร** (B3 รอบที่ 90) — ต่างจากการปิดบัญชี: ข้อมูลบัญชีหายไปจากตาราง */
  | "admin-user-delete"
  /** บันทึกชุดสำเร็จของส่วนกลาง (W3b) — navbar/footer/ป้ายประกาศ */
  | "chrome-preset-save"
  /** ใช้ชุดสำเร็จของส่วนกลางกับฉบับร่าง (W3b) — ไม่แตะฉบับเผยแพร่ */
  | "chrome-preset-apply"
  /** ย้อนกลับฉบับร่างก่อนใช้ชุด (W3b ต่อ · รอบที่ 81) */
  | "chrome-preset-undo"
  /** นำเข้าชุดของส่วนกลางจากไฟล์ JSON (W3b ต่อ · รอบที่ 91) */
  | "chrome-preset-import"
  /** เพิกถอนเซสชันหลังบ้าน (รายตัว/ทั้งบัญชี · รอบที่ 95) */
  | "admin-session-revoke";

export type AuditEntry = {
  readonly action: AuditAction;
  readonly actorEmail: string | null;
  readonly target: string | null;
  readonly detail?: string | null;
};

export async function recordAudit(entry: AuditEntry): Promise<void> {
  if (!isDatabaseConfigured()) return;
  try {
    await getPool().query("insert into audit_log (actor_email, action, target, detail) values ($1, $2, $3, $4)", [
      entry.actorEmail === null ? null : entry.actorEmail.slice(0, 200),
      entry.action,
      entry.target === null ? null : entry.target.slice(0, 200),
      entry.detail === undefined || entry.detail === null ? null : entry.detail.slice(0, 500),
    ]);
  } catch {
    /* เงียบ — ห้ามทำให้การทำงานหลักล้มเพราะบันทึกไม่ได้ */
  }
}

export type AuditRow = {
  readonly action: string;
  readonly actorEmail: string | null;
  readonly target: string | null;
  /** รายละเอียดสั้น ๆ (เช่น บทบาทใหม่ · จำนวนที่ลบ) — ไม่มีข้อมูลอ่อนไหว (ดู `recordAudit`) */
  readonly detail: string | null;
  readonly createdAt: string;
};

const MAX_AUDIT_READ = 200;

function clampLimit(limit: number): number {
  return Math.max(1, Math.min(Math.trunc(limit), MAX_AUDIT_READ));
}

type RawAuditRow = {
  readonly action: string;
  readonly actor_email: string | null;
  readonly target: string | null;
  readonly detail: string | null;
  readonly created_at: Date;
};

function toAuditRow(row: RawAuditRow): AuditRow {
  return {
    action: row.action,
    actorEmail: row.actor_email,
    target: row.target,
    detail: row.detail,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

/** รายการล่าสุดทั้งหมด (ใช้ในหน้าภาพรวมหลังบ้าน) */
export async function listRecentAudit(limit = 50): Promise<readonly AuditRow[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const { rows } = await getPool().query<RawAuditRow>(
      "select action, actor_email, target, detail, created_at from audit_log order by created_at desc limit $1",
      [clampLimit(limit)],
    );
    return rows.map(toAuditRow);
  } catch {
    return [];
  }
}

/**
 * ร่องรอยของ **คนคนเดียว** (หน้า "กิจกรรมของฉัน" — B3 รอบที่ 90)
 * ⚠️ เทียบอีเมลแบบ `lower(btrim(...))` ทั้งสองฝั่ง — ตัวพิมพ์ใหญ่/ช่องว่างทำให้ "ดูกิจกรรมตัวเองไม่ครบ" ไม่ได้
 */
export async function listAuditForActor(actorEmail: string, limit = 50): Promise<readonly AuditRow[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const { rows } = await getPool().query<RawAuditRow>(
      `select action, actor_email, target, detail, created_at
         from audit_log
        where lower(btrim(coalesce(actor_email, ''))) = lower(btrim($1))
        order by created_at desc
        limit $2`,
      [actorEmail, clampLimit(limit)],
    );
    return rows.map(toAuditRow);
  } catch {
    return [];
  }
}

/**
 * ร่องรอยของ "กลุ่มเหตุการณ์" เช่น `admin-user-` (ประวัติบัญชีผู้ดูแล)
 * `prefix` มาจากโค้ดเท่านั้น (ไม่ใช่จากผู้ใช้) — แต่ยังผูกเป็นพารามิเตอร์อยู่
 */
export async function listAuditForActionPrefix(prefix: string, limit = 50): Promise<readonly AuditRow[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const { rows } = await getPool().query<RawAuditRow>(
      `select action, actor_email, target, detail, created_at
         from audit_log
        where action like $1
        order by created_at desc
        limit $2`,
      [`${prefix}%`, clampLimit(limit)],
    );
    return rows.map(toAuditRow);
  } catch {
    return [];
  }
}
