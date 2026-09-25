/**
 * `npm run check:dark`
 *
 * ตรวจว่าโหมดมืดรองรับครบหรือไม่ โดยปฏิเสธ "คลาสสีดิบ" ของ Tailwind
 * (bg-white, text-gray-900, bg-red-500, ...) เพราะคลาสเหล่านั้น
 * สว่างเท่าเดิมในโหมดมืด → ตัวอักษรจมพื้นหลัง
 *
 * วิธีแก้: ใช้ token กึ่งความหมายที่ประกาศใน app/globals.css
 *   bg-surface · text-fg · text-fg-muted · border-line · bg-bg-cream · ...
 *
 * ยกเว้นได้เป็นรายบรรทัดด้วยคอมเมนต์ `check-dark-allow` พร้อมเหตุผล
 */
import type { Dirent } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

const SCAN_ROOTS = ["app", "features", "lib"];
const SCAN_EXTENSIONS = new Set([".ts", ".tsx", ".css"]);
const IGNORED_DIRECTORIES = new Set(["node_modules", ".next", ".git", "scripts", "public"]);

const PALETTE_COLORS =
  "white|black|slate|gray|grey|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";

const COLOR_UTILITY_PREFIXES =
  "bg|text|border|ring|from|to|via|fill|stroke|divide|outline|decoration|shadow|accent|caret|placeholder|color";

const RAW_PALETTE_CLASS = new RegExp(
  `\\b(?:${COLOR_UTILITY_PREFIXES})-(?:${PALETTE_COLORS})(?:-\\d{2,3})?(?:/\\d{1,3})?\\b`,
  "g",
);

/** สีที่เขียนตรง ๆ ในไฟล์ .ts/.tsx (ควรอยู่ใน globals.css เท่านั้น) */
const RAW_HEX_COLOR = /#[0-9a-fA-F]{3,8}\b/g;
const ALLOW_MARKER = "check-dark-allow";
const ALLOWLISTED_FILES = new Set(["globals.css"]);

/** ผลตรวจหนึ่งจุด */
type Finding = {
  readonly line: number;
  readonly matches: readonly string[];
  readonly text: string;
};

type Problem = {
  readonly file: string;
  readonly line: number;
  readonly rule: string;
  readonly detail: string;
};

async function* walk(directory: string): AsyncGenerator<string> {
  let entries: Dirent[];
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) continue;
      yield* walk(path.join(directory, entry.name));
      continue;
    }
    if (SCAN_EXTENSIONS.has(path.extname(entry.name))) {
      yield path.join(directory, entry.name);
    }
  }
}

/** หา (บรรทัด, ข้อความ) ที่เข้าเงื่อนไข แล้วข้ามบรรทัดที่มี marker ยกเว้น */
function findMatches(source: string, pattern: RegExp): Finding[] {
  const findings: Finding[] = [];

  source.split(/\r?\n/).forEach((line, index) => {
    if (line.includes(ALLOW_MARKER)) return;

    const matches = line.match(pattern);
    if (matches) {
      findings.push({ line: index + 1, matches: [...new Set(matches)], text: line.trim() });
    }
  });

  return findings;
}

async function main() {
  const problems: Problem[] = [];
  let scanned = 0;
  let darkVariantFound = false;

  for (const root of SCAN_ROOTS) {
    for await (const filePath of walk(path.join(PROJECT_ROOT, root))) {
      scanned += 1;

      const relative = path.relative(PROJECT_ROOT, filePath).replaceAll("\\", "/");
      const base = path.basename(filePath);
      const source = await readFile(filePath, "utf8");

      if (relative.endsWith("app/globals.css") && source.includes("@custom-variant dark")) {
        darkVariantFound = true;
      }

      for (const finding of findMatches(source, RAW_PALETTE_CLASS)) {
        problems.push({
          file: relative,
          line: finding.line,
          rule: "คลาสสีดิบของ Tailwind (สว่างเท่าเดิมในโหมดมืด)",
          detail: finding.matches.join(", "),
        });
      }

      if (!ALLOWLISTED_FILES.has(base)) {
        for (const finding of findMatches(source, RAW_HEX_COLOR)) {
          problems.push({
            file: relative,
            line: finding.line,
            rule: "เขียนรหัสสีตรง ๆ (ควรประกาศเป็น token ใน globals.css)",
            detail: finding.matches.join(", "),
          });
        }
      }
    }
  }

  if (!darkVariantFound) {
    problems.push({
      file: "app/globals.css",
      line: 0,
      rule: "ไม่พบ @custom-variant dark — โหมดมืดจะไม่ทำงาน",
      detail: "ต้องมี @custom-variant dark (&:where(.dark, .dark *));",
    });
  }

  if (problems.length > 0) {
    process.stderr.write(`\n✗ check:dark พบปัญหา ${problems.length} จุด\n\n`);
    for (const problem of problems) {
      const where = problem.line > 0 ? `${problem.file}:${problem.line}` : problem.file;
      process.stderr.write(`  ${where}\n    ${problem.rule}\n    → ${problem.detail}\n\n`);
    }
    process.stderr.write(
      "  ใช้ token กึ่งความหมายแทน: bg-surface · text-fg · text-fg-muted · border-line · bg-bg-cream\n" +
        "  หรือใส่คอมเมนต์ `check-dark-allow` พร้อมเหตุผลถ้าจำเป็นจริง ๆ\n\n",
    );
    process.exit(1);
  }

  process.stdout.write(`✓ check:dark ผ่าน (สแกน ${scanned} ไฟล์, ไม่พบคลาสสีดิบ)\n`);
}

await main();
