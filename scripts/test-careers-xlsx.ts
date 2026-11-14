import assert from "node:assert/strict";
import { test } from "node:test";

import ExcelJS from "exceljs";

import {
  CareersWorkbookParseError,
  careersSpreadsheetWrites,
  parseCareersWorkbook,
  validateCareersSpreadsheetRows,
} from "@/lib/careers/xlsx-import";
import type { CareersSpreadsheetRow } from "@/lib/careers/xlsx-import";

const HEADERS = ["ลำดับ", "ตำแหน่งงาน", "แผนก/ฝ่าย", "เพศ", "จำนวน", "อายุ", "คุณสมบัติ", "ประสบการณ์"];

async function workbookBytes(rows: readonly (readonly unknown[])[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("ตำแหน่งที่ต้องการ");
  for (const row of rows) sheet.addRow([...row]);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function validWorkbook(): Promise<Buffer> {
  return workbookBytes([
    ["เอกสารรับสมัคร"],
    HEADERS,
    [1, "พนักงานขาย", "ฝ่ายขาย", "ไม่จำกัด", 2, "20 ปีขึ้นไป", "ม.6 ขึ้นไป", "1 ปี"],
    [
      null,
      "ขับรถได้",
      "ขับรถได้",
      "ขับรถได้",
      "ขับรถได้",
      "ขับรถได้",
      "ขับรถได้",
      "ขับรถได้",
    ],
    [2, "พนักงานผลิต", "ฝ่ายผลิต", "หญิง", 1, "18 ปีขึ้นไป", "ม.3 ขึ้นไป", ""],
  ]);
}

test("Excel Careers: อ่านประกาศและรวมแถวต่อเนื่องที่ซ้ำจากเซลล์รวมเพียงครั้งเดียว", async () => {
  const rows = await parseCareersWorkbook(await validWorkbook());
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    sourceRow: 3,
    titleTh: "พนักงานขาย",
    departmentTh: "ฝ่ายขาย",
    gender: "any",
    openings: 2,
    ageTh: "20 ปีขึ้นไป",
    qualificationsTh: "ม.6 ขึ้นไป\nขับรถได้",
    experienceTh: "1 ปี",
  });
  assert.equal(rows[1]?.gender, "female");
});

test("Excel Careers: ปฏิเสธหัวคอลัมน์หายและข้อมูลเพศหรือจำนวนที่ไม่รู้จักพร้อมเลขแถว", async () => {
  const missingHeaders = await workbookBytes([["ตำแหน่งงาน", "เพศ"], [1, "พนักงาน"]]);
  await assert.rejects(parseCareersWorkbook(missingHeaders), (error: unknown) => {
    assert.ok(error instanceof CareersWorkbookParseError);
    assert.equal(error.code, "missing-columns");
    return true;
  });

  const badGender = await workbookBytes([HEADERS, [1, "พนักงาน", "ฝ่ายขาย", "ไม่ทราบ", 1, "", "", ""]]);
  await assert.rejects(parseCareersWorkbook(badGender), (error: unknown) => {
    assert.ok(error instanceof CareersWorkbookParseError);
    assert.equal(error.code, "invalid-gender");
    assert.equal(error.row, 2);
    return true;
  });

  const badOpenings = await workbookBytes([HEADERS, [1, "พนักงาน", "ฝ่ายขาย", "ชาย", "หลายคน", "", "", ""]]);
  await assert.rejects(parseCareersWorkbook(badOpenings), (error: unknown) => {
    assert.ok(error instanceof CareersWorkbookParseError);
    assert.equal(error.code, "invalid-openings");
    assert.equal(error.row, 2);
    return true;
  });
});

test("Excel Careers: preview ต้องผ่านการตรวจซ้ำ และสร้าง draft ที่วันประกาศเป็น null พร้อมรหัสนำเข้าคงที่", async () => {
  const parsed = await parseCareersWorkbook(await validWorkbook());
  const rows: readonly CareersSpreadsheetRow[] = parsed;
  assert.deepEqual(validateCareersSpreadsheetRows(rows), rows);
  assert.equal(validateCareersSpreadsheetRows([{ ...rows[0], openings: 1000 }]), null);

  const writes = careersSpreadsheetWrites(rows);
  assert.deepEqual(careersSpreadsheetWrites(rows), writes);
  assert.equal(new Set(writes.map((row) => row.id)).size, rows.length);
  assert.ok(writes.every((row) => row.postedAt === null && row.status === "draft"));
  assert.ok(writes.every((row) => row.sortOrder >= 1000));
});
