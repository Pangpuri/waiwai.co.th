import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

import {
  HERO_CARD_CLOSE_MS,
  HERO_CARD_IMAGE,
  HERO_CARD_WIGGLE_MS,
} from "@/features/home/hero-card";
import { en } from "@/lib/i18n/messages/en";
import { th } from "@/lib/i18n/messages/th";
import {
  HERO_CARD_ATTRIBUTE,
  HERO_CARD_INIT_SCRIPT,
  HERO_CARD_STATE_SHOWN,
  HERO_CARD_STORAGE_KEY,
} from "@/lib/hero-card";
import { COOKIE_CONSENT_ATTRIBUTE } from "@/lib/cookie-consent";
import { MOURNING_ATTRIBUTE, MOURNING_STORAGE_KEY } from "@/lib/mourning-notice";
import { REVEAL_ATTRIBUTE } from "@/lib/scroll-reveal";

import { readStrippedCss } from "./css-source.ts";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

/* ── ภาพของการ์ด ───────────────────────────────────────────────────────────── */

test("การ์ด hero: ไฟล์ภาพมีจริง เป็น JPEG และขนาดตรงกับที่ประกาศ", () => {
  const filePath = path.join(PROJECT_ROOT, "public", HERO_CARD_IMAGE.src.replace(/^\//, ""));
  const buffer = readFileSync(filePath);

  assert.equal(buffer.subarray(0, 2).toString("hex"), "ffd8", "ไม่ใช่ไฟล์ JPEG");

  // อ่านขนาดจริงจาก marker SOF ของ JPEG (วิธีเดียวกับ scripts/test-mourning-notice.ts)
  let width = 0;
  let height = 0;
  let offset = 2;

  while (offset < buffer.length - 1) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    const isStartOfFrame =
      marker !== undefined && marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);

    if (isStartOfFrame) {
      height = buffer.readUInt16BE(offset + 5);
      width = buffer.readUInt16BE(offset + 7);
      break;
    }

    offset += 2 + buffer.readUInt16BE(offset + 2);
  }

  assert.equal(width, HERO_CARD_IMAGE.width, "ความกว้างไม่ตรงกับไฟล์จริง");
  assert.equal(height, HERO_CARD_IMAGE.height, "ความสูงไม่ตรงกับไฟล์จริง");
});

test("การ์ด hero: ภาพที่ใช้เป็นภาพที่มีลายน้ำของเจ้าของต้นทาง (บันทึกไว้แล้ว)", () => {
  /*
    ภาพนี้เป็นโปสเตอร์แคมเปญที่เผยแพร่ทางเพจ และมีลายน้ำ "Brand think" ติดอยู่
    เทสต์นี้ไม่ได้ห้ามใช้ แต่กันไม่ให้ "ธงเตือน" หายไปเงียบ ๆ ตอนมีคนเปลี่ยนภาพ
    → ถ้าเปลี่ยนเป็นภาพสะอาดแล้ว ให้ตั้ง watermarked: false พร้อมอัปเดตหมายเหตุใน PRODUCT_ROADMAP.md
  */
  assert.equal(typeof HERO_CARD_IMAGE.watermarked, "boolean");
  assert.equal(HERO_CARD_IMAGE.watermarked, true, "ภาพชุดนี้มีลายน้ำ — ต้องคงธงเตือนไว้จนกว่าจะเปลี่ยนภาพ");
});

/* ── สถานะ "ปิดไว้ถึงสิ้นวัน" ──────────────────────────────────────────────── */

test("การ์ด hero: ใช้คีย์/attribute คนละชุดกับประกาศไว้อาลัย (ไม่กวนกัน)", () => {
  // กันบั๊กคัดลอกโค้ด: ถ้าเผลอใช้คีย์เดียวกัน การ์ดกับประกาศไว้อาลัยจะปิดพร้อมกันโดยไม่ตั้งใจ
  assert.notEqual(HERO_CARD_STORAGE_KEY, MOURNING_STORAGE_KEY);
  assert.notEqual(HERO_CARD_ATTRIBUTE, MOURNING_ATTRIBUTE);
});

type SandboxOptions = {
  readonly stored?: string | null;
  readonly now: Date;
  readonly storageThrows?: boolean;
};

/** รันสคริปต์ก่อน paint ของการ์ดจริงใน sandbox — คืนค่า attribute ที่ติดบน <html> + คีย์ที่ถูกอ่าน */
function runCardInitScript({ stored = null, now, storageThrows = false }: SandboxOptions): {
  readonly attribute: string | null;
  readonly keysRead: readonly string[];
} {
  const attributes = new Map<string, string>();
  const keysRead: string[] = [];

  const context = vm.createContext({
    document: {
      documentElement: {
        setAttribute: (name: string, value: string) => {
          attributes.set(name, value);
        },
      },
    },
    localStorage: {
      getItem: (key: string) => {
        keysRead.push(key);
        if (storageThrows) throw new Error("storage ถูกบล็อก");
        return key === HERO_CARD_STORAGE_KEY ? stored : null;
      },
    },
    Date: class extends Date {
      constructor() {
        super(now.getTime());
      }
    },
  });

  vm.runInContext(HERO_CARD_INIT_SCRIPT, context);

  return { attribute: attributes.get(HERO_CARD_ATTRIBUTE) ?? null, keysRead };
}

const TODAY = new Date(2026, 8, 25, 10, 30); // 25 ก.ย. 2026 เวลาท้องถิ่น

test("การ์ด hero: ยังไม่เคยกดปิด → ต้องติด attribute ให้ CSS เปิดการ์ด", () => {
  assert.equal(runCardInitScript({ now: TODAY }).attribute, HERO_CARD_STATE_SHOWN);
});

test("การ์ด hero: ติ๊ก 'ไม่แสดงอีกในวันนี้' → วันเดียวกันไม่ขึ้น แต่ขึ้นวันใหม่กลับมา", () => {
  assert.equal(
    runCardInitScript({ stored: "2026-09-25", now: TODAY }).attribute,
    null,
    "วันที่เก็บไว้ตรงกับวันนี้ ต้องไม่ติด attribute",
  );
  assert.equal(
    runCardInitScript({ stored: "2026-09-24", now: TODAY }).attribute,
    HERO_CARD_STATE_SHOWN,
    "ค่าของเมื่อวานต้องไม่ถูกตีความว่าปิดไว้วันนี้",
  );
});

test("การ์ด hero: สคริปต์อ่านคีย์ของตัวเองเท่านั้น", () => {
  assert.deepEqual(runCardInitScript({ now: TODAY }).keysRead, [HERO_CARD_STORAGE_KEY]);
});

test("การ์ด hero: localStorage ถูกบล็อก → ยังแสดงการ์ด (ไม่ปิดประกาศทิ้ง)", () => {
  assert.equal(
    runCardInitScript({ now: TODAY, storageThrows: true }).attribute,
    HERO_CARD_STATE_SHOWN,
  );
});

/* ── พจนานุกรม ────────────────────────────────────────────────────────────── */

test("พจนานุกรม hero.card: ข้อความครบทั้งสองภาษาและยาวพอจะอ่านออก", () => {
  for (const [locale, messages] of [
    ["th", th],
    ["en", en],
  ] as const) {
    const card = messages.hero.card;

    for (const [name, value] of [
      ["title", card.title],
      ["body", card.body],
      ["link", card.link],
      ["close", card.close],
      ["muteToday", card.muteToday],
    ] as const) {
      assert.ok(value.trim().length > 0, `${locale}: hero.card.${name} ว่าง`);
    }

    assert.ok(card.alt.trim().length > 20, `${locale}: hero.card.alt สั้นเกินไป`);
  }
});

/* ── CSS ──────────────────────────────────────────────────────────────────── */

test("CSS: การ์ดต้องถูกซ่อนไว้ก่อน แล้วค่อยเปิดเมื่อสคริปต์ยืนยัน", async () => {
  const css = await readStrippedCss();

  assert.ok(
    // กฎนี้อาจมีตัวแปร (--hero-card-tilt) นำหน้า จึงจับแบบ "ในบล็อกเดียวกัน"
    /\[data-hero-card-panel\]\s*\{[^}]*display:\s*none/.test(css),
    "ค่าเริ่มต้นของการ์ดต้องเป็น display: none (กันการ์ดตุ๊บขึ้นมาหลัง hydrate)",
  );
  assert.ok(
    css.includes(`html[${HERO_CARD_ATTRIBUTE}="${HERO_CARD_STATE_SHOWN}"] [data-hero-card-panel]`),
    `globals.css ต้องมีกฎ html[${HERO_CARD_ATTRIBUTE}="${HERO_CARD_STATE_SHOWN}"] [data-hero-card-panel]`,
  );
  assert.ok(
    css.includes("[data-hero-card-panel][data-closing]"),
    "globals.css ต้องมีกฎจางออกตอนกดปิด",
  );
  assert.ok(
    css.includes(`opacity ${HERO_CARD_CLOSE_MS}ms`),
    `transition ตอนปิดต้องเป็น ${HERO_CARD_CLOSE_MS}ms ให้ตรงกับ HERO_CARD_CLOSE_MS`,
  );
});

test("CSS: การ์ด 'ยิก' เรียกความสนใจ — ต้องตรงกับค่าที่โค้ดใช้", async () => {
  const css = await readStrippedCss();

  assert.ok(css.includes("@keyframes hero-card-wiggle"), "ต้องมี keyframes ของการยิก");
  assert.ok(
    css.includes(`hero-card-wiggle ${HERO_CARD_WIGGLE_MS}ms`),
    `รอบการยิกต้องเป็น ${HERO_CARD_WIGGLE_MS}ms ให้ตรงกับ HERO_CARD_WIGGLE_MS`,
  );
  assert.ok(
    css.includes("calc(var(--hero-card-tilt)"),
    "keyframes ต้องอ้างมุมเอียงตั้งต้นจากตัวแปรเดียวกัน จึงจะไม่เอียงเพี้ยนตอนยิก",
  );
  assert.ok(
    css.includes("rotate: var(--hero-card-tilt)"),
    "ต้องมีมุมเอียงตั้งต้นนอกแอนิเมชันด้วย (เผื่อผู้ใช้ขอ reduced-motion แล้วแอนิเมชันถูกปิด)",
  );
  assert.ok(
    css.includes("animation-play-state: running, paused"),
    "ต้องหยุดยิกตอน hover/โฟกัส/กำลังปิดการ์ด (แอนิเมชันแรกคือตอนเปิด ต้องยังทำงาน)",
  );
});

test("CSS: มุมเอียงของการ์ด — จอเล็กตั้งตรง จอใหญ่เอียง", async () => {
  const css = await readStrippedCss();

  assert.ok(/--hero-card-tilt:\s*0deg/.test(css), "ค่าเริ่มต้นต้องตั้งตรง");
  assert.ok(
    /@media \(min-width: 1024px\)[\s\S]{0,200}--hero-card-tilt:\s*-2deg/.test(css),
    "จอใหญ่ (lg) ต้องเอียง -2deg",
  );
});

test("CSS: ผู้ใช้ขอ reduced-motion → การยิกต้องถูกกฎกลางปิด", async () => {
  const css = await readStrippedCss();

  // กฎกลางต้องครอบทุก element และปิด animation จริง ไม่ใช่เฉพาะ transition
  assert.ok(
    /@media \(prefers-reduced-motion: reduce\)[\s\S]{0,600}\*,[\s\S]{0,40}animation-duration: 0\.01ms !important[\s\S]{0,80}animation-iteration-count: 1 !important/.test(
      css,
    ),
    "การยิก (animation) ต้องถูกปิดเมื่อผู้ใช้ขอ reduced-motion ไม่ใช่แค่ transition",
  );
});

test("CSS: ห้ามใช้ selector เดี่ยวกับ attribute ที่สคริปต์ติดบน <html>", async () => {
  const css = await readStrippedCss();

  /*
    ⚠️ บั๊กจริงในรอบที่ 21: `[data-hero-card] { display: none }` ไปโดน `<html>` เอง (เพราะสคริปต์
    ก่อน paint ติด attribute นี้บน <html>) → **ซ่อนทั้งเว็บ** · อาการที่ผู้ใช้เห็นคือ "ทุกอย่างกว้าง 0"
    จน Next.js เตือนเรื่อง `sizes` ของภาพ hero (ratio = 0) เป็นเงื่อนงำ

    กฎกันพลาด: attribute ที่อยู่บน <html> ต้องใช้เป็น `html[attr="…"] …` เท่านั้น
    ส่วน attribute ของ "ชิ้นส่วน" ต้องเป็นคนละชื่อ (เช่น data-mourning-notice · data-hero-card-panel)
  */
  const htmlAttributes = [
    COOKIE_CONSENT_ATTRIBUTE,
    HERO_CARD_ATTRIBUTE,
    MOURNING_ATTRIBUTE,
    REVEAL_ATTRIBUTE,
  ];

  for (const attribute of htmlAttributes) {
    // ต้องมี "ช่องว่าง/ตัวคั่น" นำหน้า จึงนับเป็น selector เดี่ยว
    // (แบบนี้ `html[data-cookie-consent] [data-cookie-banner]` จะไม่ถูกตีความผิด)
    assert.ok(
      !new RegExp(`(^|[\\s,>+~])\\[${attribute}\\]`).test(css),
      `globals.css ห้ามใช้ [${attribute}] เป็น selector เดี่ยว — attribute นี้อยู่บน <html> จะซ่อนทั้งหน้า`,
    );
  }
});
