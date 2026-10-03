import { isPasswordHashUsable, verifyPassword } from "@/lib/auth/password";
import { isAdminRole, type AdminRole, type AdminUser } from "@/lib/auth/types";

/**
 * ที่เก็บบัญชีผู้ดูแล ("user store")
 *
 * เฟสนี้ใช้ **โหมด env** ก่อน — แอดมินคนเดียวที่ประกาศใน `.env.local`
 * เหตุผล: ทำให้ล็อกอินใช้งานได้จริง *ก่อน* มีฐานข้อมูล และไม่ต้องรอ B1b
 * (ไม่มีที่ไหนในระบบนี้เก็บรหัสผ่านเป็นข้อความธรรมดา — เก็บเฉพาะ hash แบบ scrypt)
 *
 * เมื่อมี `DATABASE_URL` (เฟส B1b/B3) จะเพิ่ม `createDbUserStore()` ที่อ่านจากตาราง `admin_user`
 * แล้วสลับที่ `lib/auth/dal.ts` — สัญญาของ store ตั้งใจให้เหมือนกันทั้งสองโหมด
 */

export type AdminAccount = AdminUser & {
  /** hash เท่านั้น — ห้าม log ห้ามส่งกลับไปฝั่งเบราว์เซอร์ */
  readonly passwordHash: string;
};

export type AdminUserStore = {
  /** หาบัญชีจากอีเมล (ไม่สนตัวพิมพ์ใหญ่/เล็ก) — คืน null ถ้าไม่มี */
  findByEmail(email: string): Promise<AdminAccount | null>;
  /** หาบัญชีจาก id ที่อยู่ในเซสชัน */
  findById(id: string): Promise<AdminAccount | null>;
};

/**
 * hash ปลอมสำหรับ "ยิงเทียบเวลาตอนไม่พบบัญชี"
 * ถ้าไม่ทำ ผู้โจมตีวัดเวลาตอบกลับเพื่อเดาว่าอีเมลไหนมีในระบบ (user enumeration)
 * ค่านี้ไม่ผูกกับบัญชีจริง — ตรวจได้ว่า `verifyPassword` จะคืน false เสมอ
 */
const TIMING_EQUALIZER_HASH =
  "scrypt:32768:8:1:mB9Dlmx0+ik/0zrNmGMMWQ==:N3kj37JehPKbRd2fac3evwSs1D+Whws9ZoE0wcqulLpgH4G9kbTg5OQAJ6SaV5PFPppPnCppQOplkwRnA8nptA==";

/** เรียกเมื่อ "ไม่พบบัญชี" เพื่อให้ใช้เวลาเท่ากับตอนพบบัญชี */
export async function equalizeTiming(password: string): Promise<void> {
  await verifyPassword(password, TIMING_EQUALIZER_HASH);
}

export type EnvUserStoreInput = {
  readonly email: string | undefined;
  readonly passwordHash: string | undefined;
  readonly name: string | undefined;
  readonly role: string | undefined;
};

/** id คงที่ของบัญชีโหมด env (ไม่มี DB ให้สร้าง id จริง) */
export const ENV_ADMIN_ID = "env-admin";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * สร้าง store จากค่า env
 * คืน null เมื่อ **ตั้งค่าไม่ครบ** — ผู้เรียกต้องถือว่า "ล็อกอินใช้ไม่ได้" แล้วบอกวิธีตั้งค่า
 * (ห้ามมีค่าเริ่มต้นให้ เพราะบัญชีหลังบ้านที่เกิดจากค่า default คือช่องโหว่)
 */
export function createEnvUserStore(input: EnvUserStoreInput): AdminUserStore | null {
  const email = input.email?.trim() ?? "";
  const passwordHash = input.passwordHash?.trim() ?? "";
  if (email === "" || passwordHash === "") return null;

  /* hash ที่อ่านไม่ได้ = ตั้งค่าไม่สำเร็จ → ปิดการล็อกอินทั้งระบบ (fail-closed)
     ⚠️ เคสจริง 2026-10-02: ค่า hash ที่มี `$` ถูก dotenv ตัดทิ้งบางส่วน ทำให้ "รหัสถูกแต่ล็อกอินไม่ได้"
     และดูเหมือนรหัสผิด · การเช็คตรงนี้ทำให้เห็นชัดว่า "ยังตั้งค่าไม่ครบ" พร้อมวิธีแก้ */
  if (!isPasswordHashUsable(passwordHash)) return null;

  const role: AdminRole = input.role !== undefined && isAdminRole(input.role) ? input.role : "admin";
  const displayName = input.name?.trim() ?? "";

  const account: AdminAccount = {
    id: ENV_ADMIN_ID,
    email,
    displayName: displayName === "" ? email : displayName,
    role,
    disabled: false,
    passwordHash,
  };

  return {
    async findByEmail(candidate: string): Promise<AdminAccount | null> {
      return normalizeEmail(candidate) === normalizeEmail(account.email) ? account : null;
    },
    async findById(id: string): Promise<AdminAccount | null> {
      return id === account.id ? account : null;
    },
  };
}
