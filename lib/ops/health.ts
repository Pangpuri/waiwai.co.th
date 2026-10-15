/**
 * **ตัวตรวจสุขภาพระบบ (`/healthz`)** — รอบที่ 289 (2026-10-15) · ตรรกะล้วน
 *
 * ## ทำไมต้องมี
 * เคสจริง 2 ครั้งในวันเดียว:
 *   1. เดโมเสิร์ฟ **ข้อมูลตัวอย่าง** เพราะ `DATABASE_URL` ไม่ถึงแอป (รู้ตัวช้า ~ครึ่งวัน)
 *   2. `/admin/login` ตอบ "เกิดข้อผิดพลาดในระบบ" เพราะ **`DATABASE_URL` เป็น URL ของ role อ่าน**
 *      (อ่าน `admin_user` ไม่ได้) — กว่าจะรู้ก็ต้องยิงฟอร์มล็อกอินทดลอง + จำลองด้วย role อ่าน
 * ⇒ ต้องมีที่เดียวที่ตอบได้ว่า "แอปที่รันอยู่ **ต่อฐานข้อมูลด้วย role อะไร และทำอะไรได้/ไม่ได้**"
 *    โดยไม่ต้องเดา env และ **ไม่เปิดเผยรหัสผ่านใด ๆ**
 *
 * ## กติกาความปลอดภัย
 * - ต้องมี env **`HEALTH_KEY`** ไม่งั้น route ตอบ **404** (ไม่บอกด้วยซ้ำว่ามี endpoint นี้)
 * - เทียบคีย์ด้วย `timingSafeEqual` (กันการวัดเวลาเดาคีย์)
 * - ผลลัพธ์มีแค่: ชื่อ role · ชื่อฐานข้อมูล · boolean สิทธิ์ · จำนวน migration · รหัส error ของ Postgres
 *   — **ห้าม** ส่ง connection string, รหัสผ่าน, hash, อีเมล, หรือเนื้อหาฐานข้อมูล
 *
 * ตรรกะทั้งหมดอยู่ในไฟล์นี้ (บริสุทธิ์ ไม่แตะ DB/Next) ⇒ เทสต์ได้ด้วย `node --test`
 */
import { timingSafeEqual } from "node:crypto";

/** ตรวจคีย์ที่ผู้เรียกส่งมาว่าตรงกับ `HEALTH_KEY` ไหม (ค่าว่างฝั่งใดฝั่งหนึ่ง = ไม่ผ่าน) */
export function isHealthKeyValid(provided: string | null, expected: string | undefined): boolean {
  const secret = (expected ?? "").trim();
  const given = (provided ?? "").trim();
  if (secret === "" || given === "") return false;

  const left = Buffer.from(given, "utf8");
  const right = Buffer.from(secret, "utf8");
  /* ความยาวต่างกัน = ไม่ผ่าน (timingSafeEqual โยน error ถ้าความยาวไม่เท่ากัน) */
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** สรุปผลจาก "บทบาทหลังบ้าน" ที่ `/healthz` เส้นทางเดียวที่ผู้ดูแลอ่าน */
export type HealthVerdict =
  | "ok"
  | "admin-not-configured"
  | "admin-db-error"
  | "admin-cannot-read"
  | "admin-cannot-write";

export type AdminHealth = {
  /** ตั้ง `DATABASE_URL` ไว้หรือยัง */
  readonly configured: boolean;
  /** ต่อฐานข้อมูลได้จริงไหม */
  readonly reachable: boolean;
  readonly role: string | null;
  readonly database: string | null;
  /** role นี้ SELECT ตาราง `admin_user` ได้ไหม (การล็อกอินต้องอ่าน) */
  readonly canReadAdminUser: boolean;
  /** role นี้ INSERT ตาราง `admin_session` ได้ไหม (การล็อกอินต้องเขียน) */
  readonly canWriteAdminSession: boolean;
  /** มีแถวบัญชีโหมด env (`env-admin`) ไหม — เคยเป็นกับดัก FK ในอดีต (รอบ 124/144) */
  readonly envAdminRow: boolean;
  readonly migrations: number | null;
  readonly error: string | null;
};

/**
 * ตัดสิน "คำวินิจฉัย" จากข้อเท็จจริงของบทบาทหลังบ้าน
 *
 * ⚠️ ลำดับสำคัญ: "ต่อไม่ได้" ต้องมาก่อน "สิทธิ์ไม่พอ" (คนละสาเหตุ คนละวิธีแก้)
 */
export function verdictOf(admin: AdminHealth): HealthVerdict {
  if (!admin.configured) return "admin-not-configured";
  if (!admin.reachable) return "admin-db-error";
  if (!admin.canReadAdminUser) return "admin-cannot-read";
  if (!admin.canWriteAdminSession) return "admin-cannot-write";
  return "ok";
}

/**
 * ข้อความ error ที่ "ปลอดภัยพอจะส่งออก" — เอาแค่รหัส + ข้อความของ Postgres (ตัดความยาว)
 * ⚠️ Postgres ไม่ใส่รหัสผ่านในข้อความ error แต่เราไม่ส่ง stack trace อยู่แล้ว
 */
export function safeErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const code = (error as { readonly code?: unknown }).code;
    const message = (error as { readonly message?: unknown }).message;
    const parts = [typeof code === "string" ? code : null, typeof message === "string" ? message.slice(0, 160) : null].filter(
      (value): value is string => value !== null,
    );
    if (parts.length > 0) return parts.join(" ");
  }
  if (error instanceof Error) return error.message.slice(0, 160);
  return "unknown error";
}

/**
 * คำใบ้ทางแก้ — **ภาษาอังกฤษ** เพราะเป็น JSON ของ ops endpoint (คำอธิบายภาษาไทยอยู่ในเอกสาร/แชท)
 * ⇒ คำที่ผู้ใช้เห็นในหน้าเว็บยังมาจากพจนานุกรมเท่านั้น (ไม่ผิดกติกา i18n)
 */
export function hintOf(verdict: HealthVerdict): string {
  switch (verdict) {
    case "ok":
      return "Admin connection is healthy: owner role, can read admin tables and write sessions.";
    case "admin-not-configured":
      return "DATABASE_URL is missing on this deployment. Set it to the database owner URL, then redeploy.";
    case "admin-db-error":
      return "Cannot reach DATABASE_URL. Check host, password, sslmode and that the database still exists.";
    case "admin-cannot-read":
      return "Connected, but this role cannot read admin_user — DATABASE_URL is probably a public role. Use the owner URL.";
    case "admin-cannot-write":
      return "Connected and readable, but this role cannot write admin_session — grant write rights (owner role).";
  }
}
