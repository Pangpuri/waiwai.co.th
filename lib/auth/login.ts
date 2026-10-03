import type { AdminUser } from "@/lib/auth/types";
import type { AdminUserStore } from "@/lib/auth/user-store";

/**
 * ตรรกะตัดสิน "ล็อกอินผ่านหรือไม่" — **บริสุทธิ์ ทดสอบได้ ไม่ต้องมี Next/DB**
 *
 * แยกออกมาจาก Server Action (app/admin/actions.ts) เพราะ
 *   1. โค้ดฝั่งเซิร์ฟเวอร์ของ Next ทดสอบด้วย `node --test` ไม่ได้ (ต้องมี request context)
 *   2. การตัดสินใจด้านความปลอดภัยต้องมีเทสต์ — และควรมีที่เดียว
 *   3. เปลี่ยนที่เก็บบัญชี (env → DB) ได้โดยไม่แตะตรรกะนี้ (รับ store เข้ามาเป็น dependency)
 */

export type LoginOutcome =
  | { readonly kind: "ok"; readonly user: AdminUser }
  /** อีเมล/รหัสผ่านไม่ถูก — **ไม่บอกรายละเอียด** ว่าเสียที่อีเมลหรือรหัส (กันการไล่เดาบัญชี) */
  | { readonly kind: "invalid" }
  /** ระบบยังตั้งค่าไม่ครบ (ไม่มีบัญชี/ไม่มี secret) */
  | { readonly kind: "unconfigured" };

export type LoginDeps = {
  /** null = ยังตั้งค่าไม่ครบ */
  readonly store: AdminUserStore | null;
  readonly verify: (password: string, passwordHash: string) => Promise<boolean>;
  /** เรียกเมื่อ "ไม่พบบัญชี" เพื่อให้ใช้เวลาเท่ากับตอนพบบัญชี */
  readonly equalize: (password: string) => Promise<void>;
};

export type LoginInput = {
  readonly email: string;
  readonly password: string;
};

/**
 * ตรวจข้อมูลล็อกอิน
 *
 * ลำดับที่ตั้งใจ
 * - ตรวจ "รูปแบบที่จำเป็น" ก่อน (ว่าง/อีเมลผิด) — ไม่ต้องแตะ store เลย
 * - **ทุกเส้นทางที่ล้มเหลวต้องเรียก `equalize()`** เพื่อไม่ให้เวลาตอบกลับบอกได้ว่าอีเมลไหนมีในระบบ
 * - บัญชีที่ถูกปิด (`disabled`) ถือเป็น "invalid" เหมือนกัน — ไม่บอกว่า "บัญชีนี้ถูกระงับ"
 */
export async function attemptLogin(input: LoginInput, deps: LoginDeps): Promise<LoginOutcome> {
  const email = input.email.trim();
  const password = input.password;

  if (email === "" || password === "") return { kind: "invalid" };
  if (deps.store === null) return { kind: "unconfigured" };

  const account = await deps.store.findByEmail(email);

  if (account === null) {
    await deps.equalize(password);
    return { kind: "invalid" };
  }

  const matches = !account.disabled && (await deps.verify(password, account.passwordHash));

  if (!matches) {
    await deps.equalize(password);
    return { kind: "invalid" };
  }

  return {
    kind: "ok",
    user: {
      id: account.id,
      email: account.email,
      displayName: account.displayName,
      role: account.role,
      disabled: account.disabled,
    },
  };
}
