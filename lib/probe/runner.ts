/**
 * ตัวช่วยของ `npm run probe:routes` — **ตรรกะบริสุทธิ์** (ไม่มี fetch/DB/เวลา) รอบที่ 292
 *
 * แยกออกมาเพื่อให้เทสต์ได้โดยไม่ต้องมีเซิร์ฟเวอร์รัน (และไม่ทำให้ `main()` ของสคริปต์ถูกเรียกตอน import)
 */

import { probeProblems, selectProbeTargets, type ProbeTarget } from "@/lib/probe/targets";

export const DEFAULT_PROBE_URL = "http://localhost:3000";
export const DEFAULT_PROBE_CONCURRENCY = 4;

export type ProbeOptions = {
  readonly baseUrl: string;
  readonly only: string;
  readonly maintenance: boolean;
  readonly json: boolean;
  /** มินต์เซสชันผู้ดูแลเพื่อยิงเส้นหลังบ้าน (ปิดด้วย `--no-session`) */
  readonly useSession: boolean;
  /** เก็บเซสชันที่มินต์ไว้ (ค่าเริ่มต้น = เพิกถอนทิ้งเมื่อจบ) */
  readonly keepSession: boolean;
  readonly concurrency: number;
};

export type ProbeResult = {
  readonly target: ProbeTarget;
  readonly status: number;
  readonly ms: number;
  readonly problems: readonly string[];
};

/** อ่านตัวเลือกจาก argv (ค่าที่ไม่รู้จัก = โยน error พร้อมข้อความไทย ไม่เงียบ) */
export function parseProbeArgs(argv: readonly string[], env: Record<string, string | undefined> = {}): ProbeOptions {
  let baseUrl = (env.PROBE_URL ?? "").trim() === "" ? DEFAULT_PROBE_URL : (env.PROBE_URL ?? "").trim();
  let only = "";
  let maintenance = false;
  let json = false;
  let useSession = true;
  let keepSession = false;
  let concurrency = DEFAULT_PROBE_CONCURRENCY;

  for (const arg of argv) {
    if (arg.trim() === "") continue;

    if (arg.startsWith("--url=")) {
      baseUrl = arg.slice("--url=".length).trim();
    } else if (arg.startsWith("--only=")) {
      only = arg.slice("--only=".length).trim();
    } else if (arg === "--maintenance") {
      maintenance = true;
    } else if (arg === "--json") {
      json = true;
    } else if (arg === "--no-session") {
      useSession = false;
    } else if (arg === "--keep-session") {
      keepSession = true;
    } else if (arg.startsWith("--concurrency=")) {
      const parsed = Number.parseInt(arg.slice("--concurrency=".length), 10);
      if (!Number.isFinite(parsed) || parsed < 1 || parsed > 16) throw new Error("--concurrency ต้องเป็นจำนวนเต็ม 1–16");
      concurrency = parsed;
    } else {
      throw new Error(`ไม่รู้จักตัวเลือก: ${arg}`);
    }
  }

  if (baseUrl === "") throw new Error("--url= ต้องไม่ว่าง (เช่น --url=http://localhost:3000)");

  return { baseUrl: baseUrl.replace(/\/+$/, ""), only, maintenance, json, useSession, keepSession, concurrency };
}

/** เส้นที่จะยิงจริงตามตัวเลือก (ห่อ `selectProbeTargets` ให้ที่เดียว) */
export function targetsForOptions(options: ProbeOptions): readonly ProbeTarget[] {
  return selectProbeTargets({ only: options.only, maintenance: options.maintenance });
}

/** หน้ารวมผลลัพธ์เป็นบรรทัดเดียว (ใช้พิมพ์และใช้ทดสอบ) */
export function formatProbeLine(result: ProbeResult): string {
  const auth = result.target.admin === true ? "🔐" : "  ";
  const mark = result.problems.length === 0 ? "✓" : "✗";
  const status = String(result.status).padEnd(3);
  const ms = String(result.ms).padStart(5);
  return `${auth} ${mark} ${status} ${ms}ms  ${result.target.url}`;
}

export type ProbeSummary = {
  readonly total: number;
  readonly passed: number;
  readonly failed: readonly ProbeResult[];
  /** จำนวนเส้นที่ต้องใช้เซสชัน แต่ยิงแบบไม่มีเซสชัน (ถูกรายงานแยก ไม่นับเป็นผ่าน) */
  readonly skippedWithoutSession: number;
};

export function summarizeProbeResults(results: readonly ProbeResult[]): ProbeSummary {
  const failed = results.filter((result) => result.problems.length > 0);
  const skippedWithoutSession = results.filter(
    (result) => result.target.admin === true && result.status === 307 && result.target.expect.includes(200),
  ).length;

  return { total: results.length, passed: results.length - failed.length, failed, skippedWithoutSession };
}

/** ตัดสินผลจาก HTTP หนึ่งครั้ง (เรียก `probeProblems` ของทะเบียน — ที่เดียว ไม่เขียนตรรกะซ้ำ) */
export function evaluateProbeResponse(
  target: ProbeTarget,
  response: { readonly status: number; readonly body: string; readonly ms: number },
): ProbeResult {
  return {
    target,
    status: response.status,
    ms: response.ms,
    problems: probeProblems({ status: response.status, body: response.body }, target),
  };
}
