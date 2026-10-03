import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

/**
 * เทสต์ปิดหนี้ "ยังไม่มี CI" (รอบที่ 81)
 *
 * ทำไมต้องมีเทสต์กับไฟล์ CI
 * - ไฟล์ workflow ที่ "รันไม่ครบ" หรือ "อ้าง script ที่ไม่มีอยู่" จะพังเงียบ ๆ บน GitHub
 *   (คนอ่าน log ไม่ครบทุกครั้ง ⇒ ต้องมีอะไรกันถอยหลัง)
 * - และต้องกันการเผลอใส่ **ความลับจริง** ลงไฟล์ที่ commit (ไฟล์นี้อยู่ใน repo สาธารณะ)
 */

const ROOT = path.resolve(import.meta.dirname, "..");
const WORKFLOW_PATH = path.join(ROOT, ".github", "workflows", "gates.yml");

function readWorkflow(): string {
  return readFileSync(WORKFLOW_PATH, "utf8");
}

/**
 * ตัด "บรรทัดคอมเมนต์" ออกก่อนตรวจข้อความ
 * ⚠️ จำเป็น: คอมเมนต์ในไฟล์นี้เขียนอธิบายว่า "ห้ามใส่ SESSION_SECRET" ⇒ ถ้าไม่ตัดจะจับตัวเอง (false positive)
 */
function readWorkflowCode(): string {
  return readWorkflow()
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("#"))
    .join("\n");
}

function scriptNames(): readonly string[] {
  const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")) as {
    readonly scripts?: Readonly<Record<string, string>>;
  };
  return Object.keys(pkg.scripts ?? {});
}

test("ci: มีไฟล์ workflow และไม่ถูก gitignore", () => {
  assert.ok(existsSync(WORKFLOW_PATH), "ต้องมี .github/workflows/gates.yml");

  /* ไฟล์นี้ต้องถูก commit — ถ้า .gitignore กันไว้ CI จะไม่มีวันรัน (ตรวจจากข้อความกันพลาด) */
  const ignore = readFileSync(path.join(ROOT, ".gitignore"), "utf8");
  for (const line of ignore.split("\n")) {
    const entry = line.trim();
    /* ข้ามคอมเมนต์/บรรทัดว่าง — ที่เหลือคือ "กฎ" จริงของ gitignore */
    if (entry === "" || entry.startsWith("#")) continue;
    assert.ok(!entry.includes(".github"), `.gitignore ห้ามกันไฟล์ CI (พบ "${entry}")`);
  }
});

test("ci: ทุกคำสั่ง npm run … ใน CI ต้องมีอยู่จริงใน package.json", () => {
  const workflow = readWorkflow();
  const available = new Set(scriptNames());
  const referenced = [...workflow.matchAll(/npm run ([a-z0-9:_-]+)/g)].map((match) => match[1] ?? "");

  assert.ok(referenced.length >= 10, "CI ต้องรันหลายด่านจริง");
  for (const name of new Set(referenced)) {
    assert.ok(available.has(name), `CI อ้าง "npm run ${name}" ที่ไม่มีใน package.json`);
  }
});

test("ci: งาน gates รันด่าน 1–7 + build ครบ", () => {
  const workflow = readWorkflow();

  for (const script of ["build", "typecheck", "lint", "check:dark", "check:i18n", "check:content", "check:actions"]) {
    assert.ok(workflow.includes(`npm run ${script}`), `ขาดด่าน ${script}`);
  }
  /* ชุดเทสต์รันด้วย `npm test` (มี alias ของโปรเจกต์เอง) ไม่ใช่ `npm run test` */
  assert.ok(workflow.includes("npm test"), "ขาดด่านทดสอบ (npm test)");

  /* build ต้องมาก่อน typecheck เพราะ route types (`.next/types`) ถูกสร้างตอน build */
  assert.ok(
    workflow.indexOf("npm run build") < workflow.indexOf("npm run typecheck"),
    "ต้อง build ก่อน typecheck เพื่อให้ route types ใหม่ถูกสร้าง",
  );

  assert.ok(workflow.includes('node-version: "22"'), "ต้องใช้ Node 22 ตาม engines ของโปรเจกต์");
  assert.ok(workflow.includes("npm ci"), "ต้องติดตั้ง dependency ตาม lockfile เท่านั้น");
});

test("ci: งาน database พิสูจน์ฐานข้อมูลจริงครบ (migrate · check:db · check:migrations · check:restore)", () => {
  const workflow = readWorkflow();

  assert.ok(workflow.includes("image: postgres:17"), "ต้องใช้ Postgres 17 ให้ตรงกับเครื่อง dev");
  assert.ok(workflow.includes("postgresql-client-17"), "ต้องมี pg_dump/pg_restore ให้ check:restore ทำงานได้");
  assert.ok(workflow.includes("DATABASE_URL"), "งานนี้ต้องตั้ง DATABASE_URL ให้สคริปต์");

  for (const script of ["db:migrate", "db:seed", "check:migrations", "check:db", "db:backup", "check:restore"]) {
    assert.ok(workflow.includes(`npm run ${script}`), `ขาดขั้นตอน ${script}`);
  }

  /* seed ต้องอยู่หลัง migrate และก่อนการตรวจ (check:db ต้องการเนื้อหาตั้งต้น) */
  const migrateAt = workflow.indexOf("npm run db:migrate");
  const seedAt = workflow.indexOf("npm run db:seed");
  const checkDbAt = workflow.indexOf("npm run check:db");
  assert.ok(seedAt > migrateAt, "seed ต้องอยู่หลัง migrate");
  assert.ok(seedAt < checkDbAt, "seed ต้องอยู่ก่อน check:db (ไม่งั้นฐานข้อมูลเปล่าแล้วด่านตก)");

  /* ลำดับสำคัญ: migrate → migrations → db → backup → restore */
  const order = ["db:migrate", "check:migrations", "check:db", "db:backup", "check:restore"].map((script) =>
    workflow.indexOf(`npm run ${script}`),
  );
  for (let index = 1; index < order.length; index += 1) {
    assert.ok((order[index] ?? -1) > (order[index - 1] ?? -1), "ลำดับขั้นตอนฐานข้อมูลต้องจากล่างขึ้นบนตามรายการ");
  }
});

test("ci: ห้ามมีความลับจริง และห้ามกลบความล้มเหลว", () => {
  const workflow = readWorkflowCode();

  for (const forbidden of ["SESSION_SECRET", "ADMIN_PASSWORD_HASH", "ADMIN_EMAIL", "secrets."]) {
    assert.ok(!workflow.includes(forbidden), `ห้ามใส่ "${forbidden}" ในไฟล์ CI (repo เป็นสาธารณะ)`);
  }

  assert.ok(!workflow.includes("continue-on-error"), "ด่านต้องไม่ถูกกลบให้ผ่านเงียบ ๆ");
  assert.ok(workflow.includes("contents: read"), "ต้องจำกัดสิทธิ์ของ token ให้อ่านเท่านั้น");
  assert.ok(workflow.includes("runs-on: ubuntu-latest"), "ต้องระบุเครื่องรันให้ชัด");
});
