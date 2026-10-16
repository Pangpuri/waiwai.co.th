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
  /** รัน "flow หลายขั้น" (rate limit · เพิกถอนเซสชัน · อัปโหลด · ลิงก์พรีวิว) แทนการยิงเส้นทาง */
  readonly flows: boolean;
  /** ยอมให้ flow รันกับเซิร์ฟเวอร์ที่ไม่ใช่ในเครื่อง (อันตราย — flow เขียนแถวจริง) */
  readonly allowRemote: boolean;
};

export type ProbeResult = {
  readonly target: ProbeTarget;
  readonly status: number;
  readonly ms: number;
  readonly problems: readonly string[];
  /** ผลนี้ได้หลัง **ยิงซ้ำเพราะเจอ 5xx** (dev warm-up) — ต้องรายงาน ไม่ใช่กลืน */
  readonly retriedAfter5xx?: boolean;
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
  let flows = false;
  let allowRemote = false;

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
    } else if (arg === "--flows") {
      flows = true;
    } else if (arg === "--allow-remote") {
      allowRemote = true;
    } else if (arg.startsWith("--concurrency=")) {
      const parsed = Number.parseInt(arg.slice("--concurrency=".length), 10);
      if (!Number.isFinite(parsed) || parsed < 1 || parsed > 16) throw new Error("--concurrency ต้องเป็นจำนวนเต็ม 1–16");
      concurrency = parsed;
    } else {
      throw new Error(`ไม่รู้จักตัวเลือก: ${arg}`);
    }
  }

  if (baseUrl === "") throw new Error("--url= ต้องไม่ว่าง (เช่น --url=http://localhost:3000)");

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    only,
    maintenance,
    json,
    useSession,
    keepSession,
    concurrency,
    flows,
    allowRemote,
  };
}

/** เส้นที่จะยิงจริงตามตัวเลือก (ห่อ `selectProbeTargets` ให้ที่เดียว) */
export function targetsForOptions(options: ProbeOptions): readonly ProbeTarget[] {
  return selectProbeTargets({ only: options.only, maintenance: options.maintenance });
}

/**
 * ควรยิงซ้ำไหมเมื่อได้ 5xx (ปิดหนี้ D-292-1)
 *
 * **dev** ตอบ 500 ได้หนึ่งครั้งสำหรับหน้าที่เพิ่งถูก compile ครั้งแรก (เจอจริงรอบ 292:
 * `/th/products/instant-noodles` = 500 ครั้งแรก → ยิงซ้ำ = 200 · prod ไม่เป็น)
 * ⇒ ยิงซ้ำได้ **หนึ่งครั้ง** แล้วรายงานให้ชัดว่า "ผ่านเพราะยิงซ้ำ" (ไม่กลืนหาย)
 * ⚠️ 5xx ที่ **คาดไว้** (เช่น 503 ของโหมดปิดปรับปรุง) ไม่ต้องยิงซ้ำ
 */
export function shouldRetryAfter5xx(target: ProbeTarget, status: number): boolean {
  return status >= 500 && !target.expect.includes(status);
}

/** หน้ารวมผลลัพธ์เป็นบรรทัดเดียว (ใช้พิมพ์และใช้ทดสอบ) */
export function formatProbeLine(result: ProbeResult): string {
  const auth = result.target.admin === true ? "🔐" : "  ";
  const mark = result.problems.length === 0 ? "✓" : "✗";
  const status = String(result.status).padEnd(3);
  const ms = String(result.ms).padStart(5);
  const retryNote = result.retriedAfter5xx === true ? "  · ยิงซ้ำหลัง 5xx" : "";
  return `${auth} ${mark} ${status} ${ms}ms  ${result.target.url}${retryNote}`;
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
  response: { readonly status: number; readonly body: string; readonly ms: number; readonly retriedAfter5xx?: boolean },
): ProbeResult {
  const problems = probeProblems({ status: response.status, body: response.body }, target);
  const retried = response.retriedAfter5xx === true;

  return {
    target,
    status: response.status,
    ms: response.ms,
    /* ยิงซ้ำแล้วยัง 5xx = พังจริง ไม่ใช่ warm-up ⇒ บอกให้ชัด (กันอ่านผิดว่าเป็นเรื่องชั่วคราว) */
    problems:
      retried && response.status >= 500 && !target.expect.includes(response.status)
        ? [...problems, "ยิงซ้ำแล้วยัง 5xx = พังจริง (ไม่ใช่ dev warm-up)"]
        : problems,
    ...(retried ? { retriedAfter5xx: true } : {}),
  };
}
