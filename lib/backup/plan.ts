import { describeRetention } from "@/lib/retention/format";
import { retentionDaysFor } from "@/lib/retention/plan";

/**
 * ตรรกะบริสุทธิ์ของ "แบ็กอัป/กู้คืน" (X2.3) — **ไม่มี I/O ไม่มี Next ไม่มี env**
 *
 * ทำไมแยกเป็นไฟล์นี้
 * - ชื่อไฟล์/การเลือกไฟล์ล่าสุด/การเทียบสองฐานข้อมูล = ความคิด ไม่ใช่การรันคำสั่ง ⇒ ทดสอบได้ตรง ๆ
 * - การเรียก `pg_dump`/`pg_restore` จริงอยู่ใน `lib/backup/tools.ts` (ไฟล์นั้นแตะโปรเซส/ดิสก์)
 *
 * มติที่เกี่ยวข้อง
 * - **D11:** ไฟล์ภาพและเรซูเม่เก็บเป็น `bytea` ในฐานข้อมูล ⇒ `pg_dump` ก้อนเดียวพาทุกอย่างไป
 *   (ไม่ต้องสำรองโฟลเดอร์อัปโหลดแยก) — นี่คือเหตุผลที่การทดสอบกู้คืนมีความหมายจริง
 * - **D5/Q21:** แผนจริงของเจ้าของคือ backup → Docker → ย้ายไปเซิร์ฟเวอร์ที่เช่าเอง
 *   ⇒ "แบ็กอัปที่ไม่เคยทดสอบ = ไม่มีแบ็กอัป" ต้องปิดก่อนย้ายข้อมูล
 */

/** โฟลเดอร์เก็บไฟล์สำรอง — **ต้องอยู่ใน .gitignore** (มีข้อมูลส่วนบุคคลของผู้ติดต่อ/ผู้สมัครงาน) */
export const BACKUP_DIR = "backups";
export const BACKUP_EXTENSION = ".dump";

/**
 * "ลายนิ้วมือ ณ เวลาที่สำรอง" — เขียนคู่กับไฟล์ .dump ตอน `db:backup`
 *
 * ทำไมต้องมี (เคสจริง 2026-10-03 รอบที่ 75)
 *   ตอนแรก `check:restore` เทียบข้อมูลที่กู้คืนกับ **ต้นทางปัจจุบัน** — ปรากฏว่า "ไม่ผ่าน" ทั้งที่ไฟล์ดี
 *   เพราะมีสคริปต์อื่น (`check:db`) เขียนข้อมูลลงต้นทางหลังจากที่สำรองไปแล้ว
 *   ⇒ การเทียบกับต้นทางปัจจุบัน **เชื่อถือไม่ได้** ถ้าต้นทางถูกแก้หลังเวลาสำรอง
 *   ⇒ ต้องเทียบกับ "สิ่งที่ต้นทางมีตอนนั้น" ซึ่งบันทึกไว้ตอนสำรอง = manifest ไฟล์นี้
 */
export const MANIFEST_EXTENSION = ".manifest.json";
export const MANIFEST_VERSION = 1;

export type BackupManifest = {
  readonly version: typeof MANIFEST_VERSION;
  readonly database: string;
  /** เวลาที่สำรอง (ISO) */
  readonly takenAt: string;
  readonly dumpBytes: number;
  readonly dumpSha256: string;
  /** สถิติของทุกตาราง ณ เวลาที่สำรอง */
  readonly tables: readonly TableStat[];
};

export function manifestPathFor(dumpPath: string): string {
  return `${dumpPath}${MANIFEST_EXTENSION}`;
}

/** อ่าน manifest ที่ไม่รู้จัก/เพี้ยน = null (ห้ามเดา — ไฟล์นี้คือหลักฐาน) */
export function parseManifest(raw: unknown): BackupManifest | null {
  if (typeof raw !== "object" || raw === null) return null;
  const value = raw as Record<string, unknown>;

  if (value["version"] !== MANIFEST_VERSION) return null;
  if (typeof value["database"] !== "string") return null;
  if (typeof value["takenAt"] !== "string" || Number.isNaN(new Date(value["takenAt"]).getTime())) return null;
  if (typeof value["dumpBytes"] !== "number" || !Number.isFinite(value["dumpBytes"])) return null;
  if (typeof value["dumpSha256"] !== "string" || value["dumpSha256"].length === 0) return null;
  if (!Array.isArray(value["tables"])) return null;

  const tables: TableStat[] = [];
  for (const entry of value["tables"]) {
    if (typeof entry !== "object" || entry === null) return null;
    const row = entry as Record<string, unknown>;
    if (typeof row["table"] !== "string") return null;
    if (typeof row["rows"] !== "number" || !Number.isFinite(row["rows"])) return null;
    const digest = row["digest"];
    if (digest !== null && typeof digest !== "string") return null;
    tables.push({ table: row["table"], rows: row["rows"], digest: digest ?? null });
  }

  return {
    version: MANIFEST_VERSION,
    database: value["database"],
    takenAt: value["takenAt"],
    dumpBytes: value["dumpBytes"],
    dumpSha256: value["dumpSha256"],
    tables,
  };
}

/**
 * ฐานข้อมูลชั่วคราวที่ใช้ทดสอบกู้คืน — ตั้งชื่อตามฐานข้อมูลต้นทาง
 * ⇒ รันทดสอบของสองโปรเจกต์บนเซิร์ฟเวอร์เดียวกันได้โดยไม่ชนกัน
 *
 * - `restore` ปลายทางที่กู้คืนไฟล์สำรองจริง
 * - `empty`   ฐานเปล่า (ใช้พิสูจน์ว่าตัวเทียบ "เห็น" ความต่างจริง)
 * - `binary`  ปลายทางของชุดทดสอบไฟล์ไบนารี (bytea) — ดู `BINARY_FIXTURE_TABLE`
 */
export function scratchNamesFor(databaseName: string): {
  readonly restore: string;
  readonly empty: string;
  readonly binary: string;
} {
  const safe = databaseName.replace(/[^a-z0-9_]/gi, "_").toLowerCase();
  return {
    restore: `${safe}_restore_check`,
    empty: `${safe}_restore_empty`,
    binary: `${safe}_restore_binary`,
  };
}

/**
 * ชุดทดสอบ "ไฟล์ไบนารีรอดการสำรอง/กู้คืนไหม" (มติ D11)
 *
 * ทำไมต้องมีทั้งที่เทียบข้อมูลจริงอยู่แล้ว
 * - วันนี้ตาราง `media`/`form_attachment` **มี 0 แถว** ⇒ การเทียบข้อมูลจริงไม่ได้พิสูจน์เส้นทาง bytea เลย
 *   (ผ่านทั้งที่ยังไม่เคยทดสอบสิ่งที่สำคัญที่สุด = ความมั่นใจปลอม)
 * - ชุดนี้สร้างตารางชั่วคราวใน **ฐานข้อมูลชั่วคราวเท่านั้น** (ไม่แตะฐานข้อมูลจริง) แล้ว:
 *   เขียนไบต์ที่รู้ค่า → `pg_dump` → `pg_restore` → เทียบ `md5(ไบต์)` ปลายทางกับต้นฉบับที่คำนวณในโปรเซส
 */
export const BINARY_FIXTURE_TABLE = "backup_binary_fixture";
export const BINARY_FIXTURE_BYTES = 256 * 1024;

/** ชื่อไฟล์สำรองจากเวลา — `waiwai-20261003-021500.dump` (เรียงตามชื่อ = เรียงตามเวลา) */
export function backupFileName(at: Date, databaseName = "waiwai"): string {
  const pad = (value: number): string => String(value).padStart(2, "0");
  const stamp =
    `${at.getUTCFullYear()}${pad(at.getUTCMonth() + 1)}${pad(at.getUTCDate())}` +
    `-${pad(at.getUTCHours())}${pad(at.getUTCMinutes())}${pad(at.getUTCSeconds())}`;
  const safe = databaseName.replace(/[^a-z0-9_]/gi, "_").toLowerCase();
  return `${safe}-${stamp}${BACKUP_EXTENSION}`;
}

/**
 * อ่านเวลากลับจากชื่อไฟล์ (ไม่ตรงรูปแบบ = null — ห้ามเดา)
 *
 * ตรวจแบบ **round-trip**: สร้างวันที่แล้วแปลงกลับเป็นตัวเลขชุดเดิม ต้องได้เหมือนเดิม
 * ⇒ กันวันที่ที่เป็นไปไม่ได้ เช่นเดือน 13 หรือวันที่ 40 (ซึ่ง `Date` จะ "เลื่อน" ให้เงียบ ๆ)
 */
export function parseBackupFileName(name: string): Date | null {
  const match = /^[a-z0-9_]+-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})\.dump$/i.exec(name.trim());
  if (match === null) return null;

  const [, year, month, day, hour, minute, second] = match;
  const at = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)),
  );
  if (Number.isNaN(at.getTime())) return null;

  const pad = (value: number): string => String(value).padStart(2, "0");
  const roundTrip =
    `${at.getUTCFullYear()}${pad(at.getUTCMonth() + 1)}${pad(at.getUTCDate())}` +
    `-${pad(at.getUTCHours())}${pad(at.getUTCMinutes())}${pad(at.getUTCSeconds())}`;
  return roundTrip === `${year}${month}${day}-${hour}${minute}${second}` ? at : null;
}

export function isBackupFileName(name: string): boolean {
  return parseBackupFileName(name) !== null;
}

/** ไฟล์สำรองล่าสุดจากรายชื่อ (ไม่รู้จักรูปแบบ = ข้าม · ไม่มีเลย = null) */
export function pickLatestBackup(names: readonly string[]): string | null {
  let bestName: string | null = null;
  let bestTime = Number.NEGATIVE_INFINITY;

  for (const name of names) {
    const at = parseBackupFileName(name);
    if (at === null) continue;
    // ชื่อไฟล์ซ้ำเวลาเดียวกันได้ (รันสองครั้งในวินาทีเดียว) — เลือกตัวที่ชื่อมากกว่าเพื่อให้ผลคงที่
    if (at.getTime() > bestTime || (at.getTime() === bestTime && bestName !== null && name > bestName)) {
      bestTime = at.getTime();
      bestName = name;
    }
  }

  return bestName;
}

/* ── เครื่องมือ CLI ของ Postgres ─────────────────────────────────────────────── */

export const TOOLS_PREFIX_VAR = "DB_TOOLS_PREFIX";

/**
 * คำสั่งนำหน้าเครื่องมือ Postgres — มีไว้เพื่อให้ใช้ "เครื่องมือในกล่อง Docker" ตอนพัฒนาในเครื่อง
 *   ในเครื่อง dev:  DB_TOOLS_PREFIX=docker exec -i waiwai-pg   (เพราะเครื่องไม่มี pg_dump ติดตั้ง)
 *   บนเซิร์ฟเวอร์จริง: ไม่ต้องตั้งเลย (ติดตั้ง postgresql-client แล้วเรียก `pg_dump` ตรง ๆ)
 *
 * หมายเหตุความปลอดภัย: เราไม่ใช้ shell (spawn โดยไม่ตั้ง `shell: true`) ⇒ ค่าใน env นี้ถูกใช้เป็น
 * "รายการอาร์กิวเมนต์" ไม่ใช่สคริปต์ ⇒ ไม่มีการตีความอักขระพิเศษของ shell
 */
export function splitToolPrefix(prefix: string | undefined): readonly string[] {
  if (prefix === undefined) return [];
  return prefix
    .trim()
    .split(/\s+/)
    .filter((part) => part !== "");
}

/** ประกอบคำสั่งเต็ม: [คำสั่งนำหน้า] + เครื่องมือ + อาร์กิวเมนต์ */
export function toolCommand(tool: string, args: readonly string[], prefix: string | undefined): readonly string[] {
  return [...splitToolPrefix(prefix), tool, ...args];
}

/* ── URL ของฐานข้อมูล ──────────────────────────────────────────────────────── */

/** ชื่อฐานข้อมูลจาก connection string (`null` = อ่านไม่ได้ — ห้ามเดา) */
export function databaseNameOf(url: string): string | null {
  try {
    const parsed = new URL(url);
    const name = parsed.pathname.replace(/^\//, "").trim();
    return name === "" ? null : decodeURIComponent(name);
  } catch {
    return null;
  }
}

/**
 * connection string เดียวกัน แต่เปลี่ยนชื่อฐานข้อมูล
 * - คงผู้ใช้/รหัสผ่าน/host/พอร์ต/พารามิเตอร์เดิม (ใช้สร้าง/ตรวจฐานข้อมูลชั่วคราว)
 * - ⚠️ ค่าที่คืนยัง **มีรหัสผ่าน** ⇒ ห้ามพิมพ์ลงจอ/ล็อก ใช้ `sanitizeForLog()` เมื่อต้องแสดง
 */
export function withDatabaseName(url: string, databaseName: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${encodeURIComponent(databaseName)}`;
  return parsed.toString();
}

/** ข้อความที่ปลอดภัยต่อการพิมพ์ — ซ่อนรหัสผ่านเสมอ (เคสจริง: log ที่มีรหัสผ่านติดไปกับ ticket) */
export function sanitizeForLog(value: string): string {
  return value.replace(/:\/\/([^:@/]+):[^@/]*@/g, "://$1:***@");
}

/** ชื่อผู้ใช้จาก connection string (`null` = ไม่ได้ระบุ) */
export function databaseUserOf(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.username === "" ? null : decodeURIComponent(parsed.username);
  } catch {
    return null;
  }
}

export const TOOLS_URL_VAR = "DB_TOOLS_URL";

/**
 * อาร์กิวเมนต์บอกเครื่องมือว่า "ต่อฐานข้อมูลไหน" — **ต่างกันตามที่เครื่องมืออยู่**
 *
 * 1. ตั้ง `DB_TOOLS_URL` → ใช้ค่านั้น (ควบคุมเองเต็มที่ — เผื่อกรณี host พอร์ตคนละแบบ)
 * 2. ตั้ง `DB_TOOLS_PREFIX` (เครื่องมืออยู่ในกล่อง Docker) → ต่อผ่าน **host เริ่มต้นของเครื่องมือ** (unix socket)
 *    ด้วยชื่อผู้ใช้/ชื่อฐานข้อมูลที่แกะจาก `DATABASE_URL`
 *    ⇒ เครื่อง dev ไม่ต้องใส่รหัสผ่านซ้ำ และไม่ต้องรู้ว่าในกล่องฟังพอร์ตไหน
 *    (ของจริง: `localhost:55432` ใช้ได้จากเครื่อง host แต่ในกล่องคือ `5432` ⇒ ใช้ socket แทนการเดาพอร์ต)
 * 3. ไม่ตั้งอะไร (เซิร์ฟเวอร์จริง) → ใช้ `DATABASE_URL` ตรง ๆ
 */
export function toolConnectionArgs(
  databaseUrl: string,
  env: { readonly prefix?: string | undefined; readonly toolsUrl?: string | undefined },
): readonly string[] {
  if (env.toolsUrl !== undefined && env.toolsUrl.trim() !== "") {
    return [`--dbname=${env.toolsUrl.trim()}`];
  }

  if (splitToolPrefix(env.prefix).length > 0) {
    const user = databaseUserOf(databaseUrl);
    const name = databaseNameOf(databaseUrl);
    const args: string[] = [];
    if (user !== null) args.push(`--username=${user}`);
    if (name !== null) args.push(`--dbname=${name}`);
    return args;
  }

  return [`--dbname=${databaseUrl}`];
}

/* ── ผลการเทียบสองฐานข้อมูล ─────────────────────────────────────────────────── */

export type TableStat = {
  readonly table: string;
  /** จำนวนแถว */
  readonly rows: number;
  /** ลายนิ้วมือของเนื้อหาในตาราง (`null` = คำนวณไม่ได้ เช่นตารางใหญ่เกิน) */
  readonly digest: string | null;
};

export type TableDiff = {
  readonly table: string;
  readonly kind: "missing-in-target" | "missing-in-source" | "rows" | "content";
  readonly source: string;
  readonly target: string;
};

export function diffTables(source: readonly TableStat[], target: readonly TableStat[]): readonly TableDiff[] {
  const sourceMap = new Map(source.map((stat) => [stat.table, stat]));
  const targetMap = new Map(target.map((stat) => [stat.table, stat]));
  const names = [...new Set([...sourceMap.keys(), ...targetMap.keys()])].sort();

  const diffs: TableDiff[] = [];
  for (const table of names) {
    const left = sourceMap.get(table);
    const right = targetMap.get(table);

    if (left === undefined) {
      diffs.push({ table, kind: "missing-in-source", source: "-", target: `${right?.rows ?? 0} แถว` });
      continue;
    }
    if (right === undefined) {
      diffs.push({ table, kind: "missing-in-target", source: `${left.rows} แถว`, target: "-" });
      continue;
    }
    if (left.rows !== right.rows) {
      diffs.push({ table, kind: "rows", source: `${left.rows} แถว`, target: `${right.rows} แถว` });
      continue;
    }
    /* จำนวนแถวเท่ากันแต่เนื้อหาต่าง = เคสที่อันตรายที่สุด (กู้คืนได้ครึ่งเดียว) ⇒ เทียบลายนิ้วมือด้วย */
    if (left.digest !== null && right.digest !== null && left.digest !== right.digest) {
      diffs.push({ table, kind: "content", source: left.digest.slice(0, 10), target: right.digest.slice(0, 10) });
    }
  }

  return diffs;
}

/** ข้อความสรุปผลการเทียบสำหรับพิมพ์บนจอ/ในบันทึก (ภาษาไทย เพราะเป็นเครื่องมือของผู้ดูแล) */
export function describeDiffCount(diffs: readonly TableDiff[], comparedTables: number): string {
  if (diffs.length === 0) return `${comparedTables} ตารางตรงกันทั้งหมด (จำนวนแถว + เนื้อหา)`;
  const labels: Readonly<Record<TableDiff["kind"], string>> = {
    "missing-in-target": "หายไปจากปลายทาง",
    "missing-in-source": "มีเกินมาในปลายทาง",
    rows: "จำนวนแถวไม่เท่า",
    content: "เนื้อหาไม่ตรง",
  };
  return diffs.map((diff) => `${diff.table}: ${labels[diff.kind]} (${diff.source} → ${diff.target})`).join(" · ");
}

/**
 * บรรทัดสรุประยะเก็บไว้เตือนในบันทึกสำรอง
 * ⚠️ ดึงตัวเลขจาก `lib/retention/plan.ts` เท่านั้น — ห้ามพิมพ์ "1 ปี"/"6 เดือน" เองในไฟล์นี้
 */
export function backupRetentionNote(): string {
  const contact = describeRetention(retentionDaysFor("contact"), "th");
  const careers = describeRetention(retentionDaysFor("careers"), "th");
  return `ข้อมูลส่วนบุคคลในไฟล์สำรอง: ติดต่อ/ข่าวสาร ${contact} · ใบสมัครงาน ${careers} (นโยบายใน lib/retention/plan.ts)`;
}
