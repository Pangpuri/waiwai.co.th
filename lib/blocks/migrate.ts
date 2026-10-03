import { MAX_BLOCK_DEPTH, BLOCK_SCHEMA_VERSION, LEGACY_BLOCK_SCHEMA_VERSION } from "@/lib/blocks/types";

/**
 * ตัวย้ายรุ่นรูปทรงบล็อก (X1.1)
 *
 * ทำไมต้องมี
 * - เอกสารบล็อกถูกเก็บเป็น JSONB ในฐานข้อมูล ⇒ วันที่รูปทรงเปลี่ยน (เพิ่มฟิลด์/ย้ายความหมาย/เพิ่มชนิดบล็อก)
 *   ข้อมูลเก่ายังอยู่ในนั้น · ถ้าไม่มีตัวย้าย หน้าจอและหน้าเว็บจะอ่านข้อมูลเก่าเพี้ยนแบบเงียบ ๆ
 * - ทุกบล็อกมีฟิลด์ `version` (รุ่น 1 = ก่อนรอบที่ 71 ซึ่ง **ไม่มี** ฟิลด์นี้ในข้อมูล · รุ่นปัจจุบัน = 2)
 *
 * กติกาสำคัญ
 * - **ตัวย้ายเป็นฟังก์ชันบริสุทธิ์บนค่าดิบ (unknown → unknown)** ไม่พึ่ง React/DB ⇒ ทดสอบได้โดยไม่ต้องมีฐานข้อมูล
 * - **ไม่โยน error** : ข้อมูลที่ยังย้ายไม่ได้จะถูกปล่อยผ่าน แล้วให้ `parseBlockDocument()` เป็นคนรายงานว่าใช้ไม่ได้
 * - **ย้ายซ้ำได้ผลเดิม (idempotent)** : เอกสารรุ่นปัจจุบันผ่านตัวย้ายแล้วยังได้ผลเท่าเดิม
 * - ทะเบียนนี้เป็น **ที่เดียว** ที่รู้ว่าแต่ละรุ่นต่างกันอย่างไร — เพิ่มรุ่นใหม่ = เพิ่มคีย์ใน `BLOCK_MIGRATIONS`
 */

export type BlockMigrationRegistry = Readonly<Record<number, (block: Record<string, unknown>) => Record<string, unknown>>>;

/** จำนวนรอบสูงสุดกันลูปไม่รู้จบถ้าทะเบียนเขียนผิด */
const MAX_MIGRATION_STEPS = 10;

/**
 * ทะเบียนตัวย้ายเวอร์ชัน (คีย์ = รุ่นต้นทาง · ผลลัพธ์ต้องเป็นรุ่นถัดไปพร้อม `version` ใหม่เสมอ)
 *
 * รุ่น 1 → 2 (รอบที่ 71): เพิ่มฟิลด์ `version` ให้ทุกบล็อก + รองรับบล็อก `row` (แถว/คอลัมน์)
 * บล็อกชนิดเดิมทั้ง 8 มีรูปทรงเดิม ⇒ รุ่น 1 ไม่ต้องแปลงค่าอื่น เพียงประทับรุ่น
 * (ของที่ซ้อนยังไม่มีในรุ่น 1 ⇒ ตัวย้ายเดินลงไปประทับรุ่นให้บล็อกลูกด้วย เผื่อข้อมูลที่เขียนจากรุ่นถัดไป)
 */
export const BLOCK_MIGRATIONS: BlockMigrationRegistry = {
  [LEGACY_BLOCK_SCHEMA_VERSION]: (block) => ({ ...block, version: BLOCK_SCHEMA_VERSION }),
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** อ่านรุ่นจากค่าดิบ — ไม่มี/ผิดรูป/ติดลบ = ถือเป็นรุ่น 1 (ข้อมูลก่อนมีฟิลด์นี้) */
export function readRawVersion(value: unknown): number {
  if (!isRecord(value)) return LEGACY_BLOCK_SCHEMA_VERSION;
  const version = value["version"];
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) return LEGACY_BLOCK_SCHEMA_VERSION;
  return version;
}

/** รุ่นที่เก่ากว่ารุ่นปัจจุบัน = ยังต้องย้าย */
export function isLegacyVersion(version: number): boolean {
  return version < BLOCK_SCHEMA_VERSION;
}

/**
 * ย้ายบล็อกหนึ่งก้อนจนถึงรุ่นเป้าหมาย (ค่าเริ่มต้น = รุ่นปัจจุบันของโค้ด) โดยไล่ตามทะเบียนทีละรุ่น
 * - รุ่นใหม่กว่ารุ่นเป้าหมาย (ข้อมูลจากโค้ดรุ่นถัดไป) → **ปล่อยผ่านทั้งก้อน** ให้ parse รายงาน
 * - ไม่มีตัวย้ายของรุ่นนั้น → ปล่อยผ่าน (ไม่พยายามเดา)
 * `target` เปิดไว้ให้เทสต์พิสูจน์ได้ว่า "ไล่ทีละรุ่นจริง" (เช่น ทะเบียนปลอม 1→2→3)
 */
export function applyBlockMigrations(
  block: Record<string, unknown>,
  registry: BlockMigrationRegistry = BLOCK_MIGRATIONS,
  target: number = BLOCK_SCHEMA_VERSION,
): Record<string, unknown> {
  let current = block;
  let steps = 0;

  while (steps < MAX_MIGRATION_STEPS) {
    const version = readRawVersion(current);
    if (version >= target) return current;

    const migrate = registry[version];
    if (migrate === undefined) return current;

    const next = migrate(current);
    /* กันทะเบียนที่เขียนผิด (ไม่เลื่อนรุ่น) — คืนของเดิมดีกว่าแขวน */
    if (readRawVersion(next) <= version) return current;

    current = next;
    steps += 1;
  }

  return current;
}

/**
 * ย้าย "ค่าดิบของบล็อกหนึ่งก้อน" (รวมบล็อกลูกที่ซ้อนอยู่ในคอลัมน์)
 * ⚠️ ต้องเดินลงคอลัมน์ด้วย ไม่งั้นบล็อกลูกจะค้างรุ่นเก่า
 */
export function migrateBlockValue(
  raw: unknown,
  registry: BlockMigrationRegistry = BLOCK_MIGRATIONS,
  depth = 0,
): unknown {
  if (!isRecord(raw)) return raw;

  const migrated = applyBlockMigrations(raw, registry);
  const columns = migrated["columns"];
  if (!Array.isArray(columns) || depth >= MAX_BLOCK_DEPTH + 1) return migrated;

  return {
    ...migrated,
    columns: columns.map((column) => {
      if (!isRecord(column)) return column;
      const blocks = column["blocks"];
      if (!Array.isArray(blocks)) return column;
      return { ...column, blocks: blocks.map((child) => migrateBlockValue(child, registry, depth + 1)) };
    }),
  };
}

/**
 * ย้ายค่าดิบของ "เอกสารทั้งหน้า" (ใช้ทั้งตอนอ่านจาก DB/เบราว์เซอร์ และตอนกดปุ่มย้ายเวอร์ชันในหลังบ้าน)
 * ข้อมูลที่ไม่ใช่ออบเจ็กต์/ไม่มี `blocks` = คืนค่าเดิม (ให้ parse เป็นคนบอกว่าใช้ไม่ได้)
 */
export function migrateDocumentValue(raw: unknown, registry: BlockMigrationRegistry = BLOCK_MIGRATIONS): unknown {
  if (!isRecord(raw)) return raw;
  const blocks = raw["blocks"];
  if (!Array.isArray(blocks)) return raw;
  return { ...raw, blocks: blocks.map((block) => migrateBlockValue(block, registry)) };
}

/* ── สรุป "ข้อมูลที่เก็บไว้เป็นรุ่นอะไรบ้าง" (ใช้ในหน้าจอ/เทสต์) ───────────────── */

export type StoredVersionSummary = {
  /** จำนวนบล็อกที่อ่านรุ่นได้ (นับรวมบล็อกที่ซ้อน) */
  readonly total: number;
  /** จำนวนบล็อกที่ยังเป็นรุ่นเก่า (ต้องย้าย) */
  readonly legacy: number;
  /** รุ่นสูงสุดที่เจอ (0 = ยังไม่พบบล็อก) */
  readonly newest: number;
  /** จำนวนบล็อกแยกรายรุ่น (สำหรับแสดงผล) */
  readonly versionCounts: Readonly<Record<string, number>>;
};

const EMPTY_SUMMARY: StoredVersionSummary = { total: 0, legacy: 0, newest: 0, versionCounts: {} };

/**
 * นับรุ่นของบล็อกจากค่าดิบ (อ่านแบบทนทาน — ข้อมูลพังบางก้อนไม่ทำให้ทั้งใบอ่านไม่ได้)
 * ใช้เตือนในหลังบ้านว่า "ข้อมูลที่เก็บไว้ยังเป็นรุ่นเก่า" ซึ่งตัวอ่านยังเปิดได้ (parse ย้ายให้)
 * แต่ควรกดปุ่มย้ายเพื่อให้ข้อมูลสะอาด
 */
export function storedVersionSummary(raw: unknown, depth = 0): StoredVersionSummary {
  if (!isRecord(raw)) return EMPTY_SUMMARY;
  const blocks = raw["blocks"];
  if (!Array.isArray(blocks)) return EMPTY_SUMMARY;

  let total = 0;
  let legacy = 0;
  let newest = 0;
  const versionCounts: Record<string, number> = {};

  const visit = (entries: readonly unknown[], currentDepth: number): void => {
    for (const entry of entries) {
      if (!isRecord(entry)) continue;
      const version = readRawVersion(entry);
      total += 1;
      if (isLegacyVersion(version)) legacy += 1;
      if (version > newest) newest = version;
      const key = String(version);
      versionCounts[key] = (versionCounts[key] ?? 0) + 1;

      const columns = entry["columns"];
      if (!Array.isArray(columns) || currentDepth >= MAX_BLOCK_DEPTH) continue;
      for (const column of columns) {
        if (!isRecord(column)) continue;
        const children = column["blocks"];
        if (Array.isArray(children)) visit(children, currentDepth + 1);
      }
    }
  };

  visit(blocks, depth);
  return { total, legacy, newest, versionCounts };
}

/** จำนวนบล็อกรวมทุกชั้นจากค่าดิบ (ใช้กับการแสดงประวัติ/สถิติ — ไม่ต้อง parse ทั้งใบ) */
export function countRawBlocks(raw: unknown): number {
  return storedVersionSummary(raw).total;
}
