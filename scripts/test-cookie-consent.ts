import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  COOKIE_CONSENT_ATTRIBUTE,
  COOKIE_CONSENT_INIT_SCRIPT,
  COOKIE_CONSENT_STORAGE_KEY,
  COOKIE_CONSENT_VALUES,
  isCookieConsent,
} from "@/lib/cookie-consent";

test("isCookieConsent: รับเฉพาะค่าที่ประกาศไว้", () => {
  for (const value of COOKIE_CONSENT_VALUES) {
    assert.equal(isCookieConsent(value), true);
  }

  assert.equal(isCookieConsent("denied"), false);
  assert.equal(isCookieConsent(""), false);
  assert.equal(isCookieConsent(null), false);
  assert.equal(isCookieConsent(undefined), false);
  assert.equal(isCookieConsent(true), false);
  assert.equal(isCookieConsent("ALL"), false, "ตัวพิมพ์ใหญ่ต้องไม่ผ่าน");
});

test("สคริปต์ก่อน paint: ต้องอ้างคีย์และ attribute เดียวกับที่โค้ดใช้", () => {
  assert.ok(COOKIE_CONSENT_INIT_SCRIPT.includes(COOKIE_CONSENT_STORAGE_KEY));
  assert.ok(COOKIE_CONSENT_INIT_SCRIPT.includes(COOKIE_CONSENT_ATTRIBUTE));
  assert.ok(COOKIE_CONSENT_INIT_SCRIPT.startsWith("(function(){"));
});

test("สคริปต์ก่อน paint: ต้องไม่พังเมื่อ localStorage ถูกบล็อก", () => {
  assert.ok(COOKIE_CONSENT_INIT_SCRIPT.includes("try"));
  assert.ok(COOKIE_CONSENT_INIT_SCRIPT.includes("catch"));
});

test("attribute ต้องตรงกับกฎ CSS ที่ใช้ซ่อนแถบ", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  // ถ้าแก้ชื่อ attribute ที่หนึ่งแต่ลืมอีกที่ แถบคุกกี้จะโผล่ทุกครั้งที่โหลดหน้า
  assert.ok(
    css.includes(`html[${COOKIE_CONSENT_ATTRIBUTE}] [data-cookie-banner]`),
    `globals.css ต้องมีกฎ html[${COOKIE_CONSENT_ATTRIBUTE}] [data-cookie-banner]`,
  );
});
