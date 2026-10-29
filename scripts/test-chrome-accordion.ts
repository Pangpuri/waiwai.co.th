import assert from "node:assert/strict";
import { test } from "node:test";

import { toggleOpenId } from "@/lib/chrome/accordion";

/**
 * เทสต์กติกา accordion ของ navbar editor (รอบที่ 319)
 * - เปิดได้ทีละรายการ
 * - คลิกรายการเดิมซ้ำ = ปิด
 */

test("accordion: จากสถานะปิดทั้งหมด คลิกรายการแรก = เปิดรายการนั้น", () => {
  assert.equal(toggleOpenId(null, "item-1"), "item-1");
});

test("accordion: เปิดรายการใหม่ = ปิดรายการเดิมอัตโนมัติ (มีค่าเดียว)", () => {
  assert.equal(toggleOpenId("item-1", "item-2"), "item-2");
  /* เปิดรายการที่สามต่อจากรายการที่สอง ก็ยังมีค่าเดียว */
  assert.equal(toggleOpenId("item-2", "item-3"), "item-3");
});

test("accordion: คลิกรายการที่เปิดอยู่ซ้ำ = ปิดกลับเป็น null", () => {
  assert.equal(toggleOpenId("item-1", "item-1"), null);
});
