import assert from "node:assert/strict";
import { test } from "node:test";

import {
  REVEAL_ATTRIBUTE,
  REVEAL_DELAY_MS,
  REVEAL_DURATION_MS,
  REVEAL_READY,
  REVEAL_ROOT_MARGIN,
  REVEAL_INIT_SCRIPT,
  REVEALED_ATTRIBUTE,
  shouldRevealOnScroll,
} from "@/lib/scroll-reveal";
import { readStrippedCss } from "./css-source.ts";


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

test("จังหวะการจาง: CSS ต้องตรงกับค่าที่โค้ดใช้ (ระยะเวลา + ดีเลย์)", async () => {
  const css = await readStrippedCss();

  /*
    รอบที่ 21: การตลาดขอ "เพิ่ม motion delay ตอนเลื่อนเพจลงอีกนิด" → 700 → 900ms + หน่วง 90ms
    เทสต์นี้กันไม่ให้ค่าใน CSS กับค่าใน TS เพี้ยนกัน (แก้ที่เดียวแล้วลืมอีกที่ = จังหวะไม่ตรงที่ตกลง)
  */
  assert.ok(
    css.includes(`opacity ${REVEAL_DURATION_MS}ms`) && css.includes(`transform ${REVEAL_DURATION_MS}ms`),
    `transition ของ opacity/transform ต้องเป็น ${REVEAL_DURATION_MS}ms`,
  );
  assert.ok(
    css.includes(`cubic-bezier(0.22, 1, 0.36, 1) ${REVEAL_DELAY_MS}ms`),
    `ต้องมีดีเลย์ ${REVEAL_DELAY_MS}ms ก่อนเริ่มจาง (ค่าที่การตลาดขอ)`,
  );
});

test("จังหวะการจาง: จุดที่เริ่มจางต้องตรงกันทั้งสคริปต์ observer และ CSS", () => {
  assert.equal(REVEAL_ROOT_MARGIN, "0px 0px -18% 0px");

  // ค่าลบด้านล่าง = ต้องเลื่อนให้พ้นขอบล่างขึ้นมาก่อน (เริ่มช้าลงตามที่ขอ)
  const bottom = Number(/-(\d+)%/.exec(REVEAL_ROOT_MARGIN)?.[1]);
  assert.ok(bottom > 0, "ต้องเป็นค่าลบด้านล่าง (เริ่มจางหลังเลื่อนผ่านไปแล้ว)");
  assert.ok(bottom >= 12, "ต้องไม่เริ่มจางเร็วไปกว่ารอบก่อน (−12%)");
});
