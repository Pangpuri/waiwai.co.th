/**
 * `npm run maintenance:on` · `npm run maintenance:off` · `npm run maintenance:status` (X2.5)
 *
 * เขียน/ลบ **เฉพาะบรรทัด** `MAINTENANCE_MODE` ใน `.env.local` (ไฟล์ที่ gitignore ไว้)
 * ใช้ `mergeEnvText` ตัวเดียวกับ `npm run admin:create --write-env` ⇒ ไม่ทับคีย์อื่น (เช่น DATABASE_URL) เด็ดขาด
 *
 * ⚠️ ข้อจำกัดที่ต้องพูดตรง ๆ
 * - Next อ่าน `.env.local` **ตอนสตาร์ต** ⇒ ต้องรีสตาร์ต (`npm run dev` / `next start`) ให้ค่าใหม่มีผล
 * - บนโฮสต์ที่มี env ของตัวเอง (เช่น Vercel) ให้ตั้งที่โฮสต์แทน — สคริปต์นี้แตะเฉพาะไฟล์ในเครื่อง
 *   (ถ้าตั้งที่โฮสต์ไว้แล้ว การรันสคริปต์ที่นี่จะไม่เปลี่ยนพฤติกรรมบนโฮสต์)
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { LOCAL_ENV_FILE, mergeEnvText, readEnvValue } from "@/lib/auth/env-file";
import { MAINTENANCE_ENV_VAR, maintenanceFlagOf } from "@/lib/maintenance/plan";

type Options = {
  readonly mode: "on" | "off" | "status";
};

function parseArgs(argv: readonly string[]): Options {
  const [first] = argv;
  if (first === "on" || first === "off" || first === "status") return { mode: first };

  process.stdout.write(
    "npm run maintenance:on | maintenance:off | maintenance:status\n" +
      "  on      เขียน MAINTENANCE_MODE=1 ลง .env.local (ปิดเว็บสำหรับผู้เข้าชมทั่วไป)\n" +
      "  off     ลบ/ปิดค่าใน .env.local (เปิดเว็บคืน)\n" +
      "  status  ดูสถานะปัจจุบัน (ไม่แก้อะไร)\n",
  );
  process.exit(first === undefined || first === "--help" || first === "-h" ? 0 : 1);
}

async function readEnvFile(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return "";
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const envPath = join(process.cwd(), LOCAL_ENV_FILE);
  const existing = await readEnvFile(envPath);
  const current = readEnvValue(existing, MAINTENANCE_ENV_VAR);

  if (options.mode === "status") {
    const flag = maintenanceFlagOf(current);
    const labels = {
      on: "เปิดอยู่ — ผู้เข้าชมทั่วไปเห็นหน้าแจ้งปิดปรับปรุง",
      off: "ปิดอยู่ — เว็บเปิดให้บริการตามปกติ",
      unclear: `ค่าที่ตั้งไว้ไม่ชัดเจน (${String(current)}) จึงถือว่า \"ปิด\"`,
    } as const;

    process.stdout.write(`โหมดปิดปรับปรุง: ${labels[flag]}\n`);
    process.stdout.write(`  ${MAINTENANCE_ENV_VAR}=${current ?? "(ไม่ได้ตั้ง)"} · ไฟล์ ${LOCAL_ENV_FILE}\n`);
    return;
  }

  const value = options.mode === "on" ? "1" : "0";
  const merged = mergeEnvText(existing, [{ key: MAINTENANCE_ENV_VAR, value }]);
  await writeFile(envPath, merged, "utf8");

  process.stdout.write(
    options.mode === "on"
      ? `✓ เปิดโหมดปิดปรับปรุงแล้ว (${MAINTENANCE_ENV_VAR}=1 ใน ${LOCAL_ENV_FILE})\n`
      : `✓ ปิดโหมดปิดปรับปรุงแล้ว (${MAINTENANCE_ENV_VAR}=0 ใน ${LOCAL_ENV_FILE})\n`,
  );
  process.stdout.write(
    "  ⚠️ ต้องรีสตาร์ตเซิร์ฟเวอร์ให้ค่าใหม่มีผล (Next อ่าน .env.local ตอนสตาร์ต)\n" +
      "  ตรวจก่อน/หลัง: npm run maintenance:status · แล้วลองเปิดหน้าเว็บจริง\n" +
      "  ผู้ดูแลที่ล็อกอินอยู่ยังเข้าเว็บได้ปกติ (บายพาสด้วยคุกกี้เซสชัน)\n",
  );
  process.stdout.write(`  อย่าลืมปิดโหมดเมื่อทำงานเสร็จ: npm run maintenance:off\n`);
}

await main();
