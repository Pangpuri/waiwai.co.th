import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { databaseRoleStatus, isRoleAuthFailure, resolveRoleUrl, roleCredentialHint } from "@/db/pool";
import { runWithRoleRetry } from "@/lib/db/read";
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

/**
 * ★ รอบที่ 196 — เคสจริงจากเจ้าของ: `npm run db:roles` เปลี่ยนรหัสผ่านของ role **ขณะที่ dev ยังรันอยู่**
 * แล้วอัปเดต `.env.local` ⇒ Next รีโหลด env ให้ แต่ **pool เก่าบน `globalThis` ยังใช้รหัสเดิม** ⇒ ทุกหน้า 500
 * ด้วย `28P01` (หน้าเว็บสาธารณะเงียบเป็นข้อมูลตัวอย่าง)
 *
 * ที่นี่พิสูจน์ "นโยบายกู้ตัวเอง" ด้วยตรรกะล้วน (ไม่ต้องมี DB):
 *  1. สำเร็จปกติ = ไม่แตะ pool
 *  2. credential เก่า → ทิ้ง pool → ลองใหม่สำเร็จ (หายเองโดยไม่ต้องรีสตาร์ต)
 *  3. ล้มซ้ำ = เตือน 1 ครั้ง + โยน error **ที่บอกทางแก้** (ไม่ปล่อย error ดิบของ pg)
 *  4. error อื่น (ไม่ใช่ credential) = ไม่ลองใหม่ ไม่กลืน
 */
test("db-roles: credential เปลี่ยนกลางคัน — ทิ้ง pool แล้วลองใหม่ 1 ครั้ง + บอกทางแก้ (รอบที่ 196)", async () => {
  const authError = Object.assign(new Error('password authentication failed for user "waiwai_public_ro"'), { code: "28P01" });

  /* ตัวจำแนก error: เฉพาะรหัส credential จริง */
  assert.equal(isRoleAuthFailure(authError), true);
  assert.equal(isRoleAuthFailure(Object.assign(new Error("no permission"), { code: "42501" })), false, "สิทธิ์ไม่พอ ≠ credential ผิด");
  assert.equal(isRoleAuthFailure(new Error("boom")), false);
  assert.equal(isRoleAuthFailure(null), false);
  assert.equal(isRoleAuthFailure("28P01"), false, "สตริงเปล่า ๆ ไม่นับ");
  assert.equal(isRoleAuthFailure(Object.assign(new Error("role ไม่มี"), { code: "28000" })), true);

  /* ข้อความบอกทางแก้ต้องมีทั้ง env key และคำสั่งที่ต้องรัน */
  for (const [role, envKey] of [["read", "PUBLIC_DATABASE_URL"], ["form", "FORM_DATABASE_URL"], ["write", "DATABASE_URL"]] as const) {
    const hint = roleCredentialHint(role);
    assert.ok(hint.includes(envKey), `${role}: ต้องบอก ${envKey}`);
    assert.ok(hint.includes("db:roles") && hint.includes(".env.local"), `${role}: ต้องบอกคำสั่งที่ต้องรัน`);
    assert.ok(hint.includes("dev:clean"), `${role}: ต้องบอกทางออกสุดท้าย (รีสตาร์ต dev)`);
  }

  /* 1) สำเร็จตั้งแต่ครั้งแรก = ไม่แตะ pool เลย */
  let calls = 0;
  let resets = 0;
  const ok = await runWithRoleRetry({ role: "read", query: async () => { calls += 1; return "ok"; }, reset: () => { resets += 1; } });
  assert.equal(ok, "ok");
  assert.deepEqual([calls, resets], [1, 0], "เคสปกติต้องไม่สร้าง pool ใหม่");

  /* 2) รหัสเก่า → ทิ้ง pool → ลองใหม่สำเร็จ (เคสจริงของเจ้าของ) */
  calls = 0;
  resets = 0;
  const healed = await runWithRoleRetry({
    role: "read",
    query: async () => {
      calls += 1;
      if (calls === 1) throw authError;
      return "fresh";
    },
    reset: () => { resets += 1; },
  });
  assert.equal(healed, "fresh", "ต้องกู้ตัวเองได้หลังทิ้ง pool");
  assert.deepEqual([calls, resets], [2, 1], "ลองใหม่ 1 ครั้ง และทิ้ง pool 1 ครั้ง");

  /* 3) ล้มซ้ำ = เตือน 1 ครั้ง + error ที่บอกทางแก้ (ไม่ใช่ error ดิบของ pg) */
  calls = 0;
  resets = 0;
  const warned: string[] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => { warned.push(args.map((value) => String(value)).join(" ")); };
  try {
    await assert.rejects(
      () => runWithRoleRetry({ role: "read", query: async () => { calls += 1; throw authError; }, reset: () => { resets += 1; } }),
      (error: unknown) =>
        error instanceof Error &&
        error.message.includes("PUBLIC_DATABASE_URL") &&
        error.message.includes("db:roles") &&
        !error.message.includes("password authentication failed"),
    );
  } finally {
    console.warn = originalWarn;
  }
  assert.deepEqual([calls, resets], [2, 1], "ลองใหม่แค่ครั้งเดียว (ไม่วน)");
  assert.equal(warned.length, 1, "ต้องเตือนผู้ดูแล 1 ครั้ง");
  assert.ok(warned[0]?.includes("PUBLIC_DATABASE_URL"), "ข้อความเตือนต้องบอก env ที่ต้องแก้");

  /* 4) error อื่น = ไม่ลองใหม่ ไม่กลืน */
  calls = 0;
  resets = 0;
  await assert.rejects(
    () => runWithRoleRetry({ role: "read", query: async () => { calls += 1; throw Object.assign(new Error("relation does not exist"), { code: "42P01" }); }, reset: () => { resets += 1; } }),
    /relation does not exist/,
  );
  assert.deepEqual([calls, resets], [1, 0], "error ที่ไม่ใช่ credential ต้องโยนกลับทันที");

  /* 5) ประตูทั้งสองต้องผ่านเส้นทางนี้ (ไม่เรียก pool ตรง ๆ อีก) */
  const gate = read("lib", "db", "read.ts");
  assert.ok(gate.includes("runWithRoleRetry({"), "queryWithRole ต้องใช้ runWithRoleRetry");
  assert.ok(gate.includes("resetRolePool(role)"), "ต้องทิ้ง pool ของบทบาทนั้นได้");
  assert.equal((gate.match(/queryWithRole<T>\("read"/g) ?? []).length, 1, "readQuery ต้องผ่าน queryWithRole");
  assert.equal((gate.match(/queryWithRole<T>\("form"/g) ?? []).length, 1, "formQuery ต้องผ่าน queryWithRole");
});
