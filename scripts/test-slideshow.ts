import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { HERO_SLIDES } from "@/features/home/slides";
import { en } from "@/lib/i18n/messages/en";
import { th } from "@/lib/i18n/messages/th";
import {
  HERO_SLIDE_FADE_MS,
  HERO_SLIDE_INTERVAL_MS,
  advanceIndex,
  hasSlideControls,
} from "@/lib/slideshow";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

/** ขนาดจริงของไฟล์ JPEG (อ่าน marker SOF) — คัดวิธีเดียวกับ scripts/test-contact.ts */
function readJpegSize(filePath: string): { width: number; height: number } | null {
  const buffer = readFileSync(filePath);
  let offset = 2;

  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    const isStartOfFrame =
      marker !== undefined && marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);

    if (isStartOfFrame) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }

    const length = buffer.readUInt16BE(offset + 2);
    offset += 2 + length;
  }

  return null;
}

test("advanceIndex: เลื่อนไปข้างหน้าและวนกลับมาภาพแรก", () => {
  assert.equal(advanceIndex(0, 3), 1);
  assert.equal(advanceIndex(1, 3), 2);
  assert.equal(advanceIndex(2, 3), 0, "ภาพสุดท้ายต้องวนกลับไปภาพแรก");
});

test("advanceIndex: ปุ่มย้อนหลังต้องวนไปภาพสุดท้าย (ไม่ติดลบ)", () => {
  assert.equal(advanceIndex(0, 3, -1), 2, "JS ให้ -1 % 3 = -1 จึงต้องบวก total กลับ");
  assert.equal(advanceIndex(2, 3, -1), 1);
});

test("advanceIndex: ค่าเพี้ยนต้องไม่ทำให้ได้ NaN หรือ index นอกช่วง", () => {
  assert.equal(advanceIndex(Number.NaN, 3), 1, "ถือ index เพี้ยนเป็น 0 แล้วเลื่อนต่อหนึ่งก้าว");
  assert.equal(advanceIndex(1.7, 3), 2, "ทศนิยมถูกตัดให้เป็นจำนวนเต็มก่อน");
  assert.equal(advanceIndex(99, 3), 1, "index หลุดช่วงต้องถูกพากลับเข้ามา");
  assert.equal(advanceIndex(-5, 3), 2);
  assert.equal(advanceIndex(0, 0), 0, "ไม่มีภาพเลยต้องไม่หารศูนย์");
  assert.equal(advanceIndex(0, -2), 0);
  assert.equal(advanceIndex(0, 2.5), 0, "จำนวนภาพที่ไม่ใช่จำนวนเต็มถือว่าใช้ไม่ได้");

  // สัญญาสำคัญ: ผลลัพธ์ต้องเป็น index ที่เอาไปใช้กับ array ได้เสมอ
  for (const total of [1, 2, 3, 7]) {
    for (const current of [Number.NaN, -99, -1, 0, 1, 1_000, 3.9]) {
      const next = advanceIndex(current, total);
      assert.ok(Number.isInteger(next), `advanceIndex(${current}, ${total}) ต้องเป็นจำนวนเต็ม`);
      assert.ok(next >= 0 && next < total, `advanceIndex(${current}, ${total}) = ${next} หลุดช่วง`);
    }
  }
});

test("hasSlideControls: มีภาพเดียวต้องไม่แสดงปุ่มลูกศร/จุด", () => {
  assert.equal(hasSlideControls(0), false);
  assert.equal(hasSlideControls(1), false, "ภาพเดียว = ไม่มีอะไรให้เลื่อน");
  assert.equal(hasSlideControls(2), true);
  assert.equal(hasSlideControls(3), true);
});

test("HERO_SLIDES: id ไม่ซ้ำ และ path อยู่ใต้ /slide/", () => {
  const ids = HERO_SLIDES.map((slide) => slide.id);

  assert.equal(new Set(ids).size, ids.length, "มี id ซ้ำ");
  assert.ok(HERO_SLIDES.length >= 2, "ต้องมีอย่างน้อย 2 ภาพจึงจะเรียกว่าสไลด์");

  for (const slide of HERO_SLIDES) {
    assert.ok(slide.src.startsWith("/slide/"), `${slide.id}: path ต้องอยู่ใต้ /slide/`);
  }
});

test("HERO_SLIDES: ไม่มีไฟล์ภาพค้างใน public/slide/ ที่ไม่มีใครอ้างถึง", () => {
  /*
    เจอจริงในรอบที่ 20: ผู้ใช้สลับภาพใน HERO_SLIDES แล้วไฟล์เดิม 2 ไฟล์ (544K + 136K)
    ยังค้างอยู่ใน public/ ซึ่งจะติดไปกับ build/deploy โดยไม่มีใครใช้
    → ด่านนี้เตือนให้ย้ายไฟล์ที่ยังไม่ใช้กลับไปโฟลเดอร์ต้นทาง `slide/` (ถูก .gitignore ไว้)
  */
  const used = new Set(HERO_SLIDES.map((slide) => slide.src.replace("/slide/", "")));
  const onDisk = readdirSync(path.join(PROJECT_ROOT, "public", "slide"));

  const orphans = onDisk.filter((name) => !used.has(name));

  assert.deepEqual(
    orphans,
    [],
    `มีไฟล์ที่ไม่มีใน HERO_SLIDES: ${orphans.join(", ")} — ถ้าตั้งใจเก็บไว้ก่อน ให้ย้ายไปโฟลเดอร์ slide/ (ต้นทาง)`,
  );
});

test("HERO_SLIDES: ไฟล์ภาพมีจริง เป็น JPEG และขนาดตรงกับที่ประกาศ", () => {
  for (const slide of HERO_SLIDES) {
    const filePath = path.join(PROJECT_ROOT, "public", slide.src.replace(/^\//, ""));
    assert.ok(existsSync(filePath), `${slide.id}: ไม่พบไฟล์ ${filePath}`);

    const signature = readFileSync(filePath).subarray(0, 2).toString("hex");
    assert.equal(signature, "ffd8", `${slide.id}: ไม่ใช่ไฟล์ JPEG`);

    const actual = readJpegSize(filePath);
    assert.ok(actual, `${slide.id}: อ่านขนาดไฟล์ไม่ได้`);
    assert.equal(actual.width, slide.width, `${slide.id}: ความกว้างไม่ตรงกับไฟล์จริง`);
    assert.equal(actual.height, slide.height, `${slide.id}: ความสูงไม่ตรงกับไฟล์จริง`);
  }
});

test("HERO_SLIDES: รูปที่มีลายน้ำของเพจต้นทางต้องถูกทำเครื่องหมายไว้", () => {
  // ภาพตัวอย่างรอการตลาดอนุมัติ — ถ้ามีการเปลี่ยนไฟล์ ต้องอัปเดตทั้งข้อมูลและ PRODUCT_ROADMAP § 9
  assert.deepEqual(
    HERO_SLIDES.filter((slide) => slide.watermarked).map((slide) => slide.id),
    ["event"],
  );
});

test("HERO_SLIDES: ทุกภาพมี alt ในพจนานุกรมทั้งสองภาษา และเป็นคำบรรยายภาพจริง", () => {
  for (const [locale, messages] of [
    ["th", th],
    ["en", en],
  ] as const) {
    for (const slide of HERO_SLIDES) {
      const alt = messages.hero.slides[slide.id].alt;

      assert.ok(alt.trim().length > 20, `${locale}: hero.slides.${slide.id}.alt สั้นเกินไป`);
      assert.ok(
        !alt.includes("ตัวอย่าง") && !alt.includes("placeholder"),
        `${locale}: hero.slides.${slide.id}.alt ต้องบรรยายภาพ ไม่ใช่บอกว่าเป็นภาพตัวอย่าง`,
      );
    }
  }
});

test("พจนานุกรมสไลด์: ป้ายกำกับปุ่มต้องมีครบทั้งสองภาษา", () => {
  for (const [locale, messages] of [
    ["th", th],
    ["en", en],
  ] as const) {
    for (const [name, value] of [
      ["galleryLabel", messages.hero.galleryLabel],
      ["gotoSlide", messages.hero.gotoSlide],
      ["pauseSlides", messages.hero.pauseSlides],
      ["playSlides", messages.hero.playSlides],
    ] as const) {
      assert.ok(value.trim().length > 0, `${locale}: hero.${name} ว่าง`);
    }
  }
});

test("จังหวะสไลด์: ต้องจางเสร็จก่อนเปลี่ยนภาพ (ไม่งั้นภาพจะตัดกันกลางทาง)", () => {
  assert.ok(
    HERO_SLIDE_INTERVAL_MS > HERO_SLIDE_FADE_MS * 2,
    `ระยะต่อภาพ (${HERO_SLIDE_INTERVAL_MS}ms) ต้องมากกว่าระยะจาง (${HERO_SLIDE_FADE_MS}ms) อย่างชัดเจน`,
  );
});

test("CSS: ความเร็วการจางของสไลด์ต้องตรงกับค่าที่โค้ดใช้", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.ok(css.includes("[data-hero-slide]"), "globals.css ต้องมีกฎ [data-hero-slide]");
  assert.ok(
    css.includes("[data-hero-slide][data-state=\"active\"]"),
    "globals.css ต้องมีกฎสำหรับภาพที่กำลังแสดง",
  );
  assert.ok(
    css.includes(`opacity ${HERO_SLIDE_FADE_MS}ms`),
    `transition ของสไลด์ต้องจาง ${HERO_SLIDE_FADE_MS}ms ให้ตรงกับ HERO_SLIDE_FADE_MS`,
  );
});
