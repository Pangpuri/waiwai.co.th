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
  | "retention-purge";

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
  readonly createdAt: string;
};

/** รายการล่าสุด (ใช้ในหน้าจอหลังบ้านในอนาคต) */
export async function listRecentAudit(limit = 50): Promise<readonly AuditRow[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const { rows } = await getPool().query<{ action: string; actor_email: string | null; target: string | null; created_at: Date }>(
      "select action, actor_email, target, created_at from audit_log order by created_at desc limit $1",
      [Math.max(1, Math.min(limit, 200))],
    );
    return rows.map((row) => ({
      action: row.action,
      actorEmail: row.actor_email,
      target: row.target,
      createdAt: new Date(row.created_at).toISOString(),
    }));
  } catch {
    return [];
  }
}
