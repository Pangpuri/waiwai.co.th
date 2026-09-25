import assert from "node:assert/strict";
import { test } from "node:test";

import { isValidEmail } from "@/lib/validate";

test("isValidEmail: รูปแบบที่ถูกต้อง", () => {
  assert.equal(isValidEmail("name@example.com"), true);
  assert.equal(isValidEmail("first.last@example.co.th"), true);
  assert.equal(isValidEmail("user+tag@sub.domain.io"), true);
  assert.equal(isValidEmail("  name@example.com  "), true, "ต้องตัดช่องว่างหัวท้าย");
});

test("isValidEmail: รูปแบบที่ผิด", () => {
  assert.equal(isValidEmail(""), false);
  assert.equal(isValidEmail("   "), false);
  assert.equal(isValidEmail("name"), false);
  assert.equal(isValidEmail("name@"), false);
  assert.equal(isValidEmail("@example.com"), false);
  assert.equal(isValidEmail("name@example"), false, "ต้องมีจุดในโดเมน");
  assert.equal(isValidEmail("name@example.c"), false, "TLD ต้องยาวอย่างน้อย 2 ตัว");
  assert.equal(isValidEmail("na me@example.com"), false);
  assert.equal(isValidEmail("two@@example.com"), false);
  assert.equal(isValidEmail("a..b@example.com"), false);
});

test("isValidEmail: ค่าที่ไม่ใช่สตริงต้องไม่ทำให้พัง", () => {
  assert.equal(isValidEmail(null), false);
  assert.equal(isValidEmail(undefined), false);
  assert.equal(isValidEmail(123), false);
  assert.equal(isValidEmail({ toString: () => "a@b.com" }), false);
});

test("isValidEmail: ยาวเกินกำหนดต้องไม่ผ่าน", () => {
  const local = "a".repeat(250);
  assert.equal(isValidEmail(`${local}@example.com`), false);

  // ยาวพอดีเพดาน (254) ควรผ่าน
  const localAtLimit = "a".repeat(254 - "@example.com".length);
  assert.equal(isValidEmail(`${localAtLimit}@example.com`), true);
});
