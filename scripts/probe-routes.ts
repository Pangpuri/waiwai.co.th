import {
  MAINTENANCE_BYPASS_COOKIE,
  createMaintenanceBypassToken,
  nextMaintenanceBypassExpiry,
} from "@/lib/maintenance/bypass";
import { SESSION_COOKIE_NAME, isSecretUsable } from "@/lib/auth/session";
import {
  evaluateProbeResponse,
  formatProbeLine,
  parseProbeArgs,
  shouldRetryAfter5xx,
  summarizeProbeResults,
  targetsForOptions,
  type ProbeOptions,
  type ProbeResult,
} from "@/lib/probe/runner";
import { runProbeFlows } from "./probe-flows.ts";
import { mintProbeSession, releaseProbeSession, type ProbeSession } from "./probe-session.ts";
import type { ProbeTarget } from "@/lib/probe/targets";

/**
 * `npm run probe:routes` (รอบที่ 292 · ปิดหนี้ D-291-1 · ต่อ flow ในรอบที่ 293)
 *
 * ยิง **HTTP จริง** ใส่เซิร์ฟเวอร์ที่รันอยู่ (dev/prod/เดโม) เพื่อจับบั๊กที่ด่านอัตโนมัติมองไม่เห็น:
 * สถานะผิด · HTTP 500 · หน้าที่พังเพราะพารามิเตอร์ (ซ้ำ/ขยะ/NUL) · เส้นที่ควร 404 แล้วโผล่กลับมา
 *
 * ## วิธีใช้
 * ```bash
 * npm run probe:routes                                    # ยิง localhost:3000 (149+ เส้นทาง)
 * npm run probe:routes -- --url=http://localhost:3001      # ยิงเซิร์ฟเวอร์อื่น (เช่น prod ที่ build แล้ว)
 * npm run probe:routes -- --only=/admin/media              # เจาะเฉพาะเส้นที่สนใจ
 * npm run probe:routes -- --maintenance                    # ชุดของโหมดปิดปรับปรุง (ต้องเปิดโหมดอยู่)
 * npm run probe:routes -- --flows                          # flow หลายขั้น (เฉพาะเซิร์ฟเวอร์ในเครื่อง)
 * npm run probe:routes -- --flows --only=upload-guard       # flow เดียว
 * npm run probe:routes -- --no-session --json               # เฉพาะเส้นสาธารณะ + ผลเป็น JSON
 * ```
 *
 * ## สัญญาความปลอดภัย (สำคัญ)
 * - **ไม่ใช้รหัสผ่านของเจ้าของ** — มินต์เซสชันผู้ดูแลด้วยโค้ดของโปรเจกต์เอง (`SESSION_SECRET` + ตาราง `admin_session`)
 *   แล้ว **เพิกถอนทิ้งเมื่อจบ** (เว้นแต่สั่ง `--keep-session`)
 * - **ไม่พิมพ์ค่าคุกกี้/รหัสลับใด ๆ** ออกทาง stdout (มีเทสต์สแกนกันไว้)
 * - **การยิงเส้นทาง = อ่านล้วน** · ส่วน `--flows` **เขียนแถวจริง** (เซสชัน/ความพยายามล็อกอิน/ภาพทดสอบ/ลิงก์พรีวิว)
 *   ⇒ อนุญาตเฉพาะเซิร์ฟเวอร์ในเครื่อง เว้นแต่สั่ง `--allow-remote` อย่างตั้งใจ · ทุก flow เก็บกวาดของตัวเอง
 * - ต่อเซิร์ฟเวอร์ไม่ได้ = **ข้ามอย่างเปิดเผย** (บอกเหตุผล ไม่เงียบ ไม่รายงานว่าผ่าน)
 */

/** รอก่อนยิงซ้ำเมื่อเจอ 5xx (dev warm-up) — สั้นพอไม่ให้ช้าลงอย่างมีนัยสำคัญ */
const RETRY_DELAY_MS = 400;

/**
 * ออก "บัตรผ่านดูเว็บระหว่างปิดปรับปรุง" (`waiwai_maint_bypass` · TTL 15 นาที)
 *
 * ⚠️ คนละคุกกี้กับเซสชันหลังบ้าน — proxy อ่าน DB ไม่ได้ จึงตรวจแค่ลายเซ็น+อายุของบัตรใบนี้
 * ลำดับ: ① ใช้เส้นทางจริง `POST /admin/bypass` (พิสูจน์ตัวออกบัตรด้วย) ② ถ้าไม่ได้ ค่อยมินต์เองในเครื่อง
 */
async function issueBypassCookie(baseUrl: string, sessionCookie: string | null): Promise<{ value: string; source: string } | null> {
  if (sessionCookie !== null) {
    try {
      const response = await fetch(`${baseUrl}/admin/bypass`, {
        method: "POST",
        redirect: "manual",
        headers: { cookie: `${SESSION_COOKIE_NAME}=${sessionCookie}` },
      });
      const raw = response.headers.getSetCookie().find((entry) => entry.startsWith(`${MAINTENANCE_BYPASS_COOKIE}=`));
      const value = raw?.slice(`${MAINTENANCE_BYPASS_COOKIE}=`.length).split(";")[0];
      if (value !== undefined && value !== "") return { value, source: `POST /admin/bypass (${String(response.status)})` };
    } catch {
      /* ตกลงไปมินต์เอง */
    }
  }

  const secret = process.env.SESSION_SECRET;
  if (!isSecretUsable(secret)) return null;
  return { value: createMaintenanceBypassToken(nextMaintenanceBypassExpiry(Date.now()), secret as string), source: "มินต์เองในเครื่อง" };
}

/** ยิงพร้อมกันแบบจำกัดจำนวน แต่คงลำดับผลลัพธ์ให้ตรงทะเบียน */
async function runProbes(
  baseUrl: string,
  targets: readonly ProbeTarget[],
  cookie: string | null,
  bypassCookie: string | null,
  concurrency: number,
): Promise<readonly ProbeResult[]> {
  const results: ProbeResult[] = new Array<ProbeResult>(targets.length);
  let cursor = 0;

  const worker = async (): Promise<void> => {
    while (cursor < targets.length) {
      const index = cursor;
      cursor += 1;
      const target = targets[index];
      if (target === undefined) continue;

      const started = Date.now();
      const headers: Record<string, string> = { "user-agent": "waiwai-probe-routes/1.0" };
      if (target.admin === true && cookie !== null) headers.cookie = `${SESSION_COOKIE_NAME}=${cookie}`;
      if (target.bypass === true && bypassCookie !== null) headers.cookie = `${MAINTENANCE_BYPASS_COOKIE}=${bypassCookie}`;

      try {
        const first = await fetch(baseUrl + target.url, { redirect: "manual", headers });
        let status = first.status;
        let body = await first.text();
        let retriedAfter5xx = false;

        /*
          dev ตอบ 500 ได้หนึ่งครั้งสำหรับหน้าที่เพิ่ง compile (เจอจริงรอบ 292) ⇒ ยิงซ้ำหนึ่งครั้ง
          แล้ว **รายงานว่ายิงซ้ำ** (ไม่กลืน) · 5xx ที่คาดไว้ (503 ของโหมดปิดปรับปรุง) ไม่ต้องยิงซ้ำ
        */
        if (shouldRetryAfter5xx(target, status)) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
          const second = await fetch(baseUrl + target.url, { redirect: "manual", headers });
          status = second.status;
          body = await second.text();
          retriedAfter5xx = true;
        }

        results[index] = evaluateProbeResponse(target, {
          status,
          body,
          ms: Date.now() - started,
          ...(retriedAfter5xx ? { retriedAfter5xx: true } : {}),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results[index] = evaluateProbeResponse(target, { status: 0, body: `ยิงไม่สำเร็จ: ${message}`, ms: Date.now() - started });
      }
    }
  };

  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, targets.length)) }, () => worker()));
  return results.filter((result): result is ProbeResult => result !== undefined);
}

/** พิมพ์ผลของ flow หลายขั้น + คืน `true` เมื่อผ่านทั้งหมด */
async function reportFlows(options: ProbeOptions): Promise<boolean> {
  const result = await runProbeFlows({ baseUrl: options.baseUrl, only: options.only, allowRemote: options.allowRemote });

  if (result.skippedReason !== null) {
    process.stdout.write(`⚠️ ${result.skippedReason}\n`);
    return false;
  }

  for (const outcome of result.outcomes) {
    const mark = outcome.ok ? "✓" : "✗";
    process.stdout.write(`${mark} flow: ${outcome.title} (${outcome.id})\n`);
    for (const step of outcome.steps) {
      process.stdout.write(`     ${step.ok ? "✓" : "✗"} ${step.label} — ${step.detail}\n`);
    }
    process.stdout.write(`     🧹 ${outcome.cleanup}\n`);
  }

  const failed = result.outcomes.filter((outcome) => !outcome.ok).length;
  process.stdout.write(`\n=== ${String(result.outcomes.length)} flow · ผ่าน ${String(result.outcomes.length - failed)} · มีปัญหา ${String(failed)} ===\n`);
  return failed === 0 && result.outcomes.length > 0;
}

async function main(): Promise<void> {
  let options;
  try {
    options = parseProbeArgs(process.argv.slice(2), process.env);
  } catch (error) {
    process.stdout.write(`✗ ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
    return;
  }

  /* ต่อเซิร์ฟเวอร์ไม่ได้ = ข้ามอย่างเปิดเผย (ไม่ใช่ "ผ่าน") */
  try {
    const ping = await fetch(`${options.baseUrl}/robots.txt`, { redirect: "manual" });
    if (ping.status >= 500) throw new Error(`robots.txt ตอบ ${String(ping.status)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stdout.write(`⚠️ ข้าม: ต่อ ${options.baseUrl} ไม่ได้ (${message})\n`);
    process.stdout.write("   probe ต้องมีเซิร์ฟเวอร์รันอยู่ — dev: npm run dev · prod: npm run build && npm start\n");
    return;
  }

  /* ── โหมด flow หลายขั้น (rate limit · เพิกถอนเซสชัน · อัปโหลด · ลิงก์พรีวิว) ── */
  if (options.flows) {
    const ok = await reportFlows(options);
    if (!ok) process.exitCode = 1;
    return;
  }

  const targets = targetsForOptions(options);
  if (targets.length === 0) {
    process.stdout.write("⚠️ ไม่มีเส้นที่ตรงกับตัวเลือก — ลองลด --only หรือไม่ใส่\n");
    return;
  }

  let session: ProbeSession | null = null;
  if (options.useSession) {
    session = await mintProbeSession("probe-routes/1.0");
    if (session === null) {
      process.stdout.write("⚠️ มินต์เซสชันไม่ได้ (ไม่มี SESSION_SECRET/ฐานข้อมูล/บัญชีผู้ดูแล) ⇒ ยิงเฉพาะเส้นสาธารณะ\n");
    } else {
      process.stdout.write(`ℹ️ เซสชันทดสอบ: มินต์ให้บัญชี "${session.userId}" · จะเพิกถอนเมื่อจบ${options.keepSession ? " (ข้าม: --keep-session)" : ""}\n`);
    }
  }

  /* บัตรผ่านดูเว็บระหว่างปิดปรับปรุง — เฉพาะชุดที่มีเส้น `bypass: true` (ไม่ใช้คุกกี้เซสชันแทนกัน) */
  let bypassCookie: string | null = null;
  if (targets.some((target) => target.bypass === true)) {
    const issued = await issueBypassCookie(options.baseUrl, session?.cookie ?? null);
    if (issued === null) {
      process.stdout.write("⚠️ ออกบัตรผ่านไม่ได้ (ไม่มี SESSION_SECRET) ⇒ เส้นที่ต้องใช้บัตรผ่านจะตก\n");
    } else {
      bypassCookie = issued.value;
      process.stdout.write(`ℹ️ บัตรผ่านดูเว็บ: ${issued.source}\n`);
    }
  }

  const results = await runProbes(options.baseUrl, targets, session?.cookie ?? null, bypassCookie, options.concurrency);
  const summary = summarizeProbeResults(results);

  if (options.json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          baseUrl: options.baseUrl,
          maintenance: options.maintenance,
          total: summary.total,
          passed: summary.passed,
          failed: summary.failed.map((result) => ({ url: result.target.url, status: result.status, problems: result.problems })),
        },
        null,
        2,
      )}\n`,
    );
  } else {
    for (const result of results) {
      process.stdout.write(`${formatProbeLine(result)}\n`);
      for (const problem of result.problems) process.stdout.write(`        └─ ${problem}\n`);
    }
    process.stdout.write(`\n=== ${String(summary.total)} เส้นทาง · ผ่าน ${String(summary.passed)} · มีปัญหา ${String(summary.failed.length)} ===\n`);
    for (const result of summary.failed) {
      process.stdout.write(`  ✗ ${result.target.url} → ${result.problems.join(" · ")}\n`);
    }
    if (summary.skippedWithoutSession > 0) {
      process.stdout.write(`  ℹ️ ${String(summary.skippedWithoutSession)} เส้นต้องใช้เซสชันแต่ไม่ถูกยิงด้วยเซสชัน (ผลอาจเป็น 307 = ปกติ)\n`);
    }
  }

  if (session !== null && !options.keepSession) {
    const released = await releaseProbeSession(session);
    if (!released) process.stdout.write("⚠️ เพิกถอนเซสชันทดสอบไม่สำเร็จ — ตรวจที่ /admin/users\n");
  }
  if (summary.failed.length > 0) process.exitCode = 1;
}

await main();
