/**
 * `npm run check:i18n`
 *
 * ตรวจสี่เรื่อง
 *  1. พจนานุกรมทุกภาษามีคีย์ชุดเดียวกัน (สำรองจากด่าน TypeScript)
 *  2. ไม่มีข้อความไทยฝังในไฟล์ .tsx (ต้องดึงจากพจนานุกรมเสมอ)
 *     ยกเว้นได้ด้วยคอมเมนต์ `i18n-allow` พร้อมเหตุผล
 *  3. ขนาด **รายพื้นที่** ไม่เกินเพดาน — core เข้มกว่าเพราะทุกหน้าโหลด
 *     และทุกไฟล์พื้นที่ต้องถูก import ในไฟล์พจนานุกรมของภาษานั้น (ไฟล์ที่ไม่มีใครใช้ = ตัวเลขหลอก)
 *     · ยอดรวมทั้งระบบเป็น "ตัวเลขเฝ้าดู" ไม่ได้บังคับ (แต่พิมพ์ให้เห็นทุกครั้ง)
 *  4. ภาษา th กับ en ต้องมีชุดพื้นที่ตรงกัน
 */
import type { Dirent } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { en } from "../lib/i18n/messages/en.ts";
import { th } from "../lib/i18n/messages/th.ts";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

/**
 * เพดานขนาด **ต่อพื้นที่** (ไฟล์ใน `lib/i18n/messages/areas/<locale>/`)
 *
 * เดิมเป็นเพดานก้อนเดียว 64KB ต่อภาษา — พอข้อมูลจริงของบริษัท (บริษัท/รับสมัครงาน/ติดต่อ)
 * เข้ามาครบ ไฟล์ก้อนเดียวก็ชนเพดาน (65.2KB) จึงแยกเป็นรายพื้นที่ตามกฎข้อ 8.6
 * แล้วเปลี่ยนเพดานมาเป็น "ต่อพื้นที่" แทน:
 *   - core: ทุกหน้าโหลด → เพดานเข้มกว่า
 *   - พื้นที่อื่น: เนื้อหาจริงของหน้าเดียว ถ้าเกิน = สัญญาณว่าพื้นที่นั้นควรถูกแยกย่อย
 *     (ไม่ใช่สัญญาณให้ขยายเพดาน)
 *   - ยอดรวมทั้งระบบ = ตัวเลขเฝ้าดู ไม่ได้บังคับ (ดู § 8.6 ของกฎ)
 */
const MAX_CORE_BYTES = 16 * 1024;
const MAX_AREA_BYTES = 32 * 1024;

/** ไฟล์ที่อนุญาตให้มีข้อความไทย (คือตัวพจนานุกรมเอง) */
const DICTIONARY_FILES = new Set(["th.ts", "en.ts"]);

const THAI_CHARACTER = /[\u0E00-\u0E7F]/;
const ALLOW_MARKER = "i18n-allow";
const IGNORED_DIRECTORIES = new Set(["node_modules", ".next", ".git", "scripts", "public"]);

/** ตัดคอมเมนต์ออกก่อนตรวจ เพื่อไม่ให้คอมเมนต์ไทยถูกรายงานผิด */
function stripComments(source: string): string {
  /*
    แทนคอมเมนต์แบบบล็อกด้วยช่องว่าง "โดยคงจำนวนบรรทัดเดิม"
    ถ้าลบทิ้งทั้งก้อน เลขบรรทัดที่รายงานจะเลื่อน → ชี้ผิดบรรทัด
  */
  const withoutBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (match) =>
    match.replace(/[^\n]/g, " "),
  );

  return withoutBlocks
    .split(/\r?\n/)
    .map((line) => {
      const index = line.indexOf("//");
      // ไม่ตัดที่ "://" ของ URL
      if (index === -1 || line[index - 1] === ":") return line;
      return line.slice(0, index);
    })
    .join("\n");
}

function flattenKeys(value: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const next = prefix === "" ? key : `${prefix}.${key}`;
    if (child !== null && typeof child === "object") {
      return flattenKeys(child as Record<string, unknown>, next);
    }
    return [next];
  });
}

async function* walkTsx(directory: string): AsyncGenerator<string> {
  let entries: Dirent[];
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) continue;
      yield* walkTsx(path.join(directory, entry.name));
      continue;
    }
    if (entry.name.endsWith(".tsx")) {
      yield path.join(directory, entry.name);
    }
  }
}

async function main() {
  const problems: string[] = [];
  const notes: string[] = [];

  /* 1. คีย์ตรงกันทุกภาษา */
  const thKeys = flattenKeys(th);
  const enKeys = flattenKeys(en);
  const thSet = new Set(thKeys);
  const enSet = new Set(enKeys);

  const missingInEn = thKeys.filter((key) => !enSet.has(key));
  const extraInEn = enKeys.filter((key) => !thSet.has(key));

  if (missingInEn.length > 0) {
    problems.push(`en.ts ขาดคีย์ ${missingInEn.length} คีย์: ${missingInEn.slice(0, 8).join(", ")}`);
  }
  if (extraInEn.length > 0) {
    problems.push(`en.ts มีคีย์เกิน ${extraInEn.length} คีย์: ${extraInEn.slice(0, 8).join(", ")}`);
  }

  /* 2. ไม่มีข้อความไทยฝังในไฟล์ .tsx */
  let scanned = 0;
  for (const root of ["app", "features"]) {
    for await (const filePath of walkTsx(path.join(PROJECT_ROOT, root))) {
      scanned += 1;

      const relative = path.relative(PROJECT_ROOT, filePath).replaceAll("\\", "/");
      if (DICTIONARY_FILES.has(path.basename(filePath))) continue;

      const raw = await readFile(filePath, "utf8");
      // ตรวจ marker บนบรรทัดดิบ เพราะ stripComments ตัดคอมเมนต์ (และ marker) ทิ้งไปแล้ว
      const rawLines = raw.split(/\r?\n/);
      const sourceLines = stripComments(raw).split(/\r?\n/);

      sourceLines.forEach((line, index) => {
        if (rawLines[index]?.includes(ALLOW_MARKER)) return;
        if (!THAI_CHARACTER.test(line)) return;

        problems.push(
          `${relative}:${index + 1} มีข้อความไทยฝังในโค้ด → ${line.trim().slice(0, 70)}`,
        );
      });
    }
  }

  /* 3. ขนาดรายพื้นที่ + ทุกไฟล์พื้นที่ต้องถูกใช้จริง */
  const areaFilesByLocale: Record<string, string[]> = {};

  for (const locale of ["th", "en"] as const) {
    const areaDir = path.join(PROJECT_ROOT, "lib/i18n/messages", "areas", locale);
    let files: string[];

    try {
      files = (await readdir(areaDir)).filter((name) => name.endsWith(".ts")).sort();
    } catch {
      problems.push(`ไม่พบโฟลเดอร์พื้นที่ของภาษา ${locale} (lib/i18n/messages/areas/${locale})`);
      continue;
    }

    areaFilesByLocale[locale] = files;

    const indexSource = await readFile(
      path.join(PROJECT_ROOT, "lib/i18n/messages", `${locale}.ts`),
      "utf8",
    );

    const parts: string[] = [];
    let totalBytes = 0;

    for (const file of files) {
      const area = file.replace(/\.ts$/, "");
      const { size } = await stat(path.join(areaDir, file));
      const limit = area === "core" ? MAX_CORE_BYTES : MAX_AREA_BYTES;

      totalBytes += size;
      parts.push(`${area}=${(size / 1024).toFixed(1)}KB`);

      if (!indexSource.includes(`./areas/${locale}/${file}`)) {
        problems.push(
          `${locale}.ts ไม่ได้ import พื้นที่ ${area} → ไฟล์ lib/i18n/messages/areas/${locale}/${file} จะไม่ถูกใช้เลย`,
        );
      }

      if (size > limit) {
        problems.push(
          `พื้นที่ ${locale}/${area} ใหญ่ ${(size / 1024).toFixed(1)} KB เกินเพดาน ${limit / 1024} KB → แยกพื้นที่ย่อย อย่าขยายเพดาน`,
        );
      }
    }

    notes.push(`พื้นที่ ${locale}: ${parts.join(" · ")} (รวม ${(totalBytes / 1024).toFixed(1)}KB)`);
  }

  /* 4. th กับ en ต้องมีชุดพื้นที่ตรงกัน */
  const thAreas = areaFilesByLocale.th ?? [];
  const enAreas = areaFilesByLocale.en ?? [];
  const areaMissingInEn = thAreas.filter((file) => !enAreas.includes(file));
  const areaMissingInTh = enAreas.filter((file) => !thAreas.includes(file));

  if (areaMissingInEn.length > 0) {
    problems.push(`en ไม่มีพื้นที่: ${areaMissingInEn.join(", ")}`);
  }
  if (areaMissingInTh.length > 0) {
    problems.push(`th ไม่มีพื้นที่: ${areaMissingInTh.join(", ")}`);
  }

  notes.push(`จำนวนคีย์: ${thKeys.length} คีย์ · สแกน ${scanned} ไฟล์ .tsx`);

  /* ผลลัพธ์ */
  for (const note of notes) {
    process.stdout.write(`  ${note}\n`);
  }

  if (problems.length > 0) {
    process.stderr.write(`\n✗ check:i18n พบปัญหา ${problems.length} จุด\n\n`);
    for (const problem of problems) {
      process.stderr.write(`  ${problem}\n`);
    }
    process.stderr.write("\n");
    process.exit(1);
  }

  process.stdout.write("✓ check:i18n ผ่าน\n");
}

await main();
