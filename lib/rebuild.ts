import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * สั่ง "สร้างเว็บใหม่" (rebuild) — **ทางเลือกเสริม** หลังกดเผยแพร่
 *
 * ⚠️ ตั้งแต่ X1.7 (รอบที่ 73) หน้าเว็บใช้ **ISR + on-demand revalidate** ⇒ กดเผยแพร่แล้วหน้าเว็บใหม่ทันที
 *    โดยไม่ต้อง build · ตัวนี้จึงถูกเรียก **เฉพาะเมื่อผู้ดูแลตั้ง env ไว้** (โฮสต์ที่ไม่มี ISR เช่น static host)
 *    ดูเงื่อนไขที่ lib/cache/plan.ts (shouldRunRebuild) — ไม่ตั้ง env = ไม่เรียกเลย และหน้าจอบอกว่า "ไม่ต้องรอ build"
 *
 * ผู้ใช้เลือก (รอบที่ 41 / เซสชั่น S1): **ตั้งค่าได้ทั้ง 2 แบบ** */

export const REBUILD_HOOK_URL_VAR = "REBUILD_HOOK_URL";
export const REBUILD_COMMAND_VAR = "REBUILD_COMMAND";

/** เพดานเวลารอ (ms) — เกินนี้ถือว่าไม่สำเร็จ แต่การเผยแพร่ยังนับว่าสำเร็จ */
export const REBUILD_TIMEOUT_MS = 15_000;

export type RebuildMode =
  | { readonly kind: "hook"; readonly url: string }
  | { readonly kind: "command"; readonly command: string }
  | { readonly kind: "manual" };

export type RebuildResult =
  | { readonly kind: "hook-triggered" }
  | { readonly kind: "command-ok" }
  | { readonly kind: "manual" }
  | { readonly kind: "failed"; readonly detail: string };

type EnvLike = Readonly<Record<string, string | undefined>>;

function clean(value: string | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * ตัดสินใจว่าจะใช้วิธีไหน — **hook มาก่อนคำสั่ง** (ผู้ใช้ตั้ง hook ไว้ = ตั้งใจใช้โฮสต์)
 * ฟังก์ชันบริสุทธิ์: รับ env เข้ามา ไม่แตะ process.env เอง ⇒ เทสต์ได้ทุกกรณี
 */
export function resolveRebuildMode(env: EnvLike): RebuildMode {
  const url = clean(env[REBUILD_HOOK_URL_VAR]);
  if (url !== null) return { kind: "hook", url };

  const command = clean(env[REBUILD_COMMAND_VAR]);
  if (command !== null) return { kind: "command", command };

  return { kind: "manual" };
}

export function currentRebuildMode(): RebuildMode {
  return resolveRebuildMode(process.env);
}

/** เรียกใช้จริง — แยก deps เพื่อเทสต์ได้โดยไม่ยิงเน็ต/ไม่รันคำสั่งจริง */
export async function runRebuild(
  deps: {
    readonly mode?: RebuildMode;
    readonly fetchImpl?: typeof fetch;
    readonly execImpl?: (command: string, timeoutMs: number) => Promise<void>;
  } = {},
): Promise<RebuildResult> {
  const mode = deps.mode ?? currentRebuildMode();

  if (mode.kind === "manual") return { kind: "manual" };

  if (mode.kind === "hook") {
    const doFetch = deps.fetchImpl ?? fetch;
    try {
      const response = await doFetch(mode.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: "waiwai-admin", reason: "publish" }),
        signal: AbortSignal.timeout(REBUILD_TIMEOUT_MS),
      });
      if (!response.ok) return { kind: "failed", detail: `hook ตอบกลับสถานะ ${response.status}` };
      return { kind: "hook-triggered" };
    } catch {
      /* ไม่รายงานข้อความ error ดิบ เพราะอาจมี URL/โทเคนปนอยู่ในข้อความ */
      return { kind: "failed", detail: "เรียก hook ไม่สำเร็จ (ตรวจ URL/เครือข่าย/สิทธิ์)" };
    }
  }

  const run = deps.execImpl ?? defaultExec;
  try {
    await run(mode.command, REBUILD_TIMEOUT_MS);
    return { kind: "command-ok" };
  } catch {
    return { kind: "failed", detail: "รันคำสั่งสร้างเว็บใหม่ไม่สำเร็จ (ดู log ของเซิร์ฟเวอร์)" };
  }
}

async function defaultExec(command: string, timeoutMs: number): Promise<void> {
  /* ใช้ shell เพราะคำสั่งตั้งใจให้เป็นบรรทัดคำสั่งเต็ม (มาจาก env ของผู้ดูแลระบบเท่านั้น) */
  await execFileAsync(command, { shell: true, timeout: timeoutMs, windowsHide: true });
}
