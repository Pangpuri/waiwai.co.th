import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readdir, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";

import {
  BACKUP_DIR,
  TOOLS_PREFIX_VAR,
  TOOLS_URL_VAR,
  sanitizeForLog,
  toolCommand,
  toolConnectionArgs,
} from "@/lib/backup/plan";

/**
 * "ตัวเรียกเครื่องมือ Postgres จริง" (X2.3) — **แตะโปรเซส/ดิสก์** (ตรรกะบริสุทธิ์อยู่ที่ `plan.ts`)
 *
 * ทำไมต้องมีชั้นนี้
 * - เครื่อง dev ของโปรเจกต์ **ไม่มี `pg_dump` ติดตั้ง** (มีแต่ในกล่อง Docker) ⇒ ต้องสั่งผ่าน `docker exec`
 *   ⇒ ใช้ env `DB_TOOLS_PREFIX` เป็น "คำสั่งนำหน้า" (บนเซิร์ฟเวอร์จริงไม่ต้องตั้ง)
 * - **ห้ามใช้ shell** (ไม่ตั้ง `shell: true`) ⇒ อาร์กิวเมนต์ไม่ถูกตีความ ⇒ ต่อให้ค่า env มีอักขระพิเศษ
 *   ก็ไม่กลายเป็นคำสั่งที่สอง (กันช่องโหว่ command injection)
 * - ใช้ **stream** ไม่ใช่ `execFile` + buffer ⇒ ไฟล์สำรองขนาดใหญ่ (มี bytea ของภาพ/เรซูเม่) ไม่ล้นหน่วยความจำ
 *
 * ความปลอดภัยของรหัสผ่าน
 * - `DATABASE_URL` ถูกส่งเป็น "อาร์กิวเมนต์" (`--dbname=...`) ⇒ **ไม่ปรากฏใน process list ของ shell**
 *   (แต่ยังเห็นได้ใน process list ของเครื่องนี้ — ยอมรับได้เท่ากับ `pg_dump "$DATABASE_URL"` ตามปกติ)
 * - ข้อความ error ทุกข้อความผ่าน `sanitizeForLog()` ⇒ **รหัสผ่านไม่หลุดลง log**
 */

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

export type ToolResult = {
  readonly stdout: string;
  readonly stderr: string;
};

export type DumpResult = {
  readonly filePath: string;
  readonly bytes: number;
  /** sha256 ของไฟล์ — ใช้ยืนยันว่าไฟล์ที่กู้คืนคือก้อนเดียวกัน */
  readonly sha256: string;
};

export function toolsPrefix(): string | undefined {
  const value = process.env[TOOLS_PREFIX_VAR];
  return value === undefined || value.trim() === "" ? undefined : value;
}

export function toolsUrl(): string | undefined {
  const value = process.env[TOOLS_URL_VAR];
  return value === undefined || value.trim() === "" ? undefined : value;
}

/**
 * อาร์กิวเมนต์ "ต่อฐานข้อมูลไหน" ตามสภาพแวดล้อม (ดู `toolConnectionArgs` ใน plan.ts)
 * ⚠️ ในโหมดกล่อง Docker จะ **ไม่ส่งรหัสผ่าน** — ต่อผ่าน socket ที่ไว้ใจได้ในกล่อง
 */
export function connectionArgsFor(databaseUrl: string): readonly string[] {
  return toolConnectionArgs(databaseUrl, { prefix: toolsPrefix(), toolsUrl: toolsUrl() });
}

/** รัน `psql` กับฐานข้อมูลผู้ดูแล (ใช้สร้าง/ลบฐานข้อมูลชั่วคราว) */
export async function psqlAdmin(maintenanceUrl: string, sql: string): Promise<void> {
  await runTool("psql", [...connectionArgsFor(maintenanceUrl), "-v", "ON_ERROR_STOP=1", "-q", "-c", sql]);
}

/** ข้อความช่วยเหลือเมื่อหาเครื่องมือไม่เจอ — บอกทางออกทั้งเครื่อง dev และเซิร์ฟเวอร์จริง */
export function missingToolHint(tool: string): string {
  return (
    `ไม่พบคำสั่ง "${tool}"\n` +
    "  • เครื่อง dev ของโปรเจกต์: Postgres อยู่ในกล่อง Docker ⇒ ใส่ใน .env.local ว่า\n" +
    `      ${TOOLS_PREFIX_VAR}=docker exec -i waiwai-pg\n` +
    "  • เซิร์ฟเวอร์จริง: ติดตั้ง postgresql-client (ให้มี pg_dump/pg_restore/psql) แล้วไม่ต้องตั้งอะไร\n"
  );
}

/** รันเครื่องมือหนึ่งครั้งแล้วคืน stdout/stderr (โยน error พร้อมข้อความที่ซ่อนรหัสผ่าน) */
export async function runTool(
  tool: string,
  args: readonly string[],
  options: { readonly input?: string; readonly timeoutMs?: number } = {},
): Promise<ToolResult> {
  const command = toolCommand(tool, args, toolsPrefix());
  const [bin, ...rest] = command;
  if (bin === undefined) throw new Error(`ชื่อคำสั่งว่างเปล่า — ตรวจ ${TOOLS_PREFIX_VAR}`);

  return await new Promise<ToolResult>((resolve, reject) => {
    const child = spawn(bin, rest, { stdio: ["pipe", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      reject(new Error(`${tool} ใช้เวลานานเกิน ${Math.round((options.timeoutMs ?? DEFAULT_TIMEOUT_MS) / 1000)} วินาที — ยกเลิก`));
    }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    child.on("error", (error: NodeJS.ErrnoException) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error.code === "ENOENT") {
        reject(new Error(missingToolHint(tool)));
        return;
      }
      reject(new Error(`${tool} เรียกไม่สำเร็จ: ${sanitizeForLog(error.message)}`));
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(
        new Error(`${tool} ออกด้วยรหัส ${String(code)}\n${sanitizeForLog(stderr.trim() || stdout.trim())}`),
      );
    });

    if (options.input !== undefined) child.stdin.write(options.input);
    child.stdin.end();
  });
}

/** สร้างโฟลเดอร์เก็บไฟล์สำรอง (ถ้ามีอยู่แล้วไม่เป็นไร) แล้วคืนพาธ */
export async function ensureBackupDir(root = process.cwd()): Promise<string> {
  const dir = join(root, BACKUP_DIR);
  await mkdir(dir, { recursive: true });
  return dir;
}

/** รายชื่อไฟล์ในโฟลเดอร์สำรอง (โฟลเดอร์ยังไม่มี = คืนลิสต์ว่าง ไม่โยน error) */
export async function listBackupFiles(root = process.cwd()): Promise<readonly string[]> {
  try {
    const entries = await readdir(join(root, BACKUP_DIR), { withFileTypes: true });
    return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  } catch {
    return [];
  }
}

export async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * เขียนผลลัพธ์ของเครื่องมือลงไฟล์แบบ stream แล้วคืนขนาด + ลายนิ้วมือ
 *
 * ⚠️ **ล้มเหลว = ลบไฟล์ทิ้งเสมอ** (เคสจริง 2026-10-03: รอบแรกที่ `pg_dump` ต่อฐานข้อมูลไม่ได้
 *    ทิ้งไฟล์ 0 ไบต์ไว้ใน `backups/` ⇒ ดูเหมือน "มีไฟล์สำรอง" ทั้งที่ไม่มีข้อมูล — ความมั่นใจปลอม)
 *    และถ้าเขียนได้ 0 ไบต์ทั้งที่คำสั่ง "สำเร็จ" ก็ถือว่าล้มเหลวเช่นกัน
 */
async function writeStreamToFile(
  tool: string,
  args: readonly string[],
  filePath: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<DumpResult> {
  const command = toolCommand(tool, args, toolsPrefix());
  const [bin, ...rest] = command;
  if (bin === undefined) throw new Error(`ชื่อคำสั่งว่างเปล่า — ตรวจ ${TOOLS_PREFIX_VAR}`);

  await new Promise<void>((resolve, reject) => {
    const child = spawn(bin, rest, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      reject(new Error(`${tool} ใช้เวลานานเกิน ${Math.round(timeoutMs / 1000)} วินาที — ยกเลิก`));
    }, timeoutMs);

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    child.on("error", (error: NodeJS.ErrnoException) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error.code === "ENOENT" ? new Error(missingToolHint(tool)) : error);
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`${tool} ออกด้วยรหัส ${String(code)}\n${sanitizeForLog(stderr.trim())}`));
    });

    if (child.stdout === null) {
      reject(new Error(`${tool}: อ่าน stdout ไม่ได้`));
      return;
    }
    child.stdout.pipe(createWriteStream(filePath));
  }).catch(async (error: unknown) => {
    /* ล้มเหลว = ห้ามทิ้งไฟล์ครึ่ง ๆ ไว้ให้เข้าใจผิดว่าเป็นไฟล์สำรอง */
    await unlink(filePath).catch(() => undefined);
    throw error;
  });

  const info = await stat(filePath);
  if (info.size === 0) {
    await unlink(filePath).catch(() => undefined);
    throw new Error(`${tool} เขียนไฟล์ได้ 0 ไบต์ — ถือว่าล้มเหลว และลบไฟล์ทิ้งแล้ว`);
  }

  return { filePath, bytes: info.size, sha256: await sha256OfFile(filePath) };
}

/** `pg_dump` แบบ custom format → ไฟล์ (stream ทั้งเส้น ไม่กินหน่วยความจำ) */
export async function dumpToFile(databaseUrl: string, filePath: string): Promise<DumpResult> {
  return await writeStreamToFile(
    "pg_dump",
    ["--format=custom", "--no-owner", "--no-privileges", ...connectionArgsFor(databaseUrl)],
    filePath,
  );
}

/** `pg_restore` จากไฟล์เข้า base ปลายทาง (อ่านไฟล์เป็น stream ป้อนเข้า stdin) */
export async function restoreFromFile(filePath: string, targetUrl: string): Promise<void> {
  const command = toolCommand(
    "pg_restore",
    ["--no-owner", "--no-privileges", ...connectionArgsFor(targetUrl)],
    toolsPrefix(),
  );
  const [bin, ...rest] = command;
  if (bin === undefined) throw new Error(`ชื่อคำสั่งว่างเปล่า — ตรวจ ${TOOLS_PREFIX_VAR}`);

  const child = spawn(bin, rest, { stdio: ["pipe", "pipe", "pipe"] });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });

  const finished = new Promise<void>((resolve, reject) => {
    child.on("error", (error: NodeJS.ErrnoException) => {
      reject(error.code === "ENOENT" ? new Error(missingToolHint("pg_restore")) : error);
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`pg_restore ออกด้วยรหัส ${String(code)}\n${sanitizeForLog(stderr.trim())}`));
    });
  });

  if (child.stdin === null) throw new Error("pg_restore: เขียน stdin ไม่ได้");

  /*
    ⚠️ รอบที่ 114 — บทเรียนจริง: เดิมโค้ดนี้ `await pipeline(...)` **ก่อน** `await finished`
    ⇒ ถ้าเครื่องมือ "ตายทันที" (เช่นต่อฐานข้อมูลปลายทางไม่ได้ เพราะส่งค่าเชื่อมต่อผิด)
      การเขียนไฟล์ลง stdin จะล้มด้วย `write EPIPE` ก่อน ⇒ ผู้ใช้เห็นแต่ EPIPE **ไม่เห็นสาเหตุจริง**
      (เคสจริง: ดันข้อมูลขึ้น Neon แล้วเห็นแค่ EPIPE — ต้องมานั่งไล่เองว่าจริง ๆ คือต่อฐานข้อมูลไม่ได้)
    ⇒ รอ "ทั้งสองฝั่ง" พร้อมกัน แล้วเลือกโยน error ที่ **มีข้อความจากเครื่องมือ (stderr)** ก่อนเสมอ
  */
  const writeFailure = pipeline(createReadStream(filePath), child.stdin).then(
    () => null,
    (error: unknown) => (error instanceof Error ? error : new Error(String(error))),
  );
  const exitFailure = finished.then(
    () => null,
    (error: unknown) => (error instanceof Error ? error : new Error(String(error))),
  );

  const [pipeError, toolError] = await Promise.all([writeFailure, exitFailure]);

  if (toolError !== null) throw toolError;
  if (pipeError !== null) throw pipeError;
}

export async function sha256OfFile(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  await pipeline(createReadStream(filePath), hash);
  return hash.digest("hex");
}
