import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";

import { planVercelEnv } from "@/lib/db/vercel-env";

/**
 * `npm run env:vercel` (รอบที่ 116) — พิมพ์ **บล็อก env สำหรับวางบน Vercel**
 *
 * ทำไมต้องมี: เจ้าของถามว่า *"หรือจะ import .env เข้าไปดี"*
 * การ import ทั้งไฟล์เป็นอันตราย (ดูตารางใน `lib/db/vercel-env.ts`) เพราะ `.env.local` มี
 * ฐานข้อมูลในเครื่อง (localhost) + ความลับของหลังบ้าน ⇒ หน้าบ้านจะไม่มีข้อมูล และหลังบ้านจะเปิดออกอินเทอร์เน็ต
 *
 * สคริปต์นี้จึงพิมพ์ **เฉพาะ `DATABASE_URL` (endpoint ตรงของ Neon)** ที่ต้องใช้จริง
 * ⚠️ ค่าที่พิมพ์เป็นความลับ — **อย่าส่งในแชท/สกรีนชอต** · วางใน Vercel → Project Settings → Environment Variables
 *    (ช่อง "Import .env" วางได้เลย) แล้วเลือก Environments: Production/Preview/Development
 *
 * ตัวเลือก: `--reveal` พิมพ์ค่าจริง (ค่าเริ่มต้นจะปิดรหัสผ่านไว้ให้ตรวจได้ก่อน)
 *          `--clipboard` คัดลอกเฉพาะบรรทัด DATABASE_URL ลงคลิปบอร์ด (Windows)
 */

const shouldReveal = process.argv.includes("--reveal");
const toClipboard = process.argv.includes("--clipboard");

function redacted(line: string): string {
  const [key, ...rest] = line.split("=");
  const value = rest.join("=");
  try {
    const parsed = new URL(value);
    if (parsed.password !== "") parsed.password = "****";
    return `${key ?? ""}=${parsed.toString()}`;
  } catch {
    return `${key ?? ""}=<อ่านไม่ครบ>`;
  }
}

async function copyToClipboard(text: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("cmd.exe", ["/c", "clip"], { stdio: ["pipe", "inherit", "inherit"] });
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`clip ออกด้วยรหัส ${String(code)}`))));
    child.stdin?.end(text);
  });
}

async function main(): Promise<void> {
  /* อ่าน .env.local เอง (ไม่พึ่ง --env-file) เพื่อให้รู้ว่ามีคีย์อะไรบ้างโดยไม่ต้องพิมพ์ค่า */
  const envPath = ".env.local";
  const env: Record<string, string> = {};
  let sourceText = "";
  try {
    sourceText = readFileSync(envPath, "utf8");
  } catch {
    process.stderr.write(`✗ ไม่พบ ${envPath} — ใส่ TARGET_DATABASE_URL (Neon) ก่อน\n`);
    process.exit(1);
  }

  for (const line of sourceText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const at = trimmed.indexOf("=");
    if (at <= 0) continue;
    env[trimmed.slice(0, at)] = trimmed.slice(at + 1).replace(/^"|"$/g, "");
  }

  let plan: ReturnType<typeof planVercelEnv>;
  try {
    plan = planVercelEnv(env);
  } catch (error) {
    process.stderr.write(`✗ ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }

  const shown = shouldReveal ? plan.line : redacted(plan.line);

  process.stdout.write("\n── วางบล็อกนี้ใน Vercel (Project Settings → Environment Variables → Import .env) ──\n");
  process.stdout.write(`${shouldReveal ? plan.line : `${plan.line.split("=")[0]}=<ปิดรหัสไว้ — ใส่ --reveal เพื่อดูค่าจริง>`}\n`);
  process.stdout.write("────────────────────────────────────────────────────────────────────────\n");
  process.stdout.write(`โฮสต์ปลายทาง : ${plan.host}\n`);
  process.stdout.write(
    `แปลงเป็น endpoint ตรง : ${plan.normalizedToDirect ? "ใช่ (ตัด -pooler แล้ว — จำเป็นสำหรับ SQL ที่ไม่ระบุ schema)" : "ไม่ต้อง (ไม่ได้ใช้ pooler อยู่แล้ว)"}\n`,
  );
  process.stdout.write(`\nคีย์ที่ไม่ใส่ (และเหตุผล):\n`);
  for (const entry of plan.excluded) {
    process.stdout.write(`  · ${entry.key} — ${entry.reason}\n`);
  }
  process.stdout.write(
    `\n⚠️ ค่าที่พิมพ์เป็นความลับ — อย่าส่งในแชท/สกรีนชอต · วางแล้วลบประวัติ terminal ได้ก็ดี\n` +
      `   (โหมดตรวจสอบ: ${shown === plan.line ? "แสดงค่าจริง" : "ปิดรหัสผ่าน"} · ใส่ --reveal เพื่อดูค่าจริง)\n`,
  );

  if (toClipboard) {
    await copyToClipboard(plan.line);
    process.stdout.write("✓ คัดลอกบรรทัด DATABASE_URL ลงคลิปบอร์ดแล้ว (วางใน Vercel ได้เลย)\n");
  }
}

await main();
