import assert from "node:assert/strict";
import { test } from "node:test";

import {
  REVEAL_ATTRIBUTE,
  REVEAL_READY,
  REVEAL_INIT_SCRIPT,
  REVEALED_ATTRIBUTE,
  shouldRevealOnScroll,
} from "@/lib/scroll-reveal";

test("shouldRevealOnScroll: เปิดเฉพาะเมื่อรองรับ IntersectionObserver และผู้ใช้ไม่ปิดอนิเมชัน", () => {
  assert.equal(
    shouldRevealOnScroll({ hasIntersectionObserver: true, prefersReducedMotion: false }),
    true,
  );

  // ผู้ใช้ขอ reduced-motion → ห้ามฝืน (เนื้อหาต้องแสดงปกติ)
  assert.equal(
    shouldRevealOnScroll({ hasIntersectionObserver: true, prefersReducedMotion: true }),
    false,
  );

  // เบราว์เซอร์เก่าไม่มี IntersectionObserver → ไม่ซ่อนเนื้อหา (กันเนื้อหาหายถาวร)
  assert.equal(
    shouldRevealOnScroll({ hasIntersectionObserver: false, prefersReducedMotion: false }),
    false,
  );
  assert.equal(
    shouldRevealOnScroll({ hasIntersectionObserver: false, prefersReducedMotion: true }),
    false,
  );
});

test("REVEAL_INIT_SCRIPT: เป็น JavaScript ที่รันได้จริง", () => {
  // ถ้าไวยากรณ์พัง หน้าจะพังตั้งแต่ก่อน paint — เช็คด้วยการ compile
  assert.doesNotThrow(() => new Function(REVEAL_INIT_SCRIPT));
});

test("REVEAL_INIT_SCRIPT: มีเงื่อนไขกันเหมือน shouldRevealOnScroll()", () => {
  // ต้องมีทั้งสองเงื่อนไข ไม่งั้นเนื้อหาจะถูกซ่อนในเครื่องที่ปิดอนิเมชัน/ไม่รองรับ
  assert.ok(REVEAL_INIT_SCRIPT.includes("IntersectionObserver"));
  assert.ok(REVEAL_INIT_SCRIPT.includes("prefers-reduced-motion: reduce"));

  // ต้องครอบ try/catch เพื่อไม่ให้สคริปต์พังทำหน้าค้าง
  assert.ok(REVEAL_INIT_SCRIPT.includes("try{"));
});

test("ชื่อ attribute: ต้องเป็นค่าที่ CSS/คอมโพเนนต์อ้างถึงตรงกัน", () => {
  assert.equal(REVEAL_ATTRIBUTE, "data-reveal");
  assert.equal(REVEAL_READY, "ready");
  assert.equal(REVEALED_ATTRIBUTE, "data-revealed");
});
