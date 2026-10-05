import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { ignoredRuleFor, parseIgnoreRules } from "@/lib/deploy/vercel-ignore";

/**
 * เทสต์ "build บน Vercel จะ resolve import ได้ครบไหม" (รอบที่ 119)
 *
 * ที่มา (เคสจริง 2026-10-05): build บน Vercel ล้มด้วย "Module not found" เพราะ `.vercelignore`
 * ตัดโฟลเดอร์ของแอปออก (`features/products/` · `features/contact/`) — ซึ่ง **เครื่อง Windows มองไม่เห็น**
 * เพราะไฟล์ยังอยู่ในเครื่องครบ ⇒ เทสต์นี้ตรวจสิ่งที่ "เครื่องนี้มองไม่เห็น" ให้:
 *
 *   ทุก import `@/…` ต้อง (1) มีไฟล์จริง (2) **ตัวพิมพ์ตรงกับชื่อไฟล์จริง** (Linux แคร์ตัวพิมพ์)
 *   (3) ถูก track ใน git และ (4) **ไม่ถูกตัดโดย `.vercelignore`**
 *
 * ⇒ ทั้ง 4 ข้อคือเงื่อนไขที่ต้องเป็นจริงทั้งหมด ก่อนที่ build บน Vercel จะผ่าน
 */

const ROOT = process.cwd();
const SOURCE_DIRS = ["app", "lib", "features", "db", "scripts"];
const EXTENSIONS = [".ts", ".tsx", ".js", ".mjs", ".json"];

function walk(dir: string, out: string[] = []): readonly string[] {
  for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(rel, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(rel);
  }
  return out;
}

/** ไฟล์จริงที่มีอยู่ (ตามชื่อจริงบนดิสก์) */
function resolveTarget(specifier: string): string | null {
  const base = specifier.replace(/^@\//, "");
  for (const candidate of [base, ...EXTENSIONS.map((ext) => base + ext), ...EXTENSIONS.map((ext) => `${base}/index${ext}`)]) {
    if (existsSync(path.join(ROOT, candidate)) && statSync(path.join(ROOT, candidate)).isFile()) return candidate;
  }
  return null;
}

/** ตัวพิมพ์ของทุกช่วง path ต้องตรงกับชื่อจริงบนดิสก์ (Linux แคร์เรื่องนี้) — คืนชื่อที่ผิดถ้ามี */
function caseMismatch(rel: string): string | null {
  const parts = rel.split("/");
  let current = "";
  for (const part of parts) {
    const dir = current === "" ? ROOT : path.join(ROOT, current);
    const entries = readdirSync(dir);
    const exact = entries.find((entry) => entry === part);
    if (exact === undefined) {
      const loose = entries.find((entry) => entry.toLowerCase() === part.toLowerCase());
      return loose === undefined ? `${rel} (ไม่พบ "${part}")` : `${rel} (เขียน "${part}" แต่ของจริง "${loose}")`;
    }
    current = current === "" ? part : `${current}/${part}`;
  }
  return null;
}

const ignoreRules = parseIgnoreRules(readFileSync(path.join(ROOT, ".vercelignore"), "utf8"));
const files = SOURCE_DIRS.flatMap((dir) => (existsSync(path.join(ROOT, dir)) ? walk(dir) : []));

function collectAliasImports(file: string): readonly string[] {
  const code = readFileSync(path.join(ROOT, file), "utf8");
  const found: string[] = [];
  const patterns = [/from\s+"(@\/[^"]+)"/g, /from\s+'(@\/[^']+)'/g, /import\("(@\/[^"]+)"\)/g, /require\("(@\/[^"]+)"\)/g];
  for (const pattern of patterns) {
    for (const match of code.matchAll(pattern)) {
      const specifier = match[1];
      if (specifier !== undefined) found.push(specifier);
    }
  }
  return found;
}

test("import: ทุก `@/…` ในโปรเจกต์ต้องมีไฟล์จริง + ตัวพิมพ์ตรง + ไม่ถูก .vercelignore ตัด", () => {
  const problems: string[] = [];
  let checked = 0;

  for (const file of files) {
    for (const specifier of collectAliasImports(file)) {
      checked += 1;
      const target = resolveTarget(specifier);

      if (target === null) {
        problems.push(`${file} → ${specifier}: หาไฟล์ไม่เจอ`);
        continue;
      }

      const mismatch = caseMismatch(target);
      if (mismatch !== null) problems.push(`${file} → ${specifier}: ตัวพิมพ์ไม่ตรง — ${mismatch}`);

      try {
        execFileSync("git", ["ls-files", "--error-unmatch", target], { stdio: "pipe" });
      } catch {
        problems.push(`${file} → ${specifier}: ${target} ไม่ได้ track ใน git (Vercel จะไม่มีไฟล์นี้)`);
      }

      const rule = ignoredRuleFor(target, ignoreRules);
      if (rule !== null) {
        problems.push(`${file} → ${specifier}: ${target} ถูก .vercelignore ตัดด้วยกฎ "${rule}"`);
      }
    }
  }

  assert.ok(checked > 100, `ต้องตรวจ import ได้มากพอ (ตรวจได้ ${String(checked)})`);
  assert.deepEqual(problems, [], `\n${problems.join("\n")}`);
});
