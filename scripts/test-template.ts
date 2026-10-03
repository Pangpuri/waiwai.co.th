import assert from "node:assert/strict";
import { test } from "node:test";

import { fillTemplate } from "@/lib/i18n/template";

test("template: เติมค่าลงในข้อความ", () => {
  assert.equal(fillTemplate("เขียน {written} แถว", { written: 140 }), "เขียน 140 แถว");
  assert.equal(
    fillTemplate("{a} · {b} · {a}", { a: "หนึ่ง", b: 2 }),
    "หนึ่ง · 2 · หนึ่ง",
    "คีย์เดิมใช้ซ้ำได้",
  );
});

test("template: คีย์ที่ไม่ได้ส่งมาคงรูปไว้ (ไม่กลายเป็นช่องว่างเงียบ ๆ)", () => {
  assert.equal(fillTemplate("ลบ {deleted} แถว", {}), "ลบ {deleted} แถว");
  assert.equal(fillTemplate("สูงสุด {n} รายการ", { n: 0 }), "สูงสุด 0 รายการ");
});

test("template: ข้อความที่ไม่มีที่ให้เติมต้องไม่เปลี่ยน", () => {
  assert.equal(fillTemplate("บันทึกแล้ว", { written: 1 }), "บันทึกแล้ว");
  assert.equal(fillTemplate("", { written: 1 }), "");
});

test("template: ไม่แต่วงเล็บปีกกาที่ไม่ใช่คีย์", () => {
  assert.equal(fillTemplate("{ } {..} {a b}", { a: "x" }), "{ } {..} {a b}");
});
