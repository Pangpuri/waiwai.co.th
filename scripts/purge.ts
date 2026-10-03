/**
 * `npm run db:purge` — ลบข้อมูลส่วนบุคคลที่หมดอายุตามนโยบายระยะเก็บ (X2b)
 *
 * วิธีใช้
 *   npm run db:purge                              ลบจริง + บันทึกลง audit log
 *   npm run db:purge -- --dry-run                 นับเฉย ๆ ว่าจะลบกี่แถว (ไม่แตะข้อมูล)
 *   npm run db:purge -- --json                    พ่นผลเป็น JSON (สำหรับ cron/ตัวเฝ้า)
 *   npm run db:purge -- --actor=you@waiwai.co.th  ระบุว่าใครสั่ง (ไม่ใส่ = "system")
 *
 * ⚠️ ต้องมี `DATABASE_URL` (อ่านจาก env เท่านั้น — ห้ามใส่ค่าเริ่มต้นในโค้ด)
 *
 * ทำไมต้องมีสคริปต์นี้ทั้งที่ระบบลบอัตโนมัติอยู่แล้ว
 *   ตัวลบอัตโนมัติทำงานตอนมีคน "ล็อกอินหลังบ้าน" (กันซ้ำ 24 ชม.) ⇒ ถ้าไม่มีใครเข้าหลังบ้านเลย
 *   ข้อมูลจะค้าง  ⇒ สคริปต์นี้ใช้ตั้ง `cron` บนเซิร์ฟเวอร์ที่เช่าเอง เพื่อให้ลบตรงเวลาเสมอ
 *
 * ตรรกะทั้งหมดอยู่ใน `lib/retention/plan.ts` (บริสุทธิ์) + `lib/retention/purge.ts` (แตะ DB)
 * ⚠️ รอบเดียวกันนี้ลบ **ของในถังขยะที่พ้นกำหนด** ด้วย (X2.4) — ระยะเก็บของถังอยู่ที่ไฟล์นโยบายเดียวกัน
 *    (`TRASH_RETENTION_DAYS` · ภาพ/พรีเซ็ตที่ผู้ดูแลลบ ไม่นับเป็นข้อมูลส่วนบุคคล จึงไม่ขึ้นหน้า /privacy)
 */
import { closePool, isDatabaseConfigured } from "@/db/pool";
import { describeRetention } from "@/lib/retention/format";
import { RETENTION_CLASSES, TRASH_RETENTION_DAYS, retentionDaysFor, summarizePurge } from "@/lib/retention/plan";
import { purgeExpired, purgeNow, type PurgeReport } from "@/lib/retention/purge";
import { summarizeTrash } from "@/lib/trash/plan";
import { purgeExpiredTrash, type TrashPurgeReport } from "@/lib/trash/repository";
import { PREVIEW_LINK_KEEP_DAYS } from "@/lib/preview-link/plan";

type Options = {
  readonly dryRun: boolean;
  readonly json: boolean;
  readonly actorEmail: string | null;
};

function parseArgs(argv: readonly string[]): Options {
  let dryRun = false;
  let json = false;
  let actorEmail: string | null = null;

  for (const arg of argv) {
    if (arg === "--dry-run") dryRun = true;
    else if (arg === "--json") json = true;
    else if (arg.startsWith("--actor=")) {
      const value = arg.slice("--actor=".length).trim();
      actorEmail = value === "" ? null : value;
    } else if (arg === "--help" || arg === "-h") {
      process.stdout.write(
        "npm run db:purge -- [--dry-run] [--json] [--actor=email]\n" +
          "  --dry-run  นับว่าจะลบกี่แถว ไม่ลบจริง\n" +
          "  --json     พ่นผลเป็น JSON\n" +
          "  --actor    ระบุผู้สั่ง (บันทึกใน audit log)\n",
      );
      process.exit(0);
    } else {
      process.stderr.write(`✗ ไม่รู้จักอาร์กิวเมนต์: ${arg}\n`);
      process.exit(1);
    }
  }

  return { dryRun, json, actorEmail };
}

/** ตารางระยะเก็บที่ใช้จริงรอบนี้ (แสดงให้เห็นว่าเลขมาจากไหน) */
function printRetentionTable(): void {
  process.stdout.write("\n  ระยะเก็บที่ใช้ (lib/retention/plan.ts):\n");
  for (const cls of RETENTION_CLASSES) {
    const days = retentionDaysFor(cls);
    process.stdout.write(`    · ${cls.padEnd(13)} ${describeRetention(days, "th")} (${days} วัน)\n`);
  }
  /* ถังขยะ (X2.4) — คนละนโยบายกับข้อมูลส่วนบุคคล แต่ถูกลบในรอบเดียวกัน */
  process.stdout.write(
    `    · ${"trash (ถังขยะ)".padEnd(13)} ${describeRetention(TRASH_RETENTION_DAYS, "th")} (${TRASH_RETENTION_DAYS} วัน) — ภาพ/พรีเซ็ตที่ผู้ดูแลลบ\n`,
  );
  /* ลิงก์พรีวิว (X2.6) — เก็บกวาดหลังปิด/หมดอายุ · ไม่แตะลิงก์ที่ยังใช้ได้ */
  process.stdout.write(
    `    · ${"preview-link".padEnd(13)} ${PREVIEW_LINK_KEEP_DAYS} วันหลังปิดลิงก์ — ลิงก์พรีวิวชั่วคราว (X2.6)\n`,
  );
  process.stdout.write("\n");
}

/** นับของในถังที่พ้นกำหนด "ก่อน" ลบ — ตัวเลขบนจอจะตรงกับสิ่งที่รอบนี้ลบไปจริง */
async function trashDueNow(dryRun: boolean): Promise<TrashPurgeReport | null> {
  return purgeExpiredTrash({ dryRun });
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (!isDatabaseConfigured()) {
    process.stderr.write("✗ ไม่พบ DATABASE_URL — ใส่ใน .env.local ก่อน (ดู AGENTS.md § ตั้งค่า env)\n");
    process.exit(1);
  }

  let report: PurgeReport | null;

  /* นับของในถังที่พ้นกำหนดก่อน (โหมดลบจริง purgeNow จะลบให้เองในรอบเดียวกัน) */
  const trash = await trashDueNow(true);

  if (options.dryRun) {
    report = await purgeExpired({ dryRun: true });
  } else {
    /* purgeNow = ลบ + บันทึก audit (หมุดเวลาสำหรับรอบถัดไป) */
    report = await purgeNow({ actorEmail: options.actorEmail });
  }

  if (report === null) {
    process.stderr.write("✗ ลบไม่สำเร็จ (ฐานข้อมูลไม่ตอบ) — ไม่มีการเปลี่ยนแปลงข้อมูล\n");
    process.exit(1);
  }

  if (options.json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          dryRun: report.dryRun,
          at: report.at,
          total: report.total,
          counts: report.counts,
          trash: { total: trash?.total ?? 0, counts: trash?.counts ?? null },
        },
        null,
        2,
      )}\n`,
    );
  } else {
    const title = report.dryRun ? "ผลตรวจ (ยังไม่ลบ — dry run)" : "ลบข้อมูลที่หมดอายุแล้ว";
    process.stdout.write(`\n${title} @ ${report.at}\n`);
    for (const cls of RETENTION_CLASSES) {
      process.stdout.write(`    · ${cls.padEnd(13)} ลบ ${report.counts[cls]} แถว\n`);
    }
    process.stdout.write(`    รวม ${report.total} แถว\n`);
    if (trash !== null) {
      process.stdout.write(`    · ${"trash".padEnd(13)} ลบ ${trash.total} รายการ (${summarizeTrash(trash.counts)})\n`);
    }
    if (report.total === 0 && (trash?.total ?? 0) === 0) {
      process.stdout.write("    (ยังไม่มีข้อมูลที่หมดอายุ — ไม่มีอะไรต้องทำ)\n");
    }
    process.stdout.write(`\n  audit: ${summarizePurge(report.counts)}\n`);
  }

  printRetentionTable();

  await closePool();
}

await main();
