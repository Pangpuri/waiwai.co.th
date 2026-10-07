/**
 * `npm run dev:clean` — กู้สถานะ dev server ที่พัง + ล้าง cache ของ Next
 *
 * **ที่มา (เคสจริง 2026-10-07):** ระหว่างที่ dev server กำลังรันอยู่ มีการรัน `npm run build` /
 * `npm start` ในโฟลเดอร์เดียวกัน (และมี kill process ที่ถือพอร์ต 3000) ⇒ โฟลเดอร์ `.next`
 * (ที่ dev ใช้ร่วมกับ build · cache ของ Turbopack อยู่ที่ `.next/dev`) ถูกลบ/เขียนทับกลางคัน
 * ⇒ dev ค้างสถานะเก่าไว้ในหน่วยความจำ แล้วอ่าน cache/manifest ที่หายหรือไม่ครบ ⇒
 * **ทุกหน้าตอบ 500 ด้วย `SyntaxError: Unexpected non-whitespace character after JSON at position N`**
 * (error นี้ไม่มีเฟรมของโค้ดเราเลย เพราะเกิดตอนอ่านไฟล์ภายในของ Next ไม่ใช่ตอนเรนเดอร์หน้า)
 *
 * ⚠️ **ยืนยันแล้วว่าไม่ใช่บั๊กในโค้ด:** ต้นไม้ git สะอาด · `npm run build` ผ่าน ·
 *    `next start` (prod) ตอบ 200 ทุกหน้า · และ dev server ที่เพิ่งสตาร์ตใหม่ (โค้ดเดิมเป๊ะ) ตอบ 200 ทุกหน้า
 *
 * เครื่องมือนี้จึงทำ 2 อย่าง
 *  1) **fail-closed:** ถ้ามีอะไรรันอยู่บนพอร์ต dev ⇒ ไม่ลบอะไรเลย แล้วบอกวิธีหยุดให้ก่อน
 *     (การลบ `.next` ขณะเซิร์ฟเวอร์ยังรัน = ต้นเหตุของเคสนี้ จึงต้องกันที่ราก)
 *  2) ล้าง `.next` ทั้งโฟลเดอร์ (dev + build) แล้วบอกขั้นถัดไป
 */

import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { connect } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.cwd();
const CACHE_DIR = path.join(ROOT, ".next");
const DEFAULT_PORT = 3000;

/** ผลการตัดสินใจว่าจะล้างได้ไหม — **ตรรกะล้วน** (ทดสอบได้โดยไม่ต้องมีเซิร์ฟเวอร์/ดิสก์) */
export type CleanDecision =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "port-busy" };

export function cleanDecision({ portBusy, force }: { readonly portBusy: boolean; readonly force: boolean }): CleanDecision {
  if (portBusy && !force) return { ok: false, reason: "port-busy" };
  return { ok: true };
}

/** ขนาดแบบอ่านรู้เรื่อง (ใช้บอกว่าเคลียร์ไปกี่ MB) — ตรรกะล้วน */
export function humanSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"] as const;
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 && unit > 0 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

/**
 * อ่านพอร์ตจาก `--port=` (ค่าที่ใช้ไม่ได้ = พอร์ตเริ่มต้น) — ตรรกะล้วน
 * ⚠️ รับเฉพาะ **เลขล้วน** (`"3.5"` / `" 3001"` / `"abc"` = ใช้ไม่ได้) — `parseInt` เปล่า ๆ จะรับ `3.5` เป็น 3 เงียบ ๆ
 */
export function portFromArgs(args: readonly string[], fallback: number = DEFAULT_PORT): number {
  const raw = args.find((arg) => arg.startsWith("--port="))?.slice("--port=".length) ?? "";
  if (!/^\d+$/.test(raw)) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return parsed > 0 && parsed < 65536 ? parsed : fallback;
}

export function shouldForce(args: readonly string[]): boolean {
  return args.includes("--force");
}

/** ขนาดรวมของโฟลเดอร์ (คืน 0 ถ้าไม่มี) */
function sizeOf(dir: string): number {
  if (!existsSync(dir)) return 0;
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) total += sizeOf(full);
    else total += statSync(full).size;
  }
  return total;
}

/**
 * ตรวจว่ามีอะไรรันอยู่บนพอร์ตนั้นไหม
 * ⚠️ ต้องลองทั้ง IPv4 และ IPv6 — Next ผูกกับ `::` (dual-stack) ซึ่งบน Windows อาจไม่ชนกับ 127.0.0.1
 */
export function portInUse(port: number): Promise<boolean> {
  /*
    ⚠️ บทเรียนจริง (2026-10-07 · ตอนเขียนเครื่องมือนี้): อย่าตรวจพอร์ตด้วยการ "ลอง bind"
    บน Windows การ bind `127.0.0.1:3000` **สำเร็จได้** แม้มีอีกโปรเซสผูก `0.0.0.0:3000` อยู่แล้ว
    (คนละ local address ⇒ ไม่ถือว่าชน) ⇒ ด่านรุ่นแรกบอก "ว่าง" แล้วลบ `.next` ขณะ dev รัน = ทำบั๊กเดิมซ้ำ
    ⇒ ต้องตรวจด้วยการ **ต่อ (connect)** เข้าไปจริง: ต่อติด = มีคนฟังอยู่ · ECONNREFUSED = ว่าง
  */
  const probe = (host: string): Promise<boolean> =>
    new Promise((resolve) => {
      const socket = connect({ port, host });
      const finish = (busy: boolean): void => {
        socket.destroy();
        resolve(busy);
      };
      socket.setTimeout(800, () => finish(false));
      socket.once("connect", () => finish(true));
      socket.once("error", () => resolve(false));
    });

  return probe("127.0.0.1").then((busyV4) => (busyV4 ? true : probe("::1")));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const port = portFromArgs(args);
  const force = shouldForce(args);
  const busy = await portInUse(port);

  const decision = cleanDecision({ portBusy: busy, force });
  if (!decision.ok) {
    console.error(`✗ พอร์ต ${port} ถูกใช้งานอยู่ — ยังไม่ลบอะไรทั้งนั้น (การลบ .next ขณะเซิร์ฟเวอร์รัน = ต้นเหตุที่ทำให้ dev พัง)`);
    console.error("");
    console.error("  หยุดเซิร์ฟเวอร์ก่อน แล้วค่อยล้าง เช่น");
    console.error(`    netstat -ano | findstr :${port}      # ดู PID ของผู้ถือพอร์ต`);
    console.error("    taskkill /PID <pid> /F               # หยุด (เฉพาะที่แน่ใจว่าเป็นของโปรเจกต์นี้)");
    console.error(`    npm run dev:clean                     # แล้วรันใหม่`);
    console.error("");
    console.error("  ถ้าแน่ใจว่าเซิร์ฟเวอร์บนพอร์ตนั้นไม่เกี่ยวกับโฟลเดอร์นี้ ใช้ `npm run dev:clean -- --force` หรือ `--port=3001`");
    process.exitCode = 1;
    return;
  }

  const before = sizeOf(CACHE_DIR);
  console.log("── dev:clean ─────────────────────────────────────────");
  console.log("สาเหตุที่ต้องมีคำสั่งนี้: cache ของ dev (ใน .next) เสียสถานะได้ ถ้ามี build/start หรือ kill process");
  console.log("ระหว่างที่ dev กำลังรันอยู่ ⇒ อาการคือ **ทุกหน้าตอบ 500** ด้วย SyntaxError … JSON … position N");
  console.log("(ยืนยันแล้วว่าโค้ดไม่ผิด: build ผ่าน · prod start ตอบ 200 · dev ที่สตาร์ตใหม่ตอบ 200 ทุกหน้า)");
  console.log("");
  console.log(`โฟลเดอร์ที่จะล้าง: ${path.relative(ROOT, CACHE_DIR) === "" ? ".next" : ".next"} (${humanSize(before)})`);

  if (existsSync(CACHE_DIR)) {
    rmSync(CACHE_DIR, { recursive: true, force: true });
    console.log(`✓ ล้างแล้ว — คืนพื้นที่ ${humanSize(before)}`);
  } else {
    console.log("✓ ไม่มีโฟลเดอร์ .next อยู่แล้ว (ไม่มีอะไรต้องล้าง)");
  }

  console.log("");
  console.log(`พอร์ต ${port} ว่าง${busy ? " (บังคับด้วย --force)" : ""} · ขั้นถัดไป: npm run dev`);
}

/*
  รันเฉพาะเมื่อถูกเรียกเป็นคำสั่ง — **ห้ามใช้ regex จับชื่อไฟล์**
  (บทเรียนจริง: `scripts/test-dev-clean.ts` ก็ลงท้ายด้วย `dev-clean.ts` ⇒ เทสต์เรียก main() แล้วสั่งลบ .next!)
  ⇒ เทียบ **พาธจริง** ของโมดูลนี้กับ `process.argv[1]`
*/
const invokedDirectly = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  await main();
}
