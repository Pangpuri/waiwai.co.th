import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { ScryptOptions } from "node:crypto";

/**
 * การเก็บรหัสผ่านผู้ดูแล — ใช้ **scrypt ของ Node เอง** ไม่เพิ่ม dependency
 *
 * ทำไม scrypt (และทำไมไม่ใช้ sha256 ตรง ๆ)
 * - กติกาโปรเจกต์: *NEVER store a plaintext or reversibly encrypted password; MUST use the slow hash*
 * - `node:crypto.scrypt` เป็น **KDF ที่ช้าและกินหน่วยความจำ** (memory-hard) ซึ่งเป็นคุณสมบัติที่ต้องการ
 *   — ต่างจาก sha256/md5 ที่คำนวณเร็วจนเดารหัสได้เป็นพันล้านครั้งต่อวินาที · **ไม่ใช่ "general-purpose digest"**
 * - แลกกับ: ถ้าอนาคตอยากใช้ argon2/bcrypt (ต้องเพิ่ม dependency) ให้ดู `needsRehash()` —
 *   รูปแบบที่เก็บมี "ชื่ออัลกอริทึม + พารามิเตอร์" นำหน้า จึงอัปเกรดทีหลังได้โดยไม่ต้องย้ายข้อมูลทีเดียว
 *
 * รูปแบบที่เก็บ (สตริงเดียว ใส่ใน env/DB ได้):
 *   scrypt:N:r:p:<salt base64>:<hash base64>
 *
 * ⚠️ **ทำไมใช้ `:` ไม่ใช้ `$` (บทเรียนที่เจอจริง 2026-10-02)**
 * ค่าใน `.env` ถูกตีความโดย dotenv-expand ของ Next — เครื่องหมาย `$` ถือเป็น "ชื่อตัวแปร"
 * ค่าที่เขียนว่า `scrypt$32768$8$1$...` จึงถูกตัดเหลือ `scrypt+Bikum…` (ยาว 104 แทน 130)
 * ⇒ **ผู้ใช้ล็อกอินไม่ได้เลย แม้ใส่รหัสถูก** และอาการดูเหมือน "รหัสผิด" ทั้งที่ค่าที่เขียนถูกต้อง
 * · `:` ปลอดภัยกับ `.env` · Docker `--env-file` · docker-compose · shell — จึงเป็นตัวคั่นที่ใช้จริง
 * · `parsePasswordHash()` ยัง **อ่านรูปแบบเดิม (`$`) ได้** เพื่อไม่ทิ้งค่าที่อาจตั้งไว้แล้วที่อื่น
 */

const ALGORITHM = "scrypt";
const DEFAULT_PARAMS = { N: 32768, r: 8, p: 1 } as const;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
/** scrypt ต้องการหน่วยความจำ ≈ 128·N·r ไบต์ → 32 MiB ที่ค่าตั้งต้น (ยอมรับได้สำหรับ login) */
const MAX_MEMORY = 64 * 1024 * 1024;

export type ScryptParams = { readonly N: number; readonly r: number; readonly p: number };

/** ตัวคั่นที่ปลอดภัยกับ `.env`/shell/Docker (ห้ามใช้ `$`) */
const SEPARATOR = ":";
/** ตัวคั่นรูปแบบเดิม — ยังต้องอ่านได้ แต่ห้ามเขียนใหม่ */
const LEGACY_SEPARATOR = "$";
const PART_COUNT = 6;

function derive(password: string, salt: Buffer, keyLength: number, params: ScryptParams): Promise<Buffer> {
  const options: ScryptOptions = { N: params.N, r: params.r, p: params.p, maxmem: MAX_MEMORY };
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(derivedKey);
    });
  });
}

function encode(buffer: Buffer): string {
  return buffer.toString("base64");
}

/** สร้างค่าที่ใช้เก็บ (เรียกตอนสร้างบัญชี/เปลี่ยนรหัส) */
export async function hashPassword(password: string, params: ScryptParams = DEFAULT_PARAMS): Promise<string> {
  if (password.length === 0) {
    throw new Error("password must not be empty");
  }
  const salt = randomBytes(SALT_LENGTH);
  const derived = await derive(password, salt, KEY_LENGTH, params);
  return [ALGORITHM, params.N, params.r, params.p, encode(salt), encode(derived)].join(SEPARATOR);
}

type ParsedHash = { readonly params: ScryptParams; readonly salt: Buffer; readonly hash: Buffer };

/** แยกส่วนของค่าที่เก็บ — รับทั้งรูปแบบใหม่ (`:`) และแบบเดิม (`$`) */
function parseParts(stored: string): readonly string[] | null {
  const value = stored.trim();
  if (value === "") return null;

  const modern = value.split(SEPARATOR);
  if (modern.length === PART_COUNT) return modern;

  const legacy = value.split(LEGACY_SEPARATOR);
  if (legacy.length === PART_COUNT) return legacy;

  return null;
}

/** ค่าที่เก็บ "ใช้งานได้จริง" หรือไม่ — ใช้ตอนตรวจว่า env ตั้งครบ (จะได้ไม่ล็อกอินค้างแบบเงียบ ๆ) */
export function isPasswordHashUsable(stored: string | undefined): boolean {
  if (typeof stored !== "string") return false;
  return parseParts(stored) !== null;
}

/** อ่านค่าที่เก็บ — คืน null ถ้ารูปแบบไม่ถูกต้อง (ไม่โยน exception: ข้อมูลพังต้องไม่ทำให้เซิร์ฟเวอร์ล้ม) */
export function parsePasswordHash(stored: string): ParsedHash | null {
  const parts = parseParts(stored);
  if (parts === null) return null;

  const [algorithm, rawN, rawR, rawP, salt, hash] = parts;
  if (algorithm !== ALGORITHM || rawN === undefined || rawR === undefined || rawP === undefined) return null;
  if (salt === undefined || hash === undefined) return null;

  const N = Number.parseInt(rawN, 10);
  const r = Number.parseInt(rawR, 10);
  const p = Number.parseInt(rawP, 10);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p) || N < 2 || r < 1 || p < 1) return null;

  const saltBuffer = Buffer.from(salt, "base64");
  const hashBuffer = Buffer.from(hash, "base64");
  if (saltBuffer.length === 0 || hashBuffer.length === 0) return null;

  return { params: { N, r, p }, salt: saltBuffer, hash: hashBuffer };
}

/**
 * ตรวจรหัสผ่าน — เทียบแบบ **constant time** (timingSafeEqual) เพื่อไม่ให้วัดเวลาการเดาได้
 * คืน false ทุกกรณีที่ผิด (รูปแบบพัง/รหัสผิด/ค่าว่าง) — ไม่บอกผู้โจมตีว่าเสียตรงไหน
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (password.length === 0) return false;

  const parsed = parsePasswordHash(stored);
  if (parsed === null) return false;

  const derived = await derive(password, parsed.salt, parsed.hash.length, parsed.params);
  if (derived.length !== parsed.hash.length) return false;
  return timingSafeEqual(derived, parsed.hash);
}

/** true = ค่าที่เก็บใช้พารามิเตอร์เก่ากว่าปัจจุบัน → ควรเปลี่ยนรหัสใหม่เมื่อผู้ใช้ล็อกอินสำเร็จถัดไป */
export function needsRehash(stored: string, params: ScryptParams = DEFAULT_PARAMS): boolean {
  const parsed = parsePasswordHash(stored);
  if (parsed === null) return true;
  return parsed.params.N !== params.N || parsed.params.r !== params.r || parsed.params.p !== params.p;
}

/** พารามิเตอร์ที่ใช้อยู่ — ใช้ในเอกสาร/สคริปต์เพื่อให้รู้ว่ากำลังใช้ความแรงเท่าไร */
export const PASSWORD_HASH_PARAMS: ScryptParams = DEFAULT_PARAMS;
