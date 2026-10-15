import { NextResponse } from "next/server";

import { getFormPool, getPool, getReadPool, resolveRoleUrl } from "@/db/pool";
import { ENV_ADMIN_ID } from "@/lib/auth/user-store";
import { hintOf, isHealthKeyValid, safeErrorMessage, verdictOf, type AdminHealth } from "@/lib/ops/health";

/**
 * **`GET /healthz?key=…`** — ตัวตรวจสุขภาพระบบ (รอบที่ 289)
 *
 * ตอบคำถามที่ทำให้เสียเวลาหลายชั่วโมงในรอบก่อน ๆ ให้จบในคำขอเดียว:
 *   · แอปที่รันอยู่ **ตั้ง `DATABASE_URL` แล้วหรือยัง** และต่อได้จริงไหม
 *   · role ที่ใช้ชื่ออะไร (เจ้าของ? role อ่าน?) และ **อ่าน/เขียนตารางหลังบ้านได้ไหม**
 *   · role อ่าน/role ฟอร์ม ถูกตั้งแยก (least privilege) หรือยัง
 *   · migration ล่าสุดที่ฐานข้อมูลปลายทางมีเท่าไร (เทียบกับ `npm run check:target`)
 *   · commit ที่ deploy อยู่ (จาก `VERCEL_GIT_COMMIT_SHA` ของ Vercel)
 *
 * ## ความปลอดภัย (สำคัญ)
 * - ต้องมี env **`HEALTH_KEY`** — ไม่ตั้ง = ตอบ **404** (เหมือนไม่มี endpoint นี้)
 * - คีย์ผิด = **404** เหมือนกัน (ไม่บอกใบ้ว่ามี endpoint) · เทียบด้วย `timingSafeEqual`
 * - ตอบแค่ข้อเท็จจริงเชิงปฏิบัติการ — **ไม่มีรหัสผ่าน/connection string/hash/อีเมล/เนื้อหาข้อมูล**
 * - `no-store` + `noindex` + `force-dynamic` (ห้ามถูกแคชเป็น static)
 *
 * ⚠️ ห้ามใส่การอ่าน DB ที่หนัก/เขียนข้อมูลในไฟล์นี้ — เป็น endpoint อ่านเท่านั้น
 */
export const dynamic = "force-dynamic";

const NOT_FOUND = new NextResponse(null, { status: 404 });

/** อ่านบทบาท + สิทธิ์ของ pool หนึ่ง ๆ (ไม่เขียนอะไรเลย) */
async function probeAdminPool(): Promise<AdminHealth> {
  const configured = resolveRoleUrl("write", process.env) !== null;
  if (!configured) {
    return {
      configured: false,
      reachable: false,
      role: null,
      database: null,
      canReadAdminUser: false,
      canWriteAdminSession: false,
      envAdminRow: false,
      migrations: null,
      error: null,
    };
  }

  try {
    const identity = await getPool().query<{ role: string; db: string }>(
      "select current_user as role, current_database() as db",
    );
    const row = identity.rows[0];
    const role = row?.role ?? null;
    const database = row?.db ?? null;

    /*
      ⚠️ ใช้ `has_table_privilege` (catalog) ไม่ใช่การยิงคำสั่งจริง:
      ⇒ endpoint นี้ **ไม่เขียน** อะไรลงฐานข้อมูลแม้แต่ไบต์เดียว
    */
    const privileges = await getPool().query<{ can_read: boolean; can_write: boolean }>(
      `select has_table_privilege(current_user, 'admin_user', 'SELECT') as can_read,
              has_table_privilege(current_user, 'admin_session', 'INSERT') as can_write`,
    );
    const privilegeRow = privileges.rows[0];

    /* แถวบัญชีโหมด env (กับดัก FK รอบ 124/144) + จำนวน migration ที่ปลายทางมี */
    const envRow = await getPool().query<{ present: boolean }>(
      `select exists(select 1 from admin_user where id = $1) as present`,
      [ENV_ADMIN_ID],
    );
    const migrations = await getPool().query<{ count: number }>(
      "select count(*)::int as count from schema_migration",
    );

    return {
      configured: true,
      reachable: true,
      role,
      database,
      canReadAdminUser: privilegeRow?.can_read === true,
      canWriteAdminSession: privilegeRow?.can_write === true,
      envAdminRow: envRow.rows[0]?.present === true,
      migrations: migrations.rows[0]?.count ?? null,
      error: null,
    };
  } catch (error) {
    return {
      configured: true,
      reachable: false,
      role: null,
      database: null,
      canReadAdminUser: false,
      canWriteAdminSession: false,
      envAdminRow: false,
      migrations: null,
      error: safeErrorMessage(error),
    };
  }
}

/** อ่านบทบาทของ pool อ่าน/ฟอร์ม (บอกแค่ว่าตั้งแยกไว้จริงไหม + role คือใคร) */
async function probeSecondaryPool(role: "read" | "form"): Promise<{
  readonly dedicated: boolean;
  readonly role: string | null;
  readonly error: string | null;
}> {
  const resolved = resolveRoleUrl(role, process.env);
  if (resolved === null) return { dedicated: false, role: null, error: null };

  try {
    const pool = role === "read" ? getReadPool() : getFormPool();
    const identity = await pool.query<{ role: string }>("select current_user as role");
    return { dedicated: resolved.isolated, role: identity.rows[0]?.role ?? null, error: null };
  } catch (error) {
    return { dedicated: resolved.isolated, role: null, error: safeErrorMessage(error) };
  }
}

function shortCommit(): string | null {
  const sha = (process.env.VERCEL_GIT_COMMIT_SHA ?? "").trim();
  return sha === "" ? null : sha.slice(0, 7);
}

export async function GET(request: Request): Promise<NextResponse> {
  const key = new URL(request.url).searchParams.get("key");
  if (!isHealthKeyValid(key, process.env.HEALTH_KEY)) return NOT_FOUND;

  const admin = await probeAdminPool();
  const read = await probeSecondaryPool("read");
  const form = await probeSecondaryPool("form");
  const verdict = verdictOf(admin);

  return NextResponse.json(
    {
      ok: verdict === "ok",
      commit: shortCommit(),
      verdict,
      hint: hintOf(verdict),
      admin,
      read,
      form,
    },
    {
      status: 200,
      headers: {
        "cache-control": "no-store, max-age=0",
        "x-robots-tag": "noindex, nofollow",
      },
    },
  );
}
