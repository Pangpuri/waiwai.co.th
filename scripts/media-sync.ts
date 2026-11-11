import pg from "pg";

import { planMediaSync, type MediaSyncRow } from "@/lib/db/media-sync";
import { hostOf, redactUrl } from "@/lib/db/target";

/**
 * `npm run media:sync [-- --apply]` — ซิงก์ **คลังภาพ** จากเครื่องขึ้นปลายทาง (D-305-1)
 *
 * ที่มา: `db:sync` ตั้งใจไม่ซิงก์ `media` (ไฟล์ไบนารีจำนวนมาก) แต่หน้าเว็บ/บล็อก/สินค้า
 * อ้าง `/media/<id>` จากเครื่อง ⇒ ปลายทางไม่มีแถวภาพนั้น = ภาพ 404
 *
 * ความปลอดภัย:
 * - ค่าเริ่มต้น = dry-run · ต้อง `--apply` จึงเขียน
 * - คัดลอกเฉพาะภาพที่ปลายทางยังไม่มี (id หาย)
 * - **ไม่ทับ** ภาพที่มี id อยู่แล้ว (ภาพที่อัปโหลดบน Vercel ต้องไม่หาย)
 * - ไม่ลบภาพใด ๆ · รายงาน cloud-only ให้เห็น
 */

const APPLY = process.argv.includes("--apply");
const LOCAL_URL = process.env.DATABASE_URL ?? "";
const TARGET_URL = process.env.TARGET_DATABASE_URL ?? "";

if (LOCAL_URL === "" || TARGET_URL === "") {
  process.stdout.write("✗ ต้องมี DATABASE_URL (เครื่อง) และ TARGET_DATABASE_URL (ปลายทาง) ใน .env.local\n");
  process.exitCode = 1;
} else {
  process.stdout.write(
    `ℹ️ ต้นทาง: ${redactUrl(LOCAL_URL)}\n` +
      `ℹ️ ปลายทาง: ${redactUrl(TARGET_URL)} (${hostOf(TARGET_URL)})\n` +
      `ℹ️ โหมด: ${APPLY ? "เขียนจริง (--apply)" : "dry-run (ยังไม่เขียนอะไร)"}\n\n`,
  );

  const local = new pg.Client({ connectionString: LOCAL_URL });
  const target = new pg.Client({ connectionString: TARGET_URL });
  await local.connect();
  await target.connect();

  try {
    const [localRows, targetRows] = await Promise.all([
      local.query<{ id: string; size_bytes: number }>(
        "select id, size_bytes from media where deleted_at is null order by created_at, id",
      ),
      target.query<{ id: string; size_bytes: number }>(
        "select id, size_bytes from media where deleted_at is null",
      ),
    ]);

    const localList: readonly MediaSyncRow[] = localRows.rows.map((row) => ({
      id: row.id,
      sizeBytes: row.size_bytes,
    }));
    const targetList: readonly MediaSyncRow[] = targetRows.rows.map((row) => ({
      id: row.id,
      sizeBytes: row.size_bytes,
    }));
    const plan = planMediaSync(localList, targetList);

    process.stdout.write(
      `ภาพในเครื่อง ${String(localList.length)} · ปลายทาง ${String(targetList.length)} · ` +
        `ขาดที่ปลายทาง ${String(plan.missing.length)} ภาพ (${String(plan.missingBytes)} bytes) · ` +
        `มีเฉพาะปลายทาง ${String(plan.cloudOnly.length)} ภาพ\n`,
    );

    if (plan.missing.length === 0) {
      process.stdout.write("✓ ปลายทางมีภาพครบแล้ว — ไม่มีอะไรต้องซิงก์\n");
    } else if (!APPLY) {
      process.stdout.write("แผน: จะคัดลอกภาพที่ขาด (ยังไม่เขียน) — ตัวอย่าง:\n");
      for (const row of plan.missing.slice(0, 10)) process.stdout.write(`  · ${row.id} (${String(row.sizeBytes)} bytes)\n`);
      if (plan.missing.length > 10) process.stdout.write(`  … อีก ${String(plan.missing.length - 10)} ภาพ\n`);
    } else {
      const ids = plan.missing.map((row) => row.id);
      const full = await local.query<Record<string, unknown>>(
        `select id, filename, mime, size_bytes, width, height, data, alt_th, alt_en,
                created_by, created_at, deleted_at, deleted_by, sha256
           from media
          where id = any($1::text[]) and deleted_at is null
          order by created_at, id`,
        [ids],
      );

      await target.query("begin");
      let inserted = 0;
      try {
        for (const row of full.rows) {
          const result = await target.query(
            `insert into media
               (id, filename, mime, size_bytes, width, height, data, alt_th, alt_en,
                created_by, created_at, deleted_at, deleted_by, sha256)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
             on conflict (id) do nothing`,
            [
              row["id"],
              row["filename"],
              row["mime"],
              row["size_bytes"],
              row["width"],
              row["height"],
              row["data"],
              row["alt_th"],
              row["alt_en"],
              row["created_by"],
              row["created_at"],
              row["deleted_at"],
              row["deleted_by"],
              row["sha256"],
            ],
          );
          inserted += result.rowCount ?? 0;
        }
        await target.query("commit");
      } catch (error) {
        await target.query("rollback");
        throw error;
      }

      process.stdout.write(`✓ คัดลอกภาพขึ้นปลายทางแล้ว ${String(inserted)} ภาพ\n`);
      if (inserted < plan.missing.length) {
        process.stdout.write(`  (ข้าม ${String(plan.missing.length - inserted)} ภาพที่มี id อยู่แล้ว)\n`);
      }
    }
  } finally {
    await local.end();
    await target.end();
  }
}
