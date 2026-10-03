/**
 * `npm run db:seed`
 *
 * เขียนเนื้อหา **หน้าแรก** (seed จากพจนานุกรมเดิม) ลงฐานข้อมูล Postgres
 *
 * ลำดับการใช้งาน (ครั้งแรก)
 *   1. สร้างฐานข้อมูล (Neon) แล้วเอา connection string ใส่ `.env.local` เป็น `DATABASE_URL=...`
 *      ⚠️ ห้าม commit ไฟล์นี้ · ห้ามส่งค่า connection string ในแชท/เอกสาร (ใส่ env เท่านั้น)
 *   2. `psql "$DATABASE_URL" -f db/schema.sql`  — สร้างตาราง
 *   3. `npm run db:seed`                        — เขียนเนื้อหาหน้าแรก (รันซ้ำได้ ไม่สร้างข้อมูลซ้ำ)
 *
 * หมายเหตุ: สคริปต์นี้เป็น "ตัวรัน" ล้วน — ตรรกะทั้งหมดอยู่ใน lib/content/ (ทดสอบได้โดยไม่ต้องมี DB)
 * และจะ **ไม่เขียนอะไรลง DB ถ้าเนื้อหาไม่ผ่าน validator** (กันข้อมูลพังไหลเข้าไปแล้วต้องมานั่งลบ)
 */
import pg from "pg";

import { HOME_PAGE_SPEC } from "@/lib/content/model";
import { HOME_SEED } from "@/lib/content/home-seed";
import { SEED_ACTOR, buildUpsertStatements, countRows } from "@/lib/content/sql";
import { errorsOf, validateContent } from "@/lib/content/validate";

const ENV_NAME = "DATABASE_URL";

async function main(): Promise<void> {
  const connectionString = process.env[ENV_NAME];

  if (connectionString === undefined || connectionString.trim() === "") {
    process.stderr.write(
      `✗ ไม่พบ ${ENV_NAME}\n\n` +
        "  ใส่ค่าในไฟล์ .env.local (ไม่ commit) แล้วรันใหม่ — ตัวอย่าง:\n" +
        `    ${ENV_NAME}=postgresql://...\n\n` +
        "  หรือส่งผ่าน env ตรง ๆ:  DATABASE_URL=... npm run db:seed\n" +
        "  ⚠️ ห้ามเดาค่า และห้ามวางค่าไว้ในเอกสาร/แชท\n\n",
    );
    process.exit(1);
  }

  const issues = errorsOf(validateContent(HOME_PAGE_SPEC, HOME_SEED));
  if (issues.length > 0) {
    process.stderr.write(`✗ เนื้อหาไม่ผ่าน validator (${issues.length} error) — ยังไม่เขียนลงฐานข้อมูล\n`);
    for (const issue of issues) {
      process.stderr.write(`    [${issue.code}] ${issue.path}\n`);
    }
    process.exit(1);
  }

  const statements = buildUpsertStatements(HOME_PAGE_SPEC, HOME_SEED, SEED_ACTOR);
  const client = new pg.Client({ connectionString });

  await client.connect();

  try {
    await client.query("begin");
    for (const statement of statements) {
      await client.query(statement.text, [...statement.values]);
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    await client.end();
    process.stderr.write("✗ seed ล้มเหลว — ยกเลิกทั้งชุดแล้ว (rollback) ฐานข้อมูลไม่ถูกแก้\n");
    throw error;
  }

  const { rows } = await client.query<{ count: string }>("select count(*)::text as count from content_field where page = $1", [
    HOME_PAGE_SPEC.page,
  ]);
  await client.end();

  process.stdout.write(
    `✓ seed หน้า ${HOME_PAGE_SPEC.page} แล้ว: ${countRows(statements)} แถวจาก ${statements.length} คำสั่ง ` +
      `· ในตารางมี ${rows[0]?.count ?? "?"} แถวของหน้านี้\n`,
  );
}

await main();
