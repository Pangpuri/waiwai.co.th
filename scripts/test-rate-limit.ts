import assert from "node:assert/strict";
import { test } from "node:test";

import {
  FAILURE_WINDOW_MS,
  LOCKOUT_MS,
  MAX_FAILURES,
  evaluateAttempts,
  retryAfterMinutes,
} from "@/lib/auth/rate-limit";

/** เทสต์การจำกัดการพยายามล็อกอิน (X2.1) — ตรรกะล้วน ไม่ต้องมี DB */

const NOW = 1_800_000_000_000;
const fail = (minutesAgo: number) => ({ at: NOW - minutesAgo * 60_000, succeeded: false });
const pass = (minutesAgo: number) => ({ at: NOW - minutesAgo * 60_000, succeeded: true });

test("ไม่ถึงเพดาน = ยังไม่ล็อก", () => {
  const attempts = Array.from({ length: MAX_FAILURES - 1 }, (_unused, index) => fail(index));
  const state = evaluateAttempts(attempts, NOW);
  assert.equal(state.locked, false);
  assert.equal(state.failures, MAX_FAILURES - 1);
});

test("ผิดครบเพดาน = ล็อก และบอกเวลารอที่เหลือ", () => {
  const attempts = [fail(0), fail(1), fail(2), fail(3), fail(4)];
  const state = evaluateAttempts(attempts, NOW);

  assert.equal(state.locked, true);
  assert.equal(state.failures, MAX_FAILURES);
  /* ล้มเหลวล่าสุดเกิดเมื่อสักครู่ ⇒ ต้องรอเกือบเต็มระยะล็อก */
  assert.ok(state.retryAfterMs > LOCKOUT_MS - 60_000, `ควรเหลือใกล้เต็ม แต่ได้ ${state.retryAfterMs}`);
  assert.ok(state.retryAfterMs <= LOCKOUT_MS);
});

test("หมดระยะล็อกแล้ว = ปลดล็อกอัตโนมัติ", () => {
  const attempts = Array.from({ length: MAX_FAILURES }, (_unused, index) => fail(index));
  const after = evaluateAttempts(attempts, NOW + LOCKOUT_MS + 1_000);
  assert.equal(after.locked, false);
});

test("★ ล็อกอินสำเร็จ = ล้างประวัติ (นับใหม่)", () => {
  const attempts = [pass(1), fail(2), fail(3), fail(4), fail(5), fail(6)];
  const state = evaluateAttempts(attempts, NOW);
  assert.equal(state.locked, false, "ความล้มเหลวก่อนสำเร็จต้องไม่ถูกนับ");
  assert.equal(state.failures, 0);
});

test("ความล้มเหลวที่เก่ากว่าช่วงเวลาที่นับ = ไม่ถูกนำมาคิด", () => {
  const old = Array.from({ length: MAX_FAILURES }, (_unused, index) => fail(60 + index));
  const state = evaluateAttempts(old, NOW);
  assert.equal(state.locked, false);
  assert.equal(state.failures, 0);
});

test("การนับคร่อมช่วงเวลา: 5 ครั้งล่าสุดที่ยังอยู่ในช่วง = ล็อก", () => {
  const mixed = [fail(1), fail(2), fail(3), fail(4), fail(5), fail(40)];
  const state = evaluateAttempts(mixed, NOW);
  assert.equal(state.locked, true);
  assert.equal(state.failures, MAX_FAILURES, "ครั้งที่ 40 นาทีที่แล้วอยู่นอกช่วง");

  const boundary = evaluateAttempts([fail(1), fail(2), fail(3), fail(4), fail(Math.ceil(FAILURE_WINDOW_MS / 60_000) + 1)], NOW);
  assert.equal(boundary.locked, false, "ตัวที่หลุดช่วงทำให้ไม่ครบ 5");
});

test("retryAfterMinutes: ปัดขึ้นและไม่ต่ำกว่า 1 นาที", () => {
  assert.equal(retryAfterMinutes(1), 1);
  assert.equal(retryAfterMinutes(60_000), 1);
  assert.equal(retryAfterMinutes(60_001), 2);
  assert.equal(retryAfterMinutes(0), 1);
});

test("ไม่มีประวัติเลย = ไม่ล็อก", () => {
  assert.equal(evaluateAttempts([], NOW).locked, false);
});
