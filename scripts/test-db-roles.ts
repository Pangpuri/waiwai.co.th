import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { databaseRoleStatus, resolveRoleUrl } from "@/db/pool";
import { FORBIDDEN_FOR_PUBLIC_READ, PUBLIC_FORM_TABLES, PUBLIC_READ_TABLES, roleUrl } from "./db-roles.ts";

/**
 * เทสต์ "least privilege" ของการเชื่อมต่อฐานข้อมูล (รอบที่ 169)
 *
 * ทำไมต้องมี
 * - ความปลอดภัยชั้นนี้อยู่ที่ "เส้นทางไหนใช้ connection ไหน" — พลาดจุดเดียวก็กลับไปใช้ credential เจ้าของตาราง
 * - เป็นเทสต์ที่ **ไม่ต้องมี DB**: ตรวจตรรกะเลือก URL + สแกนซอร์สว่าฟังก์ชันสาธารณะใช้ประตูอ่าน
 * - การพิสูจน์สิทธิ์จริง (42501) อยู่ที่ `check:db` วงจร 32 (ต้องมี DB + role)
 */

const root = join(import.meta.dirname, "..");
/* ⚠️ normalize CRLF → LF: ไฟล์ในโปรเจกต์มีทั้งสองแบบ (Windows checkout) ⇒ สแกนแบบเดียวให้ผลคงที่ */
const read = (...parts: readonly string[]): string => readFileSync(join(root, ...parts), "utf8").replace(/\r\n/g, "\n");

/** ดึงเนื้อฟังก์ชัน `export async function <name>` (จบที่ `}` ระดับคอลัมน์ 0) */
function functionBody(source: string, name: string): string {
  const start = source.indexOf(`export async function ${name}(`);
  assert.ok(start >= 0, `ไม่พบฟังก์ชัน ${name}`);
  /* ใช้ "\n}\n" (ไม่ใช่ "\n}") เพราะฟังก์ชันที่มี object type ในพารามิเตอร์มี `}` ระดับคอลัมน์ 0 ได้ */
  const end = source.indexOf("\n}\n", start);
  assert.ok(end > start, `ไม่พบจุดจบของ ${name}`);
  return source.slice(start, end);
}

/* ── ตรรกะเลือก URL ต่อบทบาท ─────────────────────────────────────────────── */

test("db-roles: `read` ใช้ PUBLIC_DATABASE_URL เมื่อตั้งไว้ · ไม่ตั้ง = ถอยไปใช้ DATABASE_URL", () => {
  assert.deepEqual(resolveRoleUrl("read", { DATABASE_URL: "postgres://admin", PUBLIC_DATABASE_URL: "postgres://ro" }), {
    url: "postgres://ro",
    isolated: true,
  });
  assert.deepEqual(resolveRoleUrl("read", { DATABASE_URL: "postgres://admin" }), { url: "postgres://admin", isolated: false });
  /* ช่องว่างล้วน = ถือว่าไม่ได้ตั้ง (ไม่ปล่อยให้ URL ขยะหลุดไปสร้าง pool) */
  assert.deepEqual(resolveRoleUrl("read", { DATABASE_URL: "postgres://admin", PUBLIC_DATABASE_URL: "   " }), {
    url: "postgres://admin",
    isolated: false,
  });
});

test("db-roles: `form` แยกจาก `read` ได้ · `write` ใช้ DATABASE_URL เสมอ", () => {
  assert.deepEqual(resolveRoleUrl("form", { DATABASE_URL: "postgres://admin", FORM_DATABASE_URL: "  postgres://form  " }), {
    url: "postgres://form",
    isolated: true,
  });
  assert.deepEqual(resolveRoleUrl("form", { DATABASE_URL: "postgres://admin" }), { url: "postgres://admin", isolated: false });
  assert.deepEqual(resolveRoleUrl("write", { DATABASE_URL: "postgres://admin", PUBLIC_DATABASE_URL: "postgres://ro" }), {
    url: "postgres://admin",
    isolated: false,
  });
});

test("db-roles: ไม่มี URL เลย = null (ผู้เรียก fail-closed) · databaseRoleStatus รายงานได้", () => {
  assert.equal(resolveRoleUrl("read", {}), null);
  assert.equal(resolveRoleUrl("write", { PUBLIC_DATABASE_URL: "postgres://ro" }), null);

  const status = databaseRoleStatus({ DATABASE_URL: "postgres://admin", PUBLIC_DATABASE_URL: "postgres://ro" });
  assert.equal(status.read?.isolated, true);
  assert.equal(status.form?.isolated, false, "ไม่ได้ตั้ง FORM_DATABASE_URL ⇒ ยังไม่ isolated");
});

test("db-roles: สร้าง URL ของ role โดยคง host/พารามิเตอร์เดิม และ encode รหัสผ่าน", () => {
  const url = roleUrl("postgres://owner:pw@db.example:5432/waiwai?sslmode=require", "waiwai_public_ro", "p@ss word");
  const parsed = new URL(url);
  assert.equal(parsed.username, "waiwai_public_ro");
  assert.equal(parsed.password, "p%40ss%20word");
  assert.equal(parsed.host, "db.example:5432");
  assert.equal(parsed.pathname, "/waiwai");
  assert.equal(parsed.searchParams.get("sslmode"), "require");
});

/* ── รายการตาราง: ห้าม role สาธารณะแตะของอ่อนไหว ─────────────────────────── */

test("db-roles: role อ่านต้องไม่มีตารางอ่อนไหว และ role ฟอร์มจำกัดเฉพาะตารางฟอร์ม", () => {
  const leaked = PUBLIC_READ_TABLES.filter((table) => FORBIDDEN_FOR_PUBLIC_READ.includes(table));
  assert.deepEqual(leaked, [], "role อ่านของหน้าเว็บต้องไม่มีตาราง auth/PII/ฟอร์ม");

  assert.deepEqual([...PUBLIC_FORM_TABLES].sort(), ["form_attachment", "form_submission"]);
  assert.ok(PUBLIC_READ_TABLES.includes("page_document"), "หน้าเว็บต้องอ่าน page_document ได้ (ฉบับเผยแพร่)");
  assert.ok(PUBLIC_READ_TABLES.includes("media"), "หน้าเว็บต้องอ่าน media ได้ (เสิร์ฟภาพ)");
});

/* ── สแกนซอร์ส: ฟังก์ชันสาธารณะต้องใช้ประตูอ่าน ───────────────────────────── */

test("db-roles: ฟังก์ชันที่หน้าเว็บสาธารณะใช้ ต้องอ่านผ่าน `readQuery` (ไม่ใช่ getPool)", () => {
  const cases: readonly (readonly [string, readonly string[]])[] = [
    ["lib/blocks/repository.ts", ["loadDocumentRow", "isPageLive"]],
    ["lib/products/repository.ts", ["loadProductCategory", "listProductsByCategory", "countProductsByCategory", "listProductCategoryCards", "listProductHighlights"]],
    ["lib/recipes/repository.ts", ["listRecipes"]],
    ["lib/news/repository.ts", ["countNews", "listNews", "loadNewsBySourceId", "listNewsSourceIds"]],
    ["lib/media/repository.ts", ["loadMediaSizes", "getMediaBinary"]],
    ["lib/pages/repository.ts", ["listPages", "findPage"]],
  ];

  for (const [file, names] of cases) {
    const source = read(...file.split("/"));
    for (const name of names) {
      const body = functionBody(source, name);
      assert.ok(body.includes("readQuery"), `${file} → ${name} ต้องอ่านผ่าน readQuery()`);
      assert.ok(!body.includes("getPool()"), `${file} → ${name} ห้ามใช้ getPool() (pool เขียนของหลังบ้าน)`);
    }
  }
});

test("db-roles: ฟอร์มสาธารณะต้องใช้ `formQuery` (สิทธิ์แคบ) — ส่วนหลังบ้านยังใช้ getPool", () => {
  const source = read("lib", "forms", "repository.ts");

  for (const name of ["insertSubmission", "recentSubmissionTimes", "insertAttachment"]) {
    const body = functionBody(source, name);
    assert.ok(body.includes("formQuery"), `forms → ${name} ต้องใช้ formQuery()`);
    assert.ok(!body.includes("getPool()"), `forms → ${name} ห้ามใช้ getPool()`);
  }

  /* รายการหลังบ้าน (PII) ต้องยังเป็น getPool — ไม่ย้ายมาประตูสาธารณะ */
  const adminBody = functionBody(source, "listSubmissions");
  assert.ok(adminBody.includes("getPool()"), "listSubmissions (หลังบ้าน) ต้องยังใช้ getPool()");
});

test("db-roles: ประตูอ่านต้องเลือก pool จาก getReadPool/getFormPool เท่านั้น", () => {
  const source = read("lib", "db", "read.ts");
  assert.ok(source.includes("getReadPool()"), "readQuery ต้องใช้ getReadPool()");
  assert.ok(source.includes("getFormPool()"), "formQuery ต้องใช้ getFormPool()");
  assert.ok(!source.includes("getPool().query"), "ประตูอ่านห้ามเรียก getPool() ตรง ๆ");
  assert.ok(!source.includes("import { getPool"), "ประตูอ่านห้าม import pool เขียนของหลังบ้าน");
});

test("db-roles: เส้นทางสาธารณะต้องไม่แตะ pool เขียน (`getPool`) ตรง ๆ", () => {
  for (const file of ["app/[lang]/layout.tsx", "app/[lang]/page.tsx", "app/media/[id]/route.ts", "app/sitemap.ts"]) {
    const source = read(...file.split("/"));
    assert.ok(!source.includes("getPool"), `${file} ห้าม import getPool() — ต้องผ่าน repository ที่ใช้ readQuery()`);
  }
});
