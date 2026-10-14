import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import {
  findDuplicateIds,
  parseMigrationFileName,
  sortMigrations,
  type MigrationFile,
} from "@/lib/db/migrations";

/**
 * อ่านไฟล์ migration จาก `db/migrations/` — **ที่เดียว** สำหรับทุกสคริปต์ (รอบที่ 283)
 *
 * ## ทำไมต้องรวม
 * เดิมมี `loadMigrations()` เขียนซ้ำ 2 ที่ (`scripts/migrate.ts` · `scripts/check-migrations.ts`)
 * และทั้งคู่มีกติกาต่างกันนิดหน่อย (ตัวหนึ่งตรวจชื่อไฟล์แปลก + เลขซ้ำ · อีกตัวไม่ตรวจ)
 * ⇒ พอเพิ่มเครื่องมือที่สาม (`check:target` — ด่านกัน "คลาวด์ล้าหลัง" · หนี้ D-282-2)
 *    การมีสำเนาที่สามคือจุดเริ่มของ "ด่านไม่ตรงกัน" ซึ่งโปรเจกต์นี้เจ็บมาแล้วหลายรอบ
 *
 * กติกา (เข้มเท่าตัวที่เข้มที่สุด)
 * 1. ชื่อไฟล์ต้องตรงรูปแบบ `0001-ชื่อ.sql` — ไม่ตรง = **โยน error** (ไม่ข้ามเงียบ)
 * 2. เลข migration **ห้ามซ้ำ** — ซ้ำ = โยน error
 * 3. คืนค่าที่**เรียงตามเลข**เสมอ (ลำดับการรันต้องคงที่)
 *
 * ⚠️ ไฟล์นี้แตะระบบไฟล์ (ไม่ใช่ตรรกะล้วน) — ตรรกะของ migration อยู่ที่ `lib/db/migrations.ts`
 *    และการเชื่อมฐานข้อมูลอยู่ที่ผู้เรียก
 */

/** โฟลเดอร์ต้นทาง (อิง cwd ของโปรเซส เหมือนสคริปต์อื่นของโปรเจกต์) */
export const MIGRATIONS_DIR = join(process.cwd(), "db", "migrations");

export function loadMigrationFiles(): readonly MigrationFile[] {
  const fileNames = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();

  const parsed: MigrationFile[] = [];
  const unknown: string[] = [];

  for (const fileName of fileNames) {
    const info = parseMigrationFileName(fileName);
    if (info === null) {
      unknown.push(fileName);
      continue;
    }
    parsed.push({
      id: info.id,
      name: info.name,
      sql: readFileSync(join(MIGRATIONS_DIR, fileName), "utf8"),
    });
  }

  if (unknown.length > 0) {
    throw new Error(`ชื่อไฟล์ไม่ตรงรูปแบบ (ต้องเป็น 0001-ชื่อ.sql): ${unknown.join(", ")}`);
  }

  const duplicates = findDuplicateIds(parsed);
  if (duplicates.length > 0) {
    throw new Error(`เลข migration ซ้ำ: ${duplicates.join(", ")}`);
  }

  return sortMigrations(parsed);
}
