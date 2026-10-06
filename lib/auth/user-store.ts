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

/**
 * ต่อ store สองตัวเป็นตัวเดียว: **ลองตัวแรกก่อน แล้วค่อยตัวสำรอง** (X1.10 · รอบที่ 84)
 *
 * ทำไมต้องมี: หลังย้ายบัญชีไปฐานข้อมูลแล้ว ต้องไม่ทิ้ง **บัญชีผู้ดูแลระบบจาก env**
 * เพราะถ้าฐานข้อมูลว่าง (หรือตั้งค่าผิด) จะไม่มีใครล็อกอินเข้าไปสร้างบัญชีแรกได้เลย = ล็อกตัวเองออก
 * ⇒ `admin_user` = บัญชีงานประจำ · env = บัญชี "ประตูหลัง" สำหรับกู้สถานการณ์
 *
 * ⚠️ ลำดับสำคัญ: ตัวแรกที่พบบัญชีเป็นผู้ตัดสิน (ไม่รวมสิทธิ์ของสองบัญชีเข้าด้วยกัน)
 */
export function createFallbackUserStore(primary: AdminUserStore, fallback: AdminUserStore): AdminUserStore {
  return {
    async findByEmail(email: string): Promise<AdminAccount | null> {
      return (await primary.findByEmail(email)) ?? (await fallback.findByEmail(email));
    },
    async findById(id: string): Promise<AdminAccount | null> {
      return (await primary.findById(id)) ?? (await fallback.findById(id));
    },
  };
}

/**
 * ให้ **บัญชีจาก env** ตรวจรหัสผ่านด้วย hash จาก env เสมอ (รอบที่ 144 · บั๊กจริง)
 *
 * ที่มา: รอบที่ 124 แก้บั๊ก FK (`admin_session.user_id` → `admin_user(id)`) ด้วยการ
 * `ensureEnvAdminUser()` ⇒ เกิดแถวในตาราง `admin_user` ที่มี `password_hash = 'env-only'`
 * (ค่าที่ตั้งใจให้ยืนยันไม่ได้)
 *
 * ⚠️ ผลข้างเคียงที่มองไม่เห็น: `createFallbackUserStore` เลือก **DB ก่อน** และถอยไป env
 *    เฉพาะเมื่อ "ไม่พบอีเมล" ⇒ พอมีแถวแล้ว การล็อกอินจึงไปเทียบกับ `'env-only'`
 *    ⇒ **รหัสถูกก็ไม่ผ่านตลอด** (ทั้งเครื่องและคลาวด์ · audit เป็น `login-failure`)
 *
 * ทางแก้: ครอบ store ด้วยตัวนี้ — ถ้าบัญชีที่เจอ **เป็นอีเมลของ env** ให้ใช้ `passwordHash` จาก env
 * (ค่าในตารางยังเป็น `env-only` เหมือนเดิม ⇒ เอา hash จากฐานข้อมูลไปล็อกอินไม่ได้)
 */
export function createEnvHashOverrideStore(
  store: AdminUserStore,
  options: { readonly email: string; readonly passwordHash: string | null },
): AdminUserStore {
  const target = options.email.trim().toLowerCase();
  const override = options.passwordHash;

  const patch = (account: AdminAccount | null): AdminAccount | null => {
    if (account === null || override === null) return account;
    if (account.email.trim().toLowerCase() !== target) return account;
    return account.passwordHash === override ? account : { ...account, passwordHash: override };
  };

  return {
    async findByEmail(email: string): Promise<AdminAccount | null> {
      return patch(await store.findByEmail(email));
    },
    async findById(id: string): Promise<AdminAccount | null> {
      return patch(await store.findById(id));
    },
  };
}
