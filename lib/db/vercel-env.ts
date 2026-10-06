import { directEndpointOf, hostOf, isLocalHost } from "@/lib/db/target";

/**
 * วางแผน "env ที่จะตั้งบน Vercel" (รอบที่ 116)
 *
 * บริบทจริง: เจ้าของถามว่า *"หรือจะ import .env เข้าไปดี"* — ตอบจากของจริงใน `.env.local` (9 คีย์):
 * | คีย์ | ถ้า import ทั้งไฟล์ขึ้น Vercel |
 * |---|---|
 * | `DATABASE_URL` | ❌ เป็น **localhost:55432** (Docker ในเครื่อง) ⇒ เว็บจริงไม่มีข้อมูล |
 * | `TARGET_DATABASE_URL` | ❌ เป็น URL ของ pooler (แอปใช้ไม่ได้ — `search_path` ว่าง) และไม่จำเป็นบน Vercel |
 * | `DB_TOOLS_PREFIX` | ❌ `docker exec …` ไม่มีความหมายบน Vercel |
 * | `ADMIN_EMAIL` · `ADMIN_NAME` · `ADMIN_ROLE` · `ADMIN_PASSWORD_HASH` · `SESSION_SECRET` | ⚠️ จะ **เปิดประตูหลังบ้านบนอินเทอร์เน็ต** ซึ่งขัดมติ D4 (ยังไม่มี 2FA/ทบทวนความปลอดภัย) |
 * | `MAINTENANCE_MODE` | ⚠️ ถ้าเป็น `1` จะปิดเว็บทั้งเว็บ |
 *
 * ⇒ ตั้งบน Vercel **เฉพาะคีย์ที่หน้าเว็บต้องใช้** = `DATABASE_URL` (endpoint ตรง) เท่านั้น
 *   ส่วนหลังบ้าน **ไม่ต้องใส่** ⇒ หน้า `/admin/login` จะขึ้น "ยังตั้งค่าไม่ครบ" (ปลอดภัยไว้ก่อน)
 *
 * ตรรกะทั้งหมดเป็น pure (ทดสอบได้โดยไม่ต้องมี env/ฐานข้อมูล)
 */

export type VercelEnvPlan = {
  /** บรรทัดที่ต้องวางใน Vercel (`DATABASE_URL=…`) */
  readonly line: string;
  /** ชื่อคีย์ที่ถูกใช้ */
  readonly sourceKey: string;
  /** endpoint ที่ถูกแปลง (ตัด `-pooler` แล้วหรือไม่) */
  readonly normalizedToDirect: boolean;
  /** โฮสต์ของปลายทาง (สำหรับแสดงผล ไม่มีความลับ) */
  readonly host: string;
  /** คีย์ที่ **ไม่** ใส่ พร้อมเหตุผล (ค่าไม่ถูกอ่านออกมาเลย) */
  readonly excluded: readonly { readonly key: string; readonly reason: string }[];
};

/** คีย์ที่ต้องไม่ขึ้น Vercel (พร้อมเหตุผลที่ผู้ใช้อ่านแล้วเข้าใจ) */
export const VERCEL_EXCLUDED_KEYS: readonly { readonly key: string; readonly reason: string }[] = [
  { key: "TARGET_DATABASE_URL", reason: "เป็น URL ของ pooler — แอปต้องใช้ endpoint ตรง (และไม่จำเป็นบน Vercel)" },
  { key: "DB_TOOLS_PREFIX", reason: "เป็นคำสั่งของเครื่อง dev (docker exec) — ไม่มีความหมายบน Vercel" },
  { key: "ADMIN_EMAIL", reason: "เปิดประตูหลังบ้าน — มติ D4: ยังไม่ให้ /admin ออกอินเทอร์เน็ต" },
  { key: "ADMIN_NAME", reason: "เปิดประตูหลังบ้าน — มติ D4" },
  { key: "ADMIN_ROLE", reason: "เปิดประตูหลังบ้าน — มติ D4" },
  { key: "ADMIN_PASSWORD_HASH", reason: "รหัสผ่านหลังบ้าน — ห้ามขึ้นอินเทอร์เน็ตก่อนทบทวนความปลอดภัย" },
  { key: "SESSION_SECRET", reason: "ความลับเซสชันหลังบ้าน — ไม่ต้องใช้ตอนยังไม่เปิดหลังบ้าน" },
  { key: "MAINTENANCE_MODE", reason: "ถ้าตั้ง 1 จะปิดเว็บทั้งเว็บ — ถ้าต้องการปิดปรับปรุงค่อยใส่ตอนนั้น" },
  { key: "DATABASE_URL", reason: "ค่าใน .env.local คือฐานข้อมูลในเครื่อง (localhost) — ห้ามใช้บนเว็บจริง" },
];

/**
 * สร้างบรรทัด env สำหรับ Vercel จากค่าใน env ของเครื่อง
 * รับ `env` (ชื่อคีย์ → ค่า) เพื่อให้ทดสอบได้โดยไม่ต้องมีไฟล์ .env จริง
 */
export function planVercelEnv(env: Readonly<Record<string, string | undefined>>): VercelEnvPlan {
  const raw = (env["TARGET_DATABASE_URL"] ?? "").trim();

  if (raw === "") {
    throw new Error(
      "ไม่พบ TARGET_DATABASE_URL — ใส่ connection string ของฐานข้อมูลปลายทาง (Neon) ใน .env.local ก่อน",
    );
  }

  const direct = directEndpointOf(raw);
  const host = hostOf(direct);

  if (host === null) {
    throw new Error("อ่านโฮสต์จาก TARGET_DATABASE_URL ไม่ได้ — ตรวจรูปแบบ connection string อีกครั้ง");
  }

  if (isLocalHost(host)) {
    throw new Error(`ปลายทางชี้ไปเครื่องตัวเอง (${host}) — Vercel ต้องต่อฐานข้อมูลคลาวด์เท่านั้น`);
  }

  return {
    line: `DATABASE_URL=${direct}`,
    sourceKey: "TARGET_DATABASE_URL",
    normalizedToDirect: direct !== raw,
    host,
    excluded: VERCEL_EXCLUDED_KEYS,
  };
}

/* ── หนี้ A3 (รอบที่ 142): แผน env ของ "หลังบ้าน" สำหรับ Vercel ──────────────── */

/**
 * คีย์ที่จำเป็นสำหรับให้ **หลังบ้าน** ทำงานบน Vercel
 * (ไม่รวม `ADMIN_NAME`/`ADMIN_ROLE` — มีค่าเริ่มต้นในโค้ด)
 */
export const VERCEL_ADMIN_KEYS = ["ADMIN_EMAIL", "ADMIN_PASSWORD_HASH", "SESSION_SECRET"] as const;

/** ความยาวขั้นต่ำของ `SESSION_SECRET` (ตรงกับที่แอปบังคับตอนล็อกอิน) */
export const SESSION_SECRET_MIN_LENGTH = 32;

export type VercelAdminEnvPlan = {
  /** บรรทัดที่วางใน Vercel (เรียงตาม `VERCEL_ADMIN_KEYS`) */
  readonly lines: readonly string[];
  /** คำเตือนที่ต้องอ่านก่อนวาง (มติ D4 + บทเรียนจริง) */
  readonly warnings: readonly string[];
};

/**
 * วางแผน env ของหลังบ้านสำหรับ Vercel (รอบที่ 142 · หนี้ A3)
 *
 * บริบทจริง: เจ้าของล็อกอินหลังบ้านบนเดโมไม่ได้ ⇒ ตรวจแล้วพบว่า **ค่า env บน Vercel กับในเครื่องไม่ตรงกัน**
 * (ระบบล็อกอินไม่ได้พัง — ยิงฟอร์มจริงแล้ว action ทำงาน + เขียน audit ปกติ แต่ hash ไม่ตรงกับรหัสที่ใช้)
 *
 * ⇒ ตัวนี้ช่วย **สร้างบล็อกที่ถูกต้อง** จากค่าจริงใน `.env.local` พร้อม **ด่านกันพลาด 2 ข้อที่เคยเกิดจริง**
 *   1. **ค่าห้ามมี `$`** — `@next/env` (dotenv-expand) จะตีความเป็นชื่อตัวแปรแล้ว **ตัดค่าทิ้ง**
 *      (เคสจริงรอบที่ 27: hash แบบเดิมทำให้ "รหัสถูกแต่ล็อกอินไม่ได้")
 *   2. **`SESSION_SECRET` ต้องยาว ≥ 32** ไม่งั้นแอปจะปฏิเสธการล็อกอิน
 *
 * ⚠️ **มติ D4:** การใส่คีย์ชุดนี้ = เปิด `/admin` สู่อินเทอร์เน็ต (ยังไม่มี 2FA/ทบทวนความปลอดภัยรอบสุดท้าย)
 *    ⇒ ใช้เมื่อต้องสาธิตหลังบ้านเท่านั้น และควรหมุนรหัสก่อนเปิดใช้จริง
 */
export function planVercelAdminEnv(env: Readonly<Record<string, string | undefined>>): VercelAdminEnvPlan {
  const email = (env["ADMIN_EMAIL"] ?? "").trim();
  const hash = (env["ADMIN_PASSWORD_HASH"] ?? "").trim();
  const secret = (env["SESSION_SECRET"] ?? "").trim();

  if (email === "") {
    throw new Error("ไม่พบ ADMIN_EMAIL — ตั้งอีเมลผู้ดูแลใน .env.local ก่อน (npm run admin:create --write-env)");
  }
  if (hash === "") {
    throw new Error("ไม่พบ ADMIN_PASSWORD_HASH — สร้างด้วย npm run admin:create -- --email=… --password=… --write-env");
  }
  if (!hash.startsWith("scrypt:")) {
    throw new Error("ADMIN_PASSWORD_HASH ต้องอยู่ในรูปแบบ scrypt:N:r:p:<salt>:<hash> (รูปแบบอื่นแอปจะปฏิเสธ)");
  }
  if (hash.includes("$")) {
    throw new Error("ADMIN_PASSWORD_HASH มีอักขระ $ — Vercel/dotenv-expand จะตัดค่าทิ้ง ⇒ ล็อกอินไม่ได้ (เคสจริงรอบที่ 27)");
  }
  if (secret.length < SESSION_SECRET_MIN_LENGTH) {
    throw new Error(`SESSION_SECRET สั้นเกินไป (${String(secret.length)} ตัวอักษร — ต้อง ≥ ${String(SESSION_SECRET_MIN_LENGTH)})`);
  }
  if (secret.includes("$")) {
    throw new Error("SESSION_SECRET มีอักขระ $ — dotenv-expand จะตัดค่าทิ้ง (เคสจริงรอบที่ 27)");
  }

  return {
    lines: [`ADMIN_EMAIL=${email}`, `ADMIN_PASSWORD_HASH=${hash}`, `SESSION_SECRET=${secret}`],
    warnings: [
      "⚠️ มติ D4: คีย์ชุดนี้ = เปิดหลังบ้านสู่อินเทอร์เน็ต — ใส่เมื่อต้องสาธิตเท่านั้น (ยังไม่มี 2FA)",
      "หลังแก้ env ต้อง Redeploy ใหม่เสมอ (env ใหม่ไม่มีผลกับ deployment เดิม)",
      "อย่าใช้รหัสผ่านที่เคยหลุด/ส่งในแชท — หมุนใหม่ก่อนเปิดใช้จริง",
      "ADMIN_NAME/ADMIN_ROLE ไม่จำเป็น (มีค่าเริ่มต้นในโค้ด)",
    ],
  };
}
