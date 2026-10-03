import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * ด่านกันบั๊กซ้ำ: ไฟล์ `"use server"` export ได้เฉพาะ "ฟังก์ชัน async" และ type
 *
 * เหตุผล — เกิดจริง 2 ครั้งในโปรเจกต์นี้
 *   รอบที่ 66: `INITIAL_PUBLIC_FORM_STATE` ในไฟล์ action ⇒ ค่าเป็น undefined ⇒ **หน้า /contact พังตอน build**
 *   รอบที่ 68: `INITIAL_SETTINGS_STATE` ในไฟล์ action ⇒ **หน้าตั้งค่าเว็บ 500 ตอน runtime**
 * Next ไม่ฟ้องตอน build ทุกกรณี ⇒ ต้องมีด่านของเราเอง
 *
 * รันด้วย: `npm run check:actions`
 */

const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "public", "tmp"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith(".ts") || name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

function isServerActionFile(source: string): boolean {
  /* ต้องเป็น directive บรรทัดแรก ๆ ของไฟล์ (ยอมให้มีคอมเมนต์/บรรทัดว่างนำได้) */
  const head = source.split("\n").slice(0, 12).join("\n");
  return /^\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*["']use server["']\s*;/m.test(head);
}

/** หา export ที่ "ไม่ใช่" ฟังก์ชัน async และไม่ใช่ type (type ถูกลบตอน compile ⇒ ปลอดภัย) */
function forbiddenExports(source: string): readonly string[] {
  const found: string[] = [];
  const pattern = /^\s*export\s+(?!async\s+function\b)(?:default\s+)?(const|let|var|class|function|enum)\b(.*)$/gm;

  for (const match of source.matchAll(pattern)) {
    const line = (match[0] ?? "").trim();
    /* ยอมเฉพาะ `export function` ที่เป็น type guard? ไม่ — ในไฟล์ action ต้องเป็น async เท่านั้น */
    found.push(line.slice(0, 90));
  }

  return found;
}

const root = process.cwd();
const files = walk(root);
const problems: string[] = [];
let scanned = 0;

for (const file of files) {
  const source = readFileSync(file, "utf8");
  if (!isServerActionFile(source)) continue;
  scanned += 1;

  for (const line of forbiddenExports(source)) {
    problems.push(`${relative(root, file).replaceAll("\\", "/")}: ${line}`);
  }
}

if (problems.length > 0) {
  console.error("✗ ไฟล์ \"use server\" export ได้เฉพาะฟังก์ชัน async (ค่าคงที่/คลาส/ฟังก์ชัน sync = ห้าม)");
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error("  ⇒ ย้ายค่าคงที่/ชนิด ไปไฟล์ธรรมดา (เช่น features/admin/settings-state.ts)");
  process.exit(1);
}


console.log('✓ check:actions ผ่าน — ตรวจ ' + scanned + ' ไฟล์ use server (ไม่มี export ต้องห้าม)');
