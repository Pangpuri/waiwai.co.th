import { getPool } from "@/db/pool";
import { createAdminSession, hashSessionId, newSessionId, revokeAdminSessions } from "@/lib/auth/sessions-repository";
import { createSessionToken, isSecretUsable, sessionExpiry } from "@/lib/auth/session";
import { isDatabaseConfigured } from "@/lib/content/repository";

/**
 * เซสชันผู้ดูแลสำหรับเครื่องมือ probe (รอบที่ 292–293) — **ใช้จากสคริปต์ฝั่งเซิร์ฟเวอร์เท่านั้น**
 *
 * กติกา
 * - **ไม่ใช้รหัสผ่านของเจ้าของ** — มินต์ด้วยโค้ดของโปรเจกต์เอง (`SESSION_SECRET` + ตาราง `admin_session`)
 * - **เพิกถอนทิ้งเมื่อจบ** เสมอ (ผู้เรียกต้องเรียก `releaseProbeSession()`)
 * - **ห้ามพิมพ์ค่าคุกกี้** ออก stdout (มีเทสต์สแกนใน `scripts/test-probe-routes.ts`)
 */

export type ProbeSession = {
  /** ค่าคุกกี้ที่เซ็นแล้ว — ใช้ส่งเป็น header เท่านั้น ห้ามพิมพ์ */
  readonly cookie: string;
  readonly sessionId: string;
  readonly userId: string;
  readonly label: string;
};

/** หาบัญชีผู้ดูแลที่ยังใช้งานได้ (ไม่มี DB/ไม่มีบัญชี = null ⇒ ผู้เรียกยิงเฉพาะเส้นสาธารณะ) */
export async function pickProbeAdminUserId(): Promise<string | null> {
  if (!isDatabaseConfigured()) return null;
  try {
    const { rows } = await getPool().query<{ id: string }>(
      "select id from admin_user where disabled = false order by (id = 'env-admin') desc, id limit 1",
    );
    return rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

/** มินต์เซสชันใหม่ (คืน null เมื่อทำไม่ได้ — ผู้เรียกต้องรายงาน ไม่ใช่เงียบ) */
export async function mintProbeSession(label: string, userId?: string): Promise<ProbeSession | null> {
  const secret = process.env.SESSION_SECRET;
  if (!isSecretUsable(secret)) return null;

  const actorId = userId ?? (await pickProbeAdminUserId());
  if (actorId === null) return null;

  const sessionId = newSessionId();
  const expiresAt = sessionExpiry(Date.now());
  const created = await createAdminSession({
    userId: actorId,
    sid: sessionId,
    expiresAt: new Date(expiresAt),
    userAgent: `waiwai-${label}`,
  });
  if (!created) return null;

  const cookie = createSessionToken({ userId: actorId, role: "admin", expiresAt, sid: sessionId }, secret as string);
  return { cookie, sessionId, userId: actorId, label };
}

/** เพิกถอนเซสชันที่มินต์ไว้ (คืน false = เพิกถอนไม่สำเร็จ ⇒ ต้องรายงาน) */
export async function releaseProbeSession(session: ProbeSession): Promise<boolean> {
  try {
    const result = await revokeAdminSessions({ hash: hashSessionId(session.sessionId), actor: `probe:${session.label}` });
    return result.ok;
  } catch {
    return false;
  }
}
