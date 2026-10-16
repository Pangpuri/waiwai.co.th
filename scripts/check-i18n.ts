/**
 * `npm run check:i18n`
 *
 * ตรวจห้าเรื่อง
 *  1. พจนานุกรมทุกภาษามีคีย์ชุดเดียวกัน (สำรองจากด่าน TypeScript)
 *  2. ไม่มีข้อความไทยฝังในไฟล์ .tsx (ต้องดึงจากพจนานุกรมเสมอ)
 *     ยกเว้นได้ด้วยคอมเมนต์ `i18n-allow` พร้อมเหตุผล
 *  3. ขนาด **รายพื้นที่** ไม่เกินเพดาน — core เข้มกว่าเพราะทุกหน้าโหลด
 *     และทุกไฟล์พื้นที่ต้องถูก import ในไฟล์พจนานุกรมของภาษานั้น (ไฟล์ที่ไม่มีใครใช้ = ตัวเลขหลอก)
 *     · ยอดรวมทั้งระบบเป็น "ตัวเลขเฝ้าดู" ไม่ได้บังคับ (แต่พิมพ์ให้เห็นทุกครั้ง)
 *  4. ภาษา th กับ en ต้องมีชุดพื้นที่ตรงกัน
 *  5. **ไม่มีคีย์ที่ไม่มีใครอ้าง** (orphan) — กันซากของโมดูลที่ถอดไปแล้ว (หนี้ D-252-1)
 *     รายละเอียดเกณฑ์อยู่ที่ `scripts/i18n-orphans.ts`
 */
import type { Dirent } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ORPHAN_SCAN_ROOTS, ORPHAN_SOURCE_FILE, findOrphanKeys, topLevelKeysOfArea } from "./i18n-orphans.ts";
import { stripComments } from "./source-scan.ts";
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

/** เดินหาไฟล์ซอร์สทุกชนิดที่อาจอ้างคีย์พจนานุกรม (ไม่รวมตัวพจนานุกรม — กรองที่ผู้เรียก) */
async function* walkSources(directory: string): AsyncGenerator<string> {
  let entries: Dirent[];
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) continue;
      yield* walkSources(path.join(directory, entry.name));
      continue;
    }
    if (ORPHAN_SOURCE_FILE.test(entry.name)) {
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

  /*
    5. คีย์ที่ไม่มีใครอ้าง (orphan) — กันซากของโมดูลที่ถอดไปแล้ว (หนี้ D-252-1)

    ใช้คีย์ระดับรากของ **ไฟล์พื้นที่ภาษาไทย** (ภาษาอังกฤษต้องมีชุดเดียวกัน — ตรวจไปแล้วในข้อ 1)
    แล้วสแกนซอร์สทั้งโปรเจกต์หลังตัดคอมเมนต์ · เหตุผล/ข้อจำกัดทั้งหมดอยู่ใน `scripts/i18n-orphans.ts`
  */
  const thAreaDir = path.join(PROJECT_ROOT, "lib/i18n/messages", "areas", "th");
  const areaKeys = new Set<string>();
  for (const file of areaFilesByLocale.th ?? []) {
    const source = await readFile(path.join(thAreaDir, file), "utf8");
    for (const key of topLevelKeysOfArea(source)) areaKeys.add(key);
  }

  const orphanSources: string[] = [];
  for (const root of ORPHAN_SCAN_ROOTS) {
    for await (const filePath of walkSources(path.join(PROJECT_ROOT, root))) {
      const relative = path.relative(PROJECT_ROOT, filePath).replaceAll("\\", "/");
      if (relative.startsWith("lib/i18n/messages/")) continue; /* ตัวพจนานุกรมเอง */
      orphanSources.push(stripComments(await readFile(filePath, "utf8")));
    }
  }
  /* ไฟล์ที่รากโปรเจกต์ (proxy.ts · next.config.ts · …) ก็อ้างคีย์ได้ */
  for (const entry of await readdir(PROJECT_ROOT, { withFileTypes: true })) {
    if (!entry.isFile() || !ORPHAN_SOURCE_FILE.test(entry.name)) continue;
    orphanSources.push(stripComments(await readFile(path.join(PROJECT_ROOT, entry.name), "utf8")));
  }

  const orphanKeys = findOrphanKeys([...areaKeys], orphanSources);
  for (const key of orphanKeys) {
    problems.push(`คีย์พจนานุกรมที่ไม่มีใครอ้าง: ${key} → ลบทิ้ง (หรือใส่ ALLOWED_ORPHAN_KEYS พร้อมเหตุผล)`);
  }
  notes.push(
    `คีย์ระดับราก ${areaKeys.size} คีย์ · สแกน ${orphanSources.length} ไฟล์ · ไม่ถูกอ้าง ${orphanKeys.length}`,
  );

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
