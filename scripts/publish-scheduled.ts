/**
 * `npm run db:publish-scheduled` — เผยแพร่หน้าที่ "ตั้งกำหนดเวลาไว้และครบกำหนดแล้ว" (X2.7 ส่วนที่ 1)
 *
 * วิธีใช้
 *   npm run db:publish-scheduled                     เผยแพร่ทุกหน้าที่ครบกำหนด + บันทึกลง audit log
 *   npm run db:publish-scheduled -- --json           พ่นผลเป็น JSON (สำหรับ cron/ตัวเฝ้า)
 *   npm run db:publish-scheduled -- --actor=you@…    ระบุว่าคำสั่งนี้รันโดยใคร (บันทึกใน audit)
 *
 * ⚠️ ต้องมี `DATABASE_URL` (อ่านจาก env เท่านั้น — ห้ามใส่ค่าเริ่มต้นในโค้ด)
 *
 * ทำไมต้องมีสคริปต์นี้ทั้งที่ระบบเผยแพร่ตอนล็อกอินอยู่แล้ว
 *   ตัวเผยแพร่ตามกำหนดไม่มีตัวจับเวลาในโปรเจกต์นี้ ⇒ ถ้าไม่มีคนเข้าหลังบ้านเลย งานก็รอไปเรื่อย ๆ
 *   สคริปต์นี้ใช้ตั้ง `cron` บนเซิร์ฟเวอร์ที่เช่าเอง เพื่อให้ออกตรงเวลาจริง
 *
 * ⚠️ สคริปต์นี้ **ไม่สั่ง revalidate หน้าเว็บ** (ไม่มีบริบทของ Next) — หน้าเว็บเป็น ISR (300 วิ)
 *    จึงใหม่เองภายใน 5 นาที · ต้องการให้ใหม่ทันทีให้ใช้ปุ่มบน `/admin`
 *
 * ตรรกะทั้งหมดอยู่ใน `lib/blocks/schedule.ts` (บริสุทธิ์) + `lib/blocks/publish-scheduler.ts` (แตะ DB)
 */
import { closePool, isDatabaseConfigured } from "@/db/pool";
import { SCHEDULED_REVISION_NOTE, publishDueScheduled } from "@/lib/blocks/publish-scheduler";

type Options = {
  readonly json: boolean;
  readonly actorEmail: string | null;
};

function parseArgs(argv: readonly string[]): Options {
  let json = false;
  let actorEmail: string | null = null;

  for (const arg of argv) {
    if (arg === "--json") json = true;
    else if (arg.startsWith("--actor=")) {
      const value = arg.slice("--actor=".length).trim();
      actorEmail = value === "" ? null : value;
    } else if (arg === "--help" || arg === "-h") {
      process.stdout.write(
        "npm run db:publish-scheduled -- [--json] [--actor=email]\n" +
          "  --json   พ่นผลเป็น JSON\n" +
          "  --actor  ระบุว่าคำสั่งนี้รันโดยใคร (บันทึกใน audit log)\n",
      );
      process.exit(0);
    } else {
      process.stderr.write(`✗ ไม่รู้จักอาร์กิวเมนต์: ${arg}\n`);
      process.exit(1);
    }
  }

  return { json, actorEmail };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (!isDatabaseConfigured()) {
    process.stderr.write("✗ ไม่พบ DATABASE_URL — ใส่ใน .env.local ก่อน (ดู AGENTS.md § ตั้งค่า env)\n");
    process.exit(1);
  }

  const report = await publishDueScheduled({ actorEmail: options.actorEmail });

  if (report === null) {
    process.stderr.write("✗ เผยแพร่ตามกำหนดไม่สำเร็จ (ฐานข้อมูลไม่ตอบ) — ไม่มีการเปลี่ยนแปลงข้อมูล\n");
    process.exit(1);
  }

  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`\nตรวจกำหนดเวลาเผยแพร่ @ ${report.at}\n`);
    for (const item of report.published) {
      process.stdout.write(`    · ${item.page.padEnd(13)} เผยแพร่แล้ว (รุ่นที่ ${item.revision} · note=${SCHEDULED_REVISION_NOTE})\n`);
    }
    for (const item of report.failed) {
      process.stdout.write(`    · ${item.page.padEnd(13)} ล้มเหลว — ${item.reason}\n`);
    }
    if (report.published.length === 0 && report.failed.length === 0) {
      process.stdout.write("    (ยังไม่มีงานครบกำหนด — ไม่มีอะไรต้องทำ)\n");
    }
    if (report.skipped > 0) {
      process.stdout.write(`    (ข้าม ${report.skipped} หน้า — มีตัวอื่นยึดกำหนดเวลาไปก่อน)\n`);
    }
    process.stdout.write(`    รวมเผยแพร่ ${report.published.length} หน้า\n`);
  }

  await closePool();

  /* ล้มเหลวบางหน้า = ส่งรหัสออกไปให้ cron/ตัวเฝ้ารู้ (หน้าที่พังยังมีกำหนดเวลาเดิมให้ลองรอบถัดไป) */
  if (report.failed.length > 0) process.exit(1);
}

await main();
