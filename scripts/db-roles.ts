import { pathToFileURL } from "node:url";

import { generatePassword } from "@/lib/auth/credentials";
import { closePool, getPool, isDatabaseConfigured } from "@/db/pool";

/**
 * `npm run db:roles` — สร้าง/รีเฟรช **DB role แบบ least privilege** (รอบที่ 169)
 *
 * เหตุผล
 * - เดิมทั้งเว็บอ่านหน้าและหลังบ้านใช้ `DATABASE_URL` ตัวเดียวที่เป็นเจ้าของตาราง
 *   ⇒ ถ้าเส้นทางสาธารณะมีช่องโหว่ที่สั่งเขียนได้ = เขียน/ลบข้อมูลจริงได้ทันที
 * - สคริปต์นี้สร้าง role สิทธิ์แคบให้หน้าเว็บใช้:
 *   · `waiwai_public_ro`   = SELECT เฉพาะตารางที่หน้าเว็บอ่าน (ไม่มีตาราง auth/PII)
 *   · `waiwai_public_form` = SELECT+INSERT เฉพาะ `form_submission`/`form_attachment` (ทางเขียนเดียวของคนนอก)
 * - แล้วเอาค่า URL ไปตั้ง `PUBLIC_DATABASE_URL` / `FORM_DATABASE_URL` (ไม่ commit)
 *
 * ⚠️ ไม่ตั้ง env ทั้งสอง = ระบบถอยไปใช้ connection เดียวกัน (ยังทำงานได้ แต่ไม่มี isolation)
 * ⚠️ รันซ้ำได้ (idempotent): revoke สิทธิ์เดิมของ role แล้ว grant ชุดที่กำหนดใหม่ทุกครั้ง
 * ⚠️ ห้ามใส่รหัสผ่านลงในโค้ด/ไฟล์ที่ commit — รับทาง flag/env หรือสุ่มให้แล้วแสดงครั้งเดียว
 *
 * วิธีใช้
 *   npm run db:roles                      # สุ่มรหัสผ่าน + แสดง URL ให้คัดลอก
 *   npm run db:roles -- --reveal          # ใช้รหัสที่ตั้งไว้ และแสดง URL เต็ม
 *   npm run db:roles -- --dry-run         # ดู SQL ที่จะรัน (ไม่แตะฐานข้อมูล)
 *   npm run db:roles -- --ro-password=... --form-password=... --reveal
 */

const READ_ROLE = "waiwai_public_ro";
const FORM_ROLE = "waiwai_public_form";

/**
 * ตารางที่ **หน้าเว็บสาธารณะอ่าน** — ต้องตรงกับ `readQuery()` ที่ใช้จริง (รอบนี้)
 * ⚠️ ตั้งใจ **ไม่รวม**: `admin_user` · `admin_session` · `audit_log` · `login_attempt` ·
 *    `form_submission` · `form_attachment` · `entity_revision` · presets → สิทธิ์ของหลังบ้านเท่านั้น
 * (มีเทสต์ `scripts/test-db-roles.ts` บังคับว่ารายการนี้ไม่หลุดตารางอ่อนไหว)
 */
export const PUBLIC_READ_TABLES: readonly string[] = [
  "page",
  "page_document",
  "media",
  "product",
  "product_category",
  "product_ingredient",
  "recipe",
  "news",
  "hero_slide",
  "campaign",
  "campaign_slide",
  /* รอบที่ 198 — ตำแหน่งการ์ดต่อหน้า (หน้าข่าวสารอ่านผ่านประตูอ่านอย่างเดียว) */
  "campaign_placement",
  "hero_setting",
];

/** ตารางที่ **ฟอร์มสาธารณะ** เขียน/อ่าน (ทางเขียนเดียวที่คนนอกแตะได้) */
export const PUBLIC_FORM_TABLES: readonly string[] = ["form_submission", "form_attachment"];

/** ตารางอ่อนไหวที่ role **อ่านของหน้าเว็บ** ต้องไม่มีสิทธิ์เด็ดขาด */
export const FORBIDDEN_FOR_PUBLIC_READ: readonly string[] = [
  "admin_user",
  "admin_session",
  "audit_log",
  "login_attempt",
  "admin_login_attempt",
  "form_submission",
  "form_attachment",
];

type Options = {
  readonly dryRun: boolean;
  readonly reveal: boolean;
  readonly roPassword: string;
  readonly formPassword: string;
  /** true = สุ่มรหัสใหม่ (ผู้เรียกต้องแสดงให้เห็น ไม่งั้นผู้ใช้เอาไปใช้ไม่ได้) */
  readonly roGenerated: boolean;
  readonly formGenerated: boolean;
};

function parseArgs(argv: readonly string[]): Options {
  let dryRun = false;
  let reveal = false;
  let roPassword = process.env["PUBLIC_DB_PASSWORD"]?.trim() ?? "";
  let formPassword = process.env["FORM_DB_PASSWORD"]?.trim() ?? "";

  for (const arg of argv) {
    if (arg === "--dry-run") dryRun = true;
    else if (arg === "--reveal") reveal = true;
    else if (arg.startsWith("--ro-password=")) roPassword = arg.slice("--ro-password=".length);
    else if (arg.startsWith("--form-password=")) formPassword = arg.slice("--form-password=".length);
  }

  const roGenerated = roPassword === "";
  const formGenerated = formPassword === "";
  return { dryRun, reveal, roPassword: roGenerated ? generatePassword() : roPassword, formPassword: formGenerated ? generatePassword() : formPassword, roGenerated, formGenerated };
}

/** URL ของ role (ใช้ host/port/db/พารามิเตอร์เดิมจาก DATABASE_URL) */
export function roleUrl(adminUrl: string, user: string, password: string): string {
  const url = new URL(adminUrl);
  url.username = user;
  url.password = password;
  return url.toString();
}

function maskUrl(url: string): string {
  const parsed = new URL(url);
  if (parsed.password !== "") parsed.password = "********";
  return parsed.toString();
}

async function roleExists(role: string): Promise<boolean> {
  const { rows } = await getPool().query<{ exists: boolean }>("select exists(select 1 from pg_roles where rolname = $1) as exists", [role]);
  return rows[0]?.exists === true;
}

async function ensureRole(role: string, password: string, dryRun: boolean): Promise<string> {
  if (dryRun) {
    return `create role ${role} login password «password» nosuperuser nocreatedb nocreaterole`;
  }

  const { rows } = await getPool().query<{ lit: string }>("select quote_literal($1) as lit", [password]);
  const passwordLiteral = rows[0]?.lit ?? "''";
  const exists = await roleExists(role);
  /* ชื่อ role เป็นค่าคงที่ในโค้ด · รหัสผ่านถูก quote ด้วย quote_literal() ⇒ ไม่มีทางกลายเป็น SQL injection */
  const statement = exists
    ? `alter role ${role} with login password ${passwordLiteral}`
    : `create role ${role} login password ${passwordLiteral} nosuperuser nocreatedb nocreaterole`;

  await getPool().query(statement);
  return statement.replace(passwordLiteral, "«password»");
}

function grantStatements(role: string, tables: readonly string[], kind: "read" | "form"): readonly string[] {
  const statements: string[] = [
    `grant usage on schema public to ${role}`,
    `revoke all privileges on all tables in schema public from ${role}`,
    `revoke all privileges on all sequences in schema public from ${role}`,
  ];

  if (kind === "read") {
    statements.push(`grant select on ${tables.join(", ")} to ${role}`);
  } else {
    statements.push(`grant select, insert on ${tables.join(", ")} to ${role}`);
  }
  return statements;
}

async function applyStatements(statements: readonly string[], dryRun: boolean): Promise<void> {
  for (const statement of statements) {
    if (dryRun) continue;
    await getPool().query(statement);
  }
}

async function grantSequenceUsage(role: string, tables: readonly string[], dryRun: boolean): Promise<readonly string[]> {
  const statements: string[] = [];
  for (const table of tables) {
    /* dry-run = ไม่แตะฐานข้อมูลเลย ⇒ ใช้ชื่อ sequence ตามธรรมเนียม Postgres (`<table>_id_seq`) */
    const seq = dryRun
      ? `public.${table}_id_seq`
      : ((await getPool().query<{ seq: string | null }>("select pg_get_serial_sequence($1, 'id') as seq", [table])).rows[0]?.seq ?? null);
    if (seq === null) continue;
    statements.push(`grant usage, select on sequence ${seq} to ${role}`);
  }
  if (!dryRun) await applyStatements(statements, false);
  return statements;
}

async function main(): Promise<void> {
  if (!isDatabaseConfigured()) {
    process.stderr.write("✗ ไม่พบ DATABASE_URL — ใส่ใน .env.local ก่อน (ต้องเป็นบัญชีเจ้าของที่สร้าง role ได้)\n");
    process.exit(1);
  }

  const adminUrl = process.env["DATABASE_URL"] ?? "";
  const options = parseArgs(process.argv.slice(2));

  const readStatements = grantStatements(READ_ROLE, PUBLIC_READ_TABLES, "read");
  const formStatements = grantStatements(FORM_ROLE, PUBLIC_FORM_TABLES, "form");

  if (options.dryRun) {
    process.stdout.write("── SQL ที่จะรัน (dry-run) ──\n");
  }

  const roleRead = await ensureRole(READ_ROLE, options.roPassword, options.dryRun);
  await applyStatements(readStatements, options.dryRun);
  const roleForm = await ensureRole(FORM_ROLE, options.formPassword, options.dryRun);
  await applyStatements(formStatements, options.dryRun);
  const seqStatements = await grantSequenceUsage(FORM_ROLE, PUBLIC_FORM_TABLES, options.dryRun);

  if (options.dryRun) {
    for (const statement of [roleRead, ...readStatements, roleForm, ...formStatements, ...seqStatements]) {
      process.stdout.write(`  ${statement};\n`);
    }
    process.stdout.write("\n(dry-run — ไม่ได้แตะฐานข้อมูล)\n");
    return;
  }

  const publicUrl = roleUrl(adminUrl, READ_ROLE, options.roPassword);
  const formUrl = roleUrl(adminUrl, FORM_ROLE, options.formPassword);

  process.stdout.write(`✓ สร้าง/รีเฟรช role เรียบร้อย\n`);
  process.stdout.write(`  · ${READ_ROLE}  → SELECT ${String(PUBLIC_READ_TABLES.length)} ตาราง: ${PUBLIC_READ_TABLES.join(", ")}\n`);
  process.stdout.write(`  · ${FORM_ROLE} → SELECT/INSERT: ${PUBLIC_FORM_TABLES.join(", ")}\n\n`);

  const mustReveal = options.reveal || options.roGenerated || options.formGenerated;
  process.stdout.write("── ตั้งค่า env (ห้าม commit) ──\n");
  if (mustReveal) {
    if (options.roGenerated || options.formGenerated) {
      process.stdout.write("⚠️ รหัสผ่านถูกสุ่มให้รอบนี้ — คัดลอกเก็บไว้เดี๋ยวนี้ (แสดงครั้งเดียว)\n");
    }
    process.stdout.write(`PUBLIC_DATABASE_URL=${publicUrl}\n`);
    process.stdout.write(`FORM_DATABASE_URL=${formUrl}\n`);
  } else {
    process.stdout.write(`PUBLIC_DATABASE_URL=${maskUrl(publicUrl)}\n`);
    process.stdout.write(`FORM_DATABASE_URL=${maskUrl(formUrl)}\n`);
    process.stdout.write("(ซ่อนรหัสผ่าน — ใส่ --reveal เพื่อแสดงเต็ม)\n");
  }
}

/* รันเฉพาะเมื่อถูกเรียกเป็นสคริปต์ — ให้เทสต์ import ค่าคงที่ได้โดยไม่รันฐานข้อมูลจริง */
const isDirectRun = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  await main();
  await closePool();
}
