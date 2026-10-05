/**
 * `npm run db:seed`
 *
 * เขียนเนื้อหา **หน้าแรก** (seed จากพจนานุกรมเดิม) ลงฐานข้อมูล Postgres
 *
 * ลำดับการใช้งาน (ครั้งแรก)
 *   1. สร้างฐานข้อมูล แล้วเอา connection string ใส่ `.env.local` เป็น `DATABASE_URL=...`
 *      ⚠️ ห้าม commit ไฟล์นี้ · ห้ามส่งค่า connection string ในแชท/เอกสาร (ใส่ env เท่านั้น)
 *   2. `npm run db:migrate`                    — สร้าง/อัปเดตตาราง
 *   3. `npm run db:seed`                        — เขียนเนื้อหาหน้าแรก (รันซ้ำได้ ไม่สร้างข้อมูลซ้ำ)
 *
 * หมายเหตุ: สคริปต์นี้เป็น "ตัวรัน" ล้วน — ตรรกะทั้งหมดอยู่ใน lib/content/ (ทดสอบได้โดยไม่ต้องมี DB)
 * และจะ **ไม่เขียนอะไรลง DB ถ้าเนื้อหาไม่ผ่าน validator** (กันข้อมูลพังไหลเข้าไปแล้วต้องมานั่งลบ)
 *
 * ⚠️ รอบที่ 108 — เปลี่ยนมาใช้ `savePageContent()` (เส้นทางเดียวกับหน้าจอหลังบ้าน)
 *    เดิมสคริปต์นี้เขียนเองด้วย `pg.Client` แล้ว **ไม่อะไรลบ** ⇒ พอตัดฟิลด์/กลุ่มรายการออกจากสคีมา
 *    (เคสจริง: ตัด `products.categories[].description` + กลุ่ม `products.featured`) แถวเก่า **28 แถว**
 *    ค้างอยู่ในฐานข้อมูล และด่าน `check:db` จับได้ (คาด 0 แถวกำพร้า · เจอ 28)
 *    ⇒ ใช้ `savePageContent()` ที่ upsert + ลบแถวกำพร้า (`planOrphanKeys`) ในทรานแซกชันเดียว
 */
import { HOME_PAGE_SPEC } from "@/lib/content/model";
import { HOME_SEED } from "@/lib/content/home-seed";
import { countPageRows, savePageContent } from "@/lib/content/repository";
import { errorsOf, validateContent } from "@/lib/content/validate";
import { closePool } from "@/db/pool";

const ENV_NAME = "DATABASE_URL";

async function main(): Promise<void> {
  const connectionString = process.env[ENV_NAME];

  if (connectionString === undefined || connectionString.trim() === "") {
    process.stderr.write(
      `✗ ไม่พบ ${ENV_NAME}\n\n` +
        "  ใส่ค่าในไฟล์ .env.local (ไม่ commit) แล้วรันใหม่ — ตัวอย่าง:\n" +
        `    ${ENV_NAME}=postgresql://...\n\n` +
        "  หรือส่งผ่าน env ตรง ๆ:  DATABASE_URL=... npm run db:seed\n" +
        "  ⚠️ ห้ามเดาค่า และห้ามวางค่าไว้ในเอกสาร/แชท\n\n",
    );
    process.exit(1);
  }

  const issues = errorsOf(validateContent(HOME_PAGE_SPEC, HOME_SEED));
  if (issues.length > 0) {
    process.stderr.write(`✗ เนื้อหาไม่ผ่าน validator (${issues.length} error) — ยังไม่เขียนลงฐานข้อมูล\n`);
    for (const issue of issues) {
      process.stderr.write(`    [${issue.code}] ${issue.path}\n`);
    }
    process.exit(1);
  }

  const result = await savePageContent(HOME_PAGE_SPEC, HOME_SEED, "seed:home");
  const total = await countPageRows(HOME_PAGE_SPEC.page);
  await closePool();

  process.stdout.write(
    `✓ seed หน้า ${HOME_PAGE_SPEC.page} แล้ว: เขียน/อัปเดต ${result.written} แถว` +
      (result.deleted > 0 ? ` · ลบแถวที่ไม่อยู่ในสคีมาแล้ว ${result.deleted} แถว` : "") +
      ` · ในตารางมี ${total} แถวของหน้านี้\n`,
  );
}

await main();
