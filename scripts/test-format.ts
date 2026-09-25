import assert from "node:assert/strict";
import { test } from "node:test";

import { formatDate, formatNumber, formatYear, isDisplayableYear } from "@/lib/format";

test("formatDate: จัดรูปแบบตามภาษา", () => {
  const english = formatDate("2026-08-19", "en");
  assert.ok(english.includes("2026"), `ได้: ${english}`);

  const thai = formatDate("2026-08-19", "th");
  assert.ok(thai.length > 0);
  assert.notEqual(thai, english, "สองภาษาต้องได้รูปแบบคนละแบบ");
});

test("formatDate: วันที่ใช้ไม่ได้ต้องคืนสตริงว่าง ไม่ใช่ Invalid Date", () => {
  assert.equal(formatDate("", "th"), "");
  assert.equal(formatDate("ไม่ใช่วันที่", "th"), "");
  assert.equal(formatDate("2026-13-45", "en"), "");
  assert.equal(formatDate("2026-02-30T25:00:00Z", "en"), "");
});

test("formatNumber: จัดหลักตามภาษา", () => {
  assert.equal(formatNumber(1250, "en"), "1,250");
  assert.equal(formatNumber(0, "en"), "0");
  assert.equal(formatNumber(-1500, "en"), "-1,500");
});

test("formatNumber: ค่าที่ไม่ใช่จำนวนจำกัดต้องคืนสตริงว่าง", () => {
  assert.equal(formatNumber(Number.NaN, "en"), "");
  assert.equal(formatNumber(Number.POSITIVE_INFINITY, "en"), "");
});

test("isDisplayableYear: รับเฉพาะปี 4 หลัก", () => {
  assert.equal(isDisplayableYear(1000), true);
  assert.equal(isDisplayableYear(1972), true);
  assert.equal(isDisplayableYear(9999), true);

  // ค่าเพี้ยนที่ถ้าหลุดไปถึงหน้าจอจะกลายเป็น "NaN" หรือปีติดลบ
  assert.equal(isDisplayableYear(999), false);
  assert.equal(isDisplayableYear(10000), false);
  assert.equal(isDisplayableYear(0), false);
  assert.equal(isDisplayableYear(-1972), false);
  assert.equal(isDisplayableYear(Number.NaN), false);
  assert.equal(isDisplayableYear(Number.POSITIVE_INFINITY), false);
  assert.equal(isDisplayableYear(1972.5), false);
});

test("formatYear: ไทยใช้พุทธศักราช อังกฤษใช้คริสต์ศักราช", () => {
  assert.equal(formatYear(1972, "en"), "1972");

  const thai = formatYear(1972, "th");
  assert.ok(thai.length > 0, "ต้องไม่ว่าง");
  assert.notEqual(thai, "1972", "ภาษาไทยต้องถูกแปลงเป็นพุทธศักราช");
});

test("formatYear: ปีที่แสดงไม่ได้ต้องคืนสตริงว่าง ไม่ใช่ค่าประหลาดบนหน้าจอ", () => {
  for (const year of [Number.NaN, Number.POSITIVE_INFINITY, 0, -1972, 999, 10000, 1972.5]) {
    assert.equal(formatYear(year, "th"), "", `ปี ${year} ต้องไม่แสดง`);
    assert.equal(formatYear(year, "en"), "", `ปี ${year} ต้องไม่แสดง`);
  }
});
