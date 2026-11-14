import { readFile } from "node:fs/promises";
import path from "node:path";

import { isDatabaseConfigured } from "@/db/pool";
import { careersSpreadsheetWrites, parseCareersWorkbook } from "@/lib/careers/xlsx-import";
import { upsertJobPostings } from "@/lib/careers/repository";

const args = process.argv.slice(2);
const fileArgument = args.find((argument) => argument.startsWith("--file="));
const filePath = fileArgument?.slice("--file=".length).trim() ?? "";
const apply = args.includes("--apply");
const ACTOR = "careers-excel-import";

async function main(): Promise<void> {
  if (filePath === "") {
    throw new Error("ระบุไฟล์ด้วย --file=<path> (ค่าเริ่มต้นเป็น dry-run; เพิ่ม --apply เพื่อเขียนลงฐานข้อมูลในเครื่อง)");
  }

  const rows = await parseCareersWorkbook(await readFile(filePath));
  const writes = careersSpreadsheetWrites(rows);
  console.log(`ไฟล์ ${path.basename(filePath)} · พบ ${String(rows.length)} ตำแหน่ง · วันที่ประกาศเว้นว่าง · สถานะฉบับร่าง`);
  for (const row of rows) {
    console.log(`  แถว ${String(row.sourceRow)} · ${row.titleTh} · ${row.departmentTh} · ${String(row.openings)} อัตรา`);
  }

  if (!apply) {
    console.log("(dry-run) ไม่มีการเขียนลงฐานข้อมูล · ใช้ --apply เพื่อยืนยัน");
    return;
  }
  if (!isDatabaseConfigured()) {
    throw new Error("ต้องมี DATABASE_URL ที่ชี้ไปยังฐานข้อมูลในเครื่อง");
  }

  const results = await upsertJobPostings(writes, ACTOR, "protect-edited");
  const created = results.filter((result) => result.created).length;
  const updated = results.filter((result) => !result.created && !result.protectedEdit).length;
  const protectedEdits = results.filter((result) => result.protectedEdit).length;
  console.log(
    `✓ นำเข้า ${String(results.length)} รายการ · ใหม่ ${String(created)} · อัปเดต ${String(updated)} · คงรายการที่แก้แล้ว ${String(protectedEdits)}`,
  );
}

await main();
