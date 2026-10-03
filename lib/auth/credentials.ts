import { randomInt } from "node:crypto";

/**
 * สร้างข้อมูลล็อกอินให้ผู้ดูแล (ลิงก์ + รหัสผ่าน) — ตรรกะล้วน ทดสอบได้
 *
 * ใช้โดยสคริปต์ `npm run admin:create` เท่านั้น
 * - รหัสผ่านสุ่มจากชุดอักขระที่ **ไม่มีความกำกวม** (ไม่มี O/0 · I/l/1) เพื่อให้พิมพ์/บอกทางโทรศัพท์ได้
 * - ลิงก์มีแค่ `?email=` (อีเมลไม่ใช่ความลับ) — **ไม่ใส่รหัสผ่านใน URL** เพราะจะติดในประวัติเบราว์เซอร์/ล็อกของเซิร์ฟเวอร์
 */

/** ตัดอักขระที่อ่านสับสนออก: O 0 o · I l 1 · และสระ/พยัญชนะที่คล้ายกัน */
const PASSWORD_CHARSET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const PASSWORD_LENGTH = 16;

/** รหัสผ่านแบบอ่านออกเสียงได้: 4 กลุ่ม กลุ่มละ 4 ตัว คั่นด้วย `-` (เช่น `Kfm2-tRqx-9bYe-hWzn`) */
export function generatePassword(length: number = PASSWORD_LENGTH): string {
  if (!Number.isInteger(length) || length < 8) {
    throw new Error("password length must be an integer >= 8");
  }

  let raw = "";
  for (let index = 0; index < length; index += 1) {
    raw += PASSWORD_CHARSET[randomInt(PASSWORD_CHARSET.length)];
  }

  const groups: string[] = [];
  for (let index = 0; index < raw.length; index += 4) {
    groups.push(raw.slice(index, index + 4));
  }
  return groups.join("-");
}

/** ลิงก์หน้าล็อกอินหลังบ้าน (path นี้ไม่ถูกเติม prefix ภาษาของหน้าเว็บสาธารณะ) */
export const ADMIN_LOGIN_PATH = "/admin/login";

/**
 * ประกอบลิงก์เต็มจาก base URL
 * - ตัด `/` ท้ายซ้ำ · ถ้าไม่ส่ง base มา ให้คืน path สัมพัทธ์ (ผู้ใช้เปิดจากโดเมนไหนก็ได้)
 */
export function buildLoginUrl(baseUrl = "", email = ""): string {
  const base = baseUrl.trim().replace(/\/+$/, "");
  const query = email.trim() === "" ? "" : `?email=${encodeURIComponent(email.trim())}`;
  return `${base}${ADMIN_LOGIN_PATH}${query}`;
}

/** ค่าที่ต้องใส่ใน `.env.local` — เรียงตามที่ใช้จริง เพื่อคัดลอกวางได้ตรง ๆ */
export type AdminEnvInput = {
  readonly email: string;
  readonly passwordHash: string;
  readonly secret: string;
  /** ชื่อที่แสดงในหลังบ้าน — ไม่ใส่ก็ได้ (ระบบจะใช้อีเมล) */
  readonly name?: string;
};

export function buildEnvSnippet(input: AdminEnvInput): string {
  const lines = [`ADMIN_EMAIL=${input.email}`];

  const name = input.name?.trim() ?? "";
  if (name !== "") lines.push(`ADMIN_NAME=${name}`);

  lines.push(`ADMIN_PASSWORD_HASH=${input.passwordHash}`, `SESSION_SECRET=${input.secret}`);
  return lines.join("\n");
}

/** ชื่อตัวแปร env ทั้งหมดที่ระบบล็อกอินใช้ — ใช้ตรวจ/รายงานว่า "ยังขาดอะไร" โดยไม่ต้องเปิดเผยค่า */
export const ADMIN_ENV_KEYS: readonly string[] = [
  "ADMIN_EMAIL",
  "ADMIN_NAME",
  "ADMIN_PASSWORD_HASH",
  "SESSION_SECRET",
];
