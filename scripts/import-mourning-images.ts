import { readFile } from "node:fs/promises";
import path from "node:path";

import { closePool, getPool } from "@/db/pool";
import { storeImageFile } from "@/lib/media/upload";

/**
 * นำ "ภาพไว้อาลัย" 2 ภาพที่ค้างอยู่ในโฟลเดอร์ (`public/rip/`) เข้า **ฐานข้อมูล** (ตาราง `media`)
 *
 * คำสั่งเจ้าของ (2026-10-06): "เอาภาพไว้อาลัย 2 ภาพที่เป็นภาพหลังค้างในโฟลเดอร์เข้าไปเก็บไว้รอเลย"
 *   · เหตุผลเชิงสถาปัตยกรรม: ให้ **DB เป็นเจ้าของภาพ** (รับเข้าเก็บก่อน) แล้วค่อย "เผยแพร่ทั้งก้อน"
 *     ⇒ พรีวิวตัวอย่างไม่ปนกับของที่เผยแพร่ และไม่ต้องพึ่งไฟล์ในโฟลเดอร์ซึ่งควบคุม/ตรวจสอบยาก
 *
 * ⚠️ **ไฟล์ใน `public/rip/` ต้องคงอยู่** — เป็น "ค่าถอยหลัง" (fallback) เมื่อไม่มี DB/อ่านไม่ได้
 *    ตามกติกาเดิมของป้ายประกาศ (AGENTS.md: `loadMourningNotice()` ต้องไม่ทำให้หน้าเว็บพัง)
 *
 * รัน: npx tsx? ไม่มี → ใช้ import hook ของโปรเจกต์
 *   node --import ./scripts/alias-hook.mjs --env-file-if-exists=.env.local scripts/import-mourning-images.ts
 *
 * รันซ้ำได้ (idempotent): ถ้าไฟล์เดียวกันถูกนำเข้าแล้ว (เทียบ sha256) จะข้ามและพิมพ์ของเดิม
 */

const FILES = ["mourning-banner.jpg", "mourning-banner-02.jpg"] as const;
const ACTOR = "import:public/rip";

async function sha256Of(buffer: Buffer): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(buffer).digest("hex");
}

async function main(): Promise<void> {
  const pool = getPool();
  for (const name of FILES) {
    const filePath = path.join(process.cwd(), "public", "rip", name);
    let buffer: Buffer;
    try {
      buffer = await readFile(filePath);
    } catch {
      console.log(`ⓘ ข้าม ${name} — ไม่พบไฟล์ที่ ${filePath}`);
      continue;
    }

    /* มีอยู่แล้วหรือยัง (เทียบเนื้อหา ไม่ใช่ชื่อไฟล์) */
    const digest = await sha256Of(buffer);
    const existing = await pool.query<{ id: string }>("select id from media where sha256 = $1 limit 1", [digest]);
    if ((existing.rowCount ?? 0) > 0) {
      console.log(`= ${name} มีอยู่ในฐานข้อมูลแล้ว → /media/${String(existing.rows[0]?.id)}`);
      continue;
    }

    /* ใช้ท่อเดียวกับการอัปโหลดจากหลังบ้าน (ตรวจหัวไฟล์/เพดานขนาด/คำนวณขนาดภาพ) */
    const file = new File([new Uint8Array(buffer)], name, { type: "image/jpeg" });
    const stored = await storeImageFile(file, ACTOR);
    if (!stored.ok) {
      console.log(`✗ ${name} — นำเข้าไม่ได้: ${stored.reason}`);
      continue;
    }
    const size = String(Math.round(buffer.byteLength / 1024));
    const ratio = stored.width !== null && stored.height !== null ? (stored.width / stored.height).toFixed(2) : "?";
    console.log(`+ ${name} → ${stored.path} (${String(stored.width)}×${String(stored.height)} · ${size} kB · สัดส่วน ${ratio})`);
  }
  await closePool();
}

await main();
