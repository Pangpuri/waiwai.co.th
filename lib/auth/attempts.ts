import { getPool } from "@/db/pool";
import { isDatabaseConfigured } from "@/lib/content/repository";
import { evaluateAttempts, type LoginAttempt, type RateLimitState } from "@/lib/auth/rate-limit";

/**
 * อ่าน/เขียนร่องรอยการพยายามล็อกอิน (X2.1) — ต้อง **ไม่ทำให้การล็อกอินพัง**
 * ถ้าฐานข้อมูลมีปัญหา (อ่าน/เขียนไม่ได้) ⇒ ปล่อยผ่าน (fail-open)
 * เพราะการล็อกผู้ดูแลออกจากระบบเพราะ DB มีปัญหา อันตรายกว่าความเสี่ยงที่เรากำลังกัน
 * (บันทึกไว้เป็นเหตุผลในโค้ด — และจะทบทวนเมื่อมี monitoring)
 */

const RETENTION_DAYS = 30;

export async function recordLoginAttempt(email: string, succeeded: boolean): Promise<void> {
  if (!isDatabaseConfigured()) return;
  try {
    await getPool().query("insert into login_attempt (email, succeeded) values ($1, $2)", [email.slice(0, 200), succeeded]);
  } catch {
    /* เงียบ — ห้ามทำให้การล็อกอินล้มเพราะบันทึกไม่ได้ */
  }
}

export async function loginRateLimit(email: string, now: number = Date.now()): Promise<RateLimitState> {
  if (!isDatabaseConfigured()) return { locked: false, retryAfterMs: 0, failures: 0 };

  try {
    const { rows } = await getPool().query<{ succeeded: boolean; created_at: Date }>(
      `select succeeded, created_at
         from login_attempt
        where lower(email) = lower($1)
        order by created_at desc
        limit 50`,
      [email.slice(0, 200)],
    );

    const attempts: LoginAttempt[] = rows.map((row) => ({ at: new Date(row.created_at).getTime(), succeeded: row.succeeded }));
    return evaluateAttempts(attempts, now);
  } catch {
    return { locked: false, retryAfterMs: 0, failures: 0 };
  }
}

/** ลบร่องรอยเก่าตามระยะเก็บ (เรียกได้จากสคริปต์/งานประจำ — ยังไม่มีตัวรันอัตโนมัติ) */
export async function pruneLoginAttempts(now: number = Date.now()): Promise<number> {
  if (!isDatabaseConfigured()) return 0;
  const cutoff = new Date(now - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const { rowCount } = await getPool().query("delete from login_attempt where created_at < $1", [cutoff]);
  return rowCount ?? 0;
}

export const LOGIN_ATTEMPT_RETENTION_DAYS = RETENTION_DAYS;
