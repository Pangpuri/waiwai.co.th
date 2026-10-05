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
