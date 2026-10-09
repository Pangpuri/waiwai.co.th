import assert from "node:assert/strict";
import { readdirSync, statSync  } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { REPO_ROOT, codeOf, rawOf, stripComments } from "./source-scan.ts";

/**
 * เทสต์รอบที่ 243 — ปิดหนี้ "คอมเมนต์ทำให้ผ่านด่าน"
 *
 * ## เคสจริง (รอบที่ 242)
 * `app/admin/layout.tsx` ผ่านด่านสแกนสิทธิ์ของ `test-rbac.ts` เพราะใน **คอมเมนต์** มีข้อความ
 * `requireAdminUser("<permission>")` ⇒ ด่าน "ไฟล์นี้ตรวจสิทธิ์แล้ว" เป็น **ผลบวกปลอม**
 * (พอลบคอมเมนต์นั้นออกด้วยเหตุผลอื่น ด่านถึงจับได้ว่าขาดของจริง)
 *
 * ## เทสต์ชุดนี้ทำ 4 อย่าง
 * 1. ทดสอบตัวช่วยกลาง `stripComments()` กับเคสที่ regex ธรรมดาพลาด (URL ในสตริง · บล็อกหลายบรรทัด · คงเลขบรรทัด)
 * 2. **ตัวควบคุมเชิงลบ** — จำลองเคสจริง: สิทธิ์อยู่ในคอมเมนต์เท่านั้น ⇒ ต้อง judged ว่า "ไม่มี"
 * 3. **ด่านจริง**: ทุกไฟล์ใน `app/admin/**` ต้องมีสิทธิ์ใน **โค้ดที่ตัดคอมเมนต์แล้ว**
 * 4. กันไม่ให้กลับมามีตัวตัดคอมเมนต์หลายชุด (implementation เดียว = พฤติกรรมเดียวกันทุกด่าน)
 */

/* ── 1) ตัวช่วยกลางทำงานถูก ─────────────────────────────────────────────── */

test("source-scan: ตัดคอมเมนต์โดยไม่แตะสตริง และคงจำนวนบรรทัดเดิม", () => {
  /* คอมเมนต์บรรทัด → กลายเป็นช่องว่าง (ความยาวเท่าเดิม ตำแหน่งไม่เลื่อน) */
  const lineComment = "const a = 1; // const b = 2;";
  const strippedLine = stripComments(lineComment);
  assert.equal(strippedLine.length, lineComment.length, "ความยาวเท่าเดิม (คอมเมนต์กลายเป็นช่องว่าง)");
  assert.equal(strippedLine.trim(), "const a = 1;");
  assert.equal(strippedLine.includes("const b"), false, "โค้ดในคอมเมนต์ต้องหายไป");
  assert.equal(stripComments("const a = 1; // x\nconst c = 3;").split("\n")[1], "const c = 3;", "บรรทัดถัดไปต้องไม่ถูกแตะ");

  /* `//` ในสตริง = ไม่ใช่คอมเมนต์ (จุดที่การเดาจาก `://` พลาด) */
  const withUrl = 'const url = "https://example.com/a//b"; const keep = 1;';
  assert.ok(stripComments(withUrl).includes("const keep = 1;"), "โค้ดหลังสตริงที่มี // ต้องอยู่ครบ");
  assert.ok(stripComments(withUrl).includes("https://example.com/a//b"), "สตริงต้องไม่ถูกตัด");

  /* คอมเมนต์แบบบล็อกหลายบรรทัด → คง \n ไว้ (เลขบรรทัดไม่เลื่อน) */
  const block = "line1\n/* a\nb\nc */\nline5";
  const strippedBlock = stripComments(block);
  assert.equal(strippedBlock.split("\n").length, block.split("\n").length, "จำนวนบรรทัดต้องเท่าเดิม");
  assert.ok(strippedBlock.includes("line1") && strippedBlock.includes("line5"));
  assert.equal(strippedBlock.includes("c */"), false, "เนื้อหาในคอมเมนต์ต้องหายไป");

  /* คอมเมนต์ไทยหาย แต่โค้ดไทยในสตริงอยู่ */
  const thai = '/* ทำไมต้องมีบรรทัดนี้ */\nconst label = "สวัสดี"; // อธิบาย';
  const strippedThai = stripComments(thai);
  assert.equal(strippedThai.includes("ทำไม"), false, "คอมเมนต์ไทยต้องถูกตัด");
  assert.ok(strippedThai.includes("สวัสดี"), "สตริงไทยต้องอยู่");
});

test("source-scan: codeOf ตัดคอมเมนต์ · rawOf ไม่ตัด (เลือกใช้ตามเจตนา)", () => {
  const target = "lib/blocks/live-scope.ts";
  const raw = rawOf(target);
  const code = codeOf(target);
  assert.ok(raw.length > 0);
  /* คอมเมนต์ถูกแทนด้วยช่องว่าง ⇒ ความยาวเท่าเดิม (เลขบรรทัด/ตำแหน่งไม่เลื่อน) */
  assert.equal(code.length, raw.length, "ความยาวต้องเท่าเดิมหลังตัดคอมเมนต์");
  assert.equal(code.includes("มติเจ้าของ"), false, "ข้อความในคอมเมนต์ต้องไม่เหลือ");
  assert.ok(code.includes("export function publishGoesLive"), "โค้ดจริงต้องยังอยู่");
});

/* ── 2) ตัวควบคุมเชิงลบ = เคสจริงรอบที่ 242 ───────────────────────────────── */

test("source-scan: 🐞 สิทธิ์ที่อยู่ใน 'คอมเมนต์' เท่านั้น ต้องไม่ถูกนับว่ามี (เคสจริงรอบ 242)", () => {
  /* จำลองไฟล์ที่ "ดูเหมือน" ตรวจสิทธิ์ แต่ของจริงอยู่ในคอมเมนต์ */
  const decoy = [
    "/**",
    ' * ตัวอย่างการใช้งาน: await requireAdminUser("content")',
    " */",
    "export async function doSomething(): Promise<void> {",
    "  // TODO: ยังไม่ได้ใส่ประตูสิทธิ์",
    "}",
  ].join("\n");

  assert.ok(rawOf.length > 0);
  /* แบบดิบ = หลอกได้ (นี่คือบั๊กเดิม) */
  assert.ok(decoy.includes('requireAdminUser("content")'), "แบบดิบเห็นข้อความ (จึงเป็นผลบวกปลอม)");
  /* แบบตัดคอมเมนต์ = ของจริงว่าง */
  assert.equal(stripComments(decoy).includes('requireAdminUser("content")'), false, "ต้องไม่นับสิทธิ์ที่อยู่ในคอมเมนต์");
  assert.equal(stripComments(decoy).includes("TODO"), false, "คอมเมนต์บรรทัดก็ต้องถูกตัด");
});

/* ── 3) ด่านจริง: สิทธิ์ต้องอยู่ในโค้ด (ไม่ใช่คอมเมนต์) ────────────────────── */

function adminFiles(): readonly string[] {
  const files: string[] = [];
  const walk = (directory: string): void => {
    for (const name of readdirSync(join(REPO_ROOT, directory))) {
      const relative = `${directory}/${name}`;
      if (statSync(join(REPO_ROOT, relative)).isDirectory()) {
        walk(relative);
        continue;
      }
      if (relative.endsWith(".ts") || relative.endsWith(".tsx")) files.push(relative);
    }
  };
  walk("app/admin");
  return files;
}

test("source-scan: ทุกไฟล์ใน app/admin ต้องมีสิทธิ์ใน 'โค้ดจริง' (สแกนแบบตัดคอมเมนต์)", () => {
  /* ไฟล์ที่เข้าได้ก่อนมีเซสชัน (เรื่องล็อกอิน) — ไม่ต้องมีสิทธิ์ */
  const allowlist = new Set(["app/admin/actions.ts", "app/admin/login/page.tsx"]);
  const missing: string[] = [];

  for (const file of adminFiles()) {
    if (allowlist.has(file)) continue;
    const code = codeOf(file);

    /* ทางที่ 1: ประตูกลาง `requireAdminUser("<permission>")` */
    if (/requireAdminUser\(\s*"[a-z]+"\s*\)/.test(code)) continue;
    /* ทางที่ 2: route handler ตรวจเองด้วย `can(user.role, "<permission>")` */
    if (/can\(\s*user\.role\s*,\s*"[a-z]+"\s*\)/.test(code)) continue;
    /* ทางที่ 3: layout ของหลังบ้าน — ตารางสิทธิ์ของเมนู + การกรองด้วยค่านั้น */
    if (
      file === "app/admin/layout.tsx" &&
      code.includes("sidebarPermission: Readonly<Record<string, AdminPermission>>") &&
      code.includes('can(user.role, sidebarPermission[item.href] ?? "content")')
    ) {
      continue;
    }

    missing.push(file);
  }

  assert.deepEqual(missing, [], "ไฟล์เหล่านี้ไม่มีประตูสิทธิ์ในโค้ดจริง (คอมเมนต์ไม่นับ)");
});

/* ── 4) ตัวตัดคอมเมนต์ต้องมีชุดเดียว ───────────────────────────────────────── */

test("source-scan: ตัวตัดคอมเมนต์ต้องมี implementation เดียว (ด่านอื่นห้ามเขียนซ้ำ)", () => {
  const scripts = readdirSync(join(REPO_ROOT, "scripts")).filter((name) => name.endsWith(".ts"));
  const reimplemented: string[] = [];

  for (const name of scripts) {
    if (name === "source-scan.ts") continue;
    const code = rawOf(`scripts/${name}`);
    /*
      ลายนิ้วมือของการ "เขียนตัวตัดคอมเมนต์เอง": regex แทนบล็อกคอมเมนต์แบบดิบ
      (ถ้าพบ = มีคนคัดลอกตรรกะไปไว้ที่อื่น ⇒ พฤติกรรมจะเพี้ยนไม่เหมือนกัน)
    */
    if (/replace(All)?\(\s*\/\\\/\\\*\[\s*\\s\\S\]/.test(code) || code.includes("/\\*[\\s\\S]*?\\*/g")) {
      reimplemented.push(name);
    }
  }

  assert.deepEqual(reimplemented, [], "ไฟล์เหล่านี้เขียนตัวตัดคอมเมนต์เอง — ให้ใช้ codeOf()/stripComments() จาก scripts/source-scan.ts");
});

/* ── 5) ด่านสแกนสิทธิ์ต้องอ่าน "โค้ด" (ไม่ใช่ดิบ) ──────────────────────────── */

test("source-scan: ไฟล์ที่สแกนหา 'ต้องมีสิทธิ์' ต้องใช้ตัวช่วยกลาง", () => {
  const scripts = readdirSync(join(REPO_ROOT, "scripts")).filter((name) => name.endsWith(".ts") && name.startsWith("test-"));
  const offenders: string[] = [];

  for (const name of scripts) {
    const code = rawOf(`scripts/${name}`);
    const scansPermission = /requireAdminUser\\?\(|can\(user\.role/.test(code) && code.includes("includes(");
    if (!scansPermission) continue;
    if (code.includes('from "./source-scan.ts"')) continue;
    offenders.push(name);
  }

  assert.deepEqual(offenders, [], "ไฟล์เหล่านี้สแกนสิทธิ์จากซอร์สโดยไม่ใช้ตัวช่วยกลาง — เสี่ยงผลบวกปลอมจากคอมเมนต์");
});
