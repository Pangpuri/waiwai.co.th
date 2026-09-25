import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { MOURNING_CLOSE_MS, MOURNING_IMAGES } from "@/features/shell/mourning";
import { en } from "@/lib/i18n/messages/en";
import { th } from "@/lib/i18n/messages/th";
import {
  MOURNING_ATTRIBUTE,
  MOURNING_INIT_SCRIPT,
  MOURNING_STATE_DISMISSED,
  MOURNING_STATE_SHOWN,
  MOURNING_STORAGE_KEY,
  isMourningDismissed,
} from "@/lib/mourning-notice";

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

test("MOURNING_IMAGES: มีภาพอย่างน้อย 1 ภาพ · id ไม่ซ้ำ · อยู่ใต้ /rip/", () => {
  assert.ok(MOURNING_IMAGES.length >= 1, "ต้องมีภาพประกาศอย่างน้อย 1 ภาพ");

  const ids = MOURNING_IMAGES.map((image) => image.id);
  assert.equal(new Set(ids).size, ids.length, "มี id ซ้ำ");

  for (const image of MOURNING_IMAGES) {
    assert.ok(image.src.startsWith("/rip/"), `${image.id}: path ต้องอยู่ใต้ /rip/`);
  }
});

test("MOURNING_IMAGES: ไฟล์มีจริง เป็น JPEG และขนาดตรงกับที่ประกาศ", () => {
  for (const image of MOURNING_IMAGES) {
    const filePath = path.join(PROJECT_ROOT, "public", image.src.replace(/^\//, ""));
    assert.ok(existsSync(filePath), `${image.id}: ไม่พบไฟล์ ${filePath}`);

    const signature = readFileSync(filePath).subarray(0, 2).toString("hex");
    assert.equal(signature, "ffd8", `${image.id}: ไม่ใช่ไฟล์ JPEG`);

    const actual = readJpegSize(filePath);
    assert.ok(actual, `${image.id}: อ่านขนาดไฟล์ไม่ได้`);
    assert.equal(actual.width, image.width, `${image.id}: ความกว้างไม่ตรงกับไฟล์จริง`);
    assert.equal(actual.height, image.height, `${image.id}: ความสูงไม่ตรงกับไฟล์จริง`);
  }
});

test("พจนานุกรม mourning: alt ของทุกภาพและป้ายกำกับต้องครบทั้งสองภาษา", () => {
  for (const [locale, messages] of [
    ["th", th],
    ["en", en],
  ] as const) {
    for (const image of MOURNING_IMAGES) {
      const alt = messages.mourning.images[image.id].alt;
      assert.ok(alt.trim().length > 20, `${locale}: mourning.images.${image.id}.alt สั้นเกินไป`);
    }

    for (const [name, value] of [
      ["dialogLabel", messages.mourning.dialogLabel],
      ["caption", messages.mourning.caption],
      ["close", messages.mourning.close],
      ["prev", messages.mourning.prev],
      ["next", messages.mourning.next],
      ["gotoSlide", messages.mourning.gotoSlide],
    ] as const) {
      assert.ok(value.trim().length > 0, `${locale}: mourning.${name} ว่าง`);
    }
  }
});

test("สคริปต์ก่อน paint: ต้องอ้างคีย์/attribute เดียวกับที่โค้ดใช้ และทน localStorage ถูกบล็อก", () => {
  assert.ok(MOURNING_INIT_SCRIPT.includes(MOURNING_STORAGE_KEY));
  assert.ok(MOURNING_INIT_SCRIPT.includes(MOURNING_ATTRIBUTE));
  assert.ok(MOURNING_INIT_SCRIPT.includes(MOURNING_STATE_SHOWN));
  assert.ok(MOURNING_INIT_SCRIPT.startsWith("(function(){"));
  assert.ok(MOURNING_INIT_SCRIPT.includes("try"), "ต้องมี try กัน localStorage โยน error");
  assert.ok(MOURNING_INIT_SCRIPT.includes("catch"), "ต้องมี catch");
});

test("สคริปต์ก่อน paint: ผู้ใช้ที่เคยกดปิดแล้วต้องไม่ถูกเปิดหน้าต่างอีก", () => {
  // ถ้าลบ `if(v)return;` ออก หน้าต่างไว้อาลัยจะเด้งทุกครั้งที่โหลดหน้าใหม่
  assert.ok(
    /if\s*\(\s*v\s*\)\s*return;/.test(MOURNING_INIT_SCRIPT),
    "สคริปต์ต้องออกก่อนติด attribute เมื่อ localStorage มีค่าแล้ว",
  );
});

test("isMourningDismissed: รับเฉพาะสตริงที่ไม่ว่าง", () => {
  assert.equal(isMourningDismissed(MOURNING_STATE_DISMISSED), true);
  assert.equal(isMourningDismissed("yes"), true);
  assert.equal(isMourningDismissed(""), false);
  assert.equal(isMourningDismissed(null), false);
  assert.equal(isMourningDismissed(undefined), false);
  assert.equal(isMourningDismissed(0), false);
  assert.equal(isMourningDismissed(true), false);
});

test("CSS: หน้าต่างต้องถูกซ่อนไว้ก่อน แล้วค่อยเปิดเมื่อสคริปต์ยืนยัน", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.ok(
    /\[data-mourning-notice\]\s*\{\s*display:\s*none;/.test(css),
    "ค่าเริ่มต้นของหน้าต่างต้องเป็น display: none (กัน modal ที่กดปิดไม่ได้ตอนไม่มี JavaScript)",
  );
  assert.ok(
    css.includes(`html[${MOURNING_ATTRIBUTE}="${MOURNING_STATE_SHOWN}"] [data-mourning-notice]`),
    `globals.css ต้องมีกฎ html[${MOURNING_ATTRIBUTE}="${MOURNING_STATE_SHOWN}"] [data-mourning-notice]`,
  );
  assert.ok(
    css.includes("[data-mourning-notice][data-closing]"),
    "globals.css ต้องมีกฎจางออกตอนกดปิด",
  );
  assert.ok(
    css.includes(`opacity ${MOURNING_CLOSE_MS}ms`),
    `transition ตอนปิดต้องเป็น ${MOURNING_CLOSE_MS}ms ให้ตรงกับ MOURNING_CLOSE_MS`,
  );
});
