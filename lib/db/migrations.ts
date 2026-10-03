import { createHash } from "node:crypto";

/**
 * ตรรกะ "ระบบ migration" ของโปรเจกต์ (รอบที่ 60)
 *
 * ผู้ใช้เลือก: **คง SQL เขียนมือ + ทำระบบ migration เอง** (ไม่ใช้ ORM — ดู WORK_PLAN.md)
 * เหตุผล: ได้ประโยชน์หลักของ ORM (แก้ตารางเป็นขั้นตอน · ย้ายเซิร์ฟเวอร์ได้ · ย้อนดูได้)
 *        โดยไม่เพิ่ม dependency และยังอ่าน SQL ออกทั้งหมด
 *
 * ไฟล์นี้เป็น **ตรรกะล้วน** (ไม่แตะฐานข้อมูล/ไฟล์) ⇒ ทดสอบได้ด้วย `node --test`
 * ส่วนการอ่านไฟล์/รัน SQL อยู่ที่ `scripts/migrate.ts`
 */

export type MigrationFile = {
  /** รหัสเรียงลำดับจากชื่อไฟล์ เช่น `0001` */
  readonly id: string;
  /** ชื่ออ่านง่ายหลังรหัส เช่น `init` */
  readonly name: string;
  /** เนื้อ SQL ทั้งไฟล์ (รันทั้งก้อนในคำสั่งเดียว — `pg` รองรับหลายคำสั่ง) */
  readonly sql: string;
};

export type MigrationPlanItem = MigrationFile & {
  /** ลายนิ้วมือของเนื้อไฟล์ — ใช้ตรวจจับว่า "แก้ไฟล์ที่รันไปแล้ว" */
  readonly checksum: string;
};

export type MigrationState = {
  readonly appliedIds: readonly string[];
  /** id → checksum ที่จดไว้ตอนรันจริง */
  readonly appliedChecksums: Readonly<Record<string, string>>;
};

export type MigrationPlan = {
  /** ยังไม่เคยรัน — ต้องรันตามลำดับนี้ */
  readonly pending: readonly MigrationPlanItem[];
  /** รันไปแล้วและเนื้อไฟล์ตรงกับที่จดไว้ */
  readonly clean: readonly MigrationPlanItem[];
  /**
   * รันไปแล้ว **แต่เนื้อไฟล์ถูกแก้ทีหลัง** — อันตราย: ฐานข้อมูลจริงกับไฟล์ไม่ตรงกันแล้ว
   * ⇒ ต้องเตือนให้ผู้ใช้สร้าง migration ใหม่แทนการแก้ไฟล์เก่า
   */
  readonly modified: readonly { readonly id: string; readonly name: string; readonly was: string; readonly now: string }[];
};

const FILE_PATTERN = /^(\d{3,})[-_]([a-z0-9-_]+)\.sql$/i;

export function checksumOf(sql: string): string {
  /* ตัดช่องว่างหัวท้าย + แปลง CRLF → LF ก่อนคิดลายนิ้วมือ (กัน diff ปลอมจาก OS) */
  const normalized = sql.replace(/\r\n/g, "\n").trim();
  return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

/** แปลงชื่อไฟล์ → รหัส/ชื่อ · ชื่อที่ไม่ตรงรูปแบบ = คืน null (ผู้เรียกรายงานเป็น error) */
export function parseMigrationFileName(fileName: string): { readonly id: string; readonly name: string } | null {
  const matched = FILE_PATTERN.exec(fileName.trim());
  if (matched === null) return null;
  const id = matched[1];
  const name = matched[2];
  if (id === undefined || name === undefined) return null;
  return { id, name };
}

/**
 * เรียงไฟล์ migration ตามรหัสตัวเลข (ไม่ใช่ตามตัวอักษร) แล้วตรวจรหัสซ้ำ
 * - รหัสซ้ำ = error (ผู้เรียกรายงานและหยุด — กันรันผิดลำดับ)
 */
export function sortMigrations(files: readonly MigrationFile[]): readonly MigrationFile[] {
  return [...files].sort((left, right) => Number.parseInt(left.id, 10) - Number.parseInt(right.id, 10));
}

export function findDuplicateIds(files: readonly MigrationFile[]): readonly string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const file of files) {
    if (seen.has(file.id)) duplicates.add(file.id);
    seen.add(file.id);
  }
  return [...duplicates];
}

/** เทียบ "ไฟล์ที่มี" กับ "ที่รันไปแล้ว" → ได้แผนว่าต้องรันอะไร ตรวจอะไร */
export function planMigrations(files: readonly MigrationFile[], state: MigrationState): MigrationPlan {
  const appliedIds = new Set(state.appliedIds);
  const ordered = sortMigrations(files);

  const pending: MigrationPlanItem[] = [];
  const clean: MigrationPlanItem[] = [];
  const modified: { id: string; name: string; was: string; now: string }[] = [];

  for (const file of ordered) {
    const checksum = checksumOf(file.sql);
    const item: MigrationPlanItem = { ...file, checksum };

    if (!appliedIds.has(file.id)) {
      pending.push(item);
      continue;
    }

    const was = state.appliedChecksums[file.id];
    if (was === undefined || was === checksum) {
      clean.push(item);
      continue;
    }

    modified.push({ id: file.id, name: file.name, was, now: checksum });
  }

  return { pending, clean, modified };
}

/** ข้อความสรุปสำหรับพิมพ์ในเทอร์มินัล (ไม่ผูกกับภาษา — หน้าจอ CLI ใช้ได้ทั้งสอง) */
export function describePlan(plan: MigrationPlan): readonly string[] {
  const lines: string[] = [];
  lines.push(`รันแล้วและตรงกัน ${plan.clean.length} ไฟล์`);
  lines.push(`ยังไม่รัน ${plan.pending.length} ไฟล์`);
  if (plan.pending.length > 0) {
    for (const item of plan.pending) lines.push(`  + ${item.id}-${item.name}`);
  }
  if (plan.modified.length > 0) {
    lines.push(`⚠️ ไฟล์ที่รันไปแล้วถูกแก้ทีหลัง ${plan.modified.length} ไฟล์ (ห้ามแก้ย้อนหลัง — ให้สร้างไฟล์ใหม่)`);
    for (const item of plan.modified) lines.push(`  ! ${item.id}-${item.name} (${item.was} → ${item.now})`);
  }
  return lines;
}
