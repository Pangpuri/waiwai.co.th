import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

import {
  MOURNING_CLOSE_MS,
  MOURNING_IMAGES,
  MOURNING_SLIDE_FADE_MS,
} from "@/features/shell/mourning";
import { en } from "@/lib/i18n/messages/en";
import { th } from "@/lib/i18n/messages/th";
import {
  MOURNING_ATTRIBUTE,
  MOURNING_INIT_SCRIPT,
  MOURNING_STATE_SHOWN,
  MOURNING_STORAGE_KEY,
  isMourningMuted,
  mourningDateStamp,
} from "@/lib/mourning-notice";

import { readStrippedCss } from "./css-source.ts";

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

test("MOURNING_IMAGES: ไม่มีไฟล์ค้างใน public/rip/ ที่ไม่มีใครอ้างถึง", () => {
  // ด่านเดียวกับ public/slide/ — เจอเคสจริงในรอบที่ 21 ที่มีไฟล์ค้างโดยไม่มีใครใช้
  const used = new Set(MOURNING_IMAGES.map((image) => image.src.replace("/rip/", "")));
  const orphans = readdirSync(path.join(PROJECT_ROOT, "public", "rip")).filter(
    (name) => !used.has(name),
  );

  assert.deepEqual(
    orphans,
    [],
    `มีไฟล์ที่ไม่มีใน MOURNING_IMAGES: ${orphans.join(", ")} — ถ้าตั้งใจเก็บไว้ก่อน ให้ย้ายไปโฟลเดอร์ rip/ (ต้นทาง)`,
  );
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
      ["muteToday", messages.mourning.muteToday],
      ["seeNext", messages.mourning.seeNext],
      ["prev", messages.mourning.prev],
      ["next", messages.mourning.next],
      ["gotoSlide", messages.mourning.gotoSlide],
    ] as const) {
      assert.ok(value.trim().length > 0, `${locale}: mourning.${name} ว่าง`);
    }
  }
});

/* ── รันสคริปต์ก่อน paint จริงใน sandbox ───────────────────────────────────────
   เทสต์แบบนี้ตรวจ "พฤติกรรม" ได้ ไม่ใช่แค่ตรวจว่ามีข้อความอยู่ในสตริง
   (บทเรียนจากรอบที่ 21: เทสต์ที่ตรวจแค่ว่ามี `if(v)return;` อยู่ ผ่านได้ทั้งที่กติกาผิด)
   ของที่ต้องมีใน sandbox: document.documentElement.setAttribute · localStorage.getItem · Date
*/
type SandboxOptions = {
  /** ค่าที่อ่านได้จาก localStorage (null = ไม่มีค่า) */
  readonly stored?: string | null;
  /** วันที่ของ "ตอนนี้" — ต้องตรึงไว้ไม่ให้เทสต์ผูกกับวันที่รันจริง */
  readonly now: Date;
  /** จำลอง localStorage ที่ถูกบล็อก (โหมดส่วนตัว) */
  readonly storageThrows?: boolean;
  /** จำลองว่าหน้านี้ถูกฝังใน <iframe> (พรีวิวของหลังบ้าน) — ค่าเริ่มต้น false = แท็บปกติ */
  readonly framed?: boolean;
  /** query string ของ URL (ใช้ตรวจข้อยกเว้นของโหมดพรีวิวป้ายประกาศ) */
  readonly search?: string;
};

function runInitScript({
  stored = null,
  now,
  storageThrows = false,
  framed = false,
  search = "",
}: SandboxOptions): string | null {
  const attributes = new Map<string, string>();

  /*
    จำลอง window: `self === top` = เปิดเป็นแท็บปกติ · `self !== top` = อยู่ใน iframe
    (สคริปต์จริงใช้คู่นี้ตัดสินว่าจะเด้งป้ายไหม — ดู lib/mourning-notice.ts MOURNING_SKIP_IN_FRAME)
  */
  const self = {};
  const context = vm.createContext({
    document: {
      documentElement: {
        setAttribute: (name: string, value: string) => {
          attributes.set(name, value);
        },
      },
    },
    localStorage: {
      getItem: () => {
        if (storageThrows) throw new Error("storage ถูกบล็อก");
        return stored;
      },
    },
    window: {
      self,
      top: framed ? {} : self,
      location: { search },
    },
    // สคริปต์เรียก new Date() เอง — ใส่วันที่ปลอมเข้าไปเพื่อให้ผลเทสต์คงที่
    Date: class extends Date {
      constructor() {
        super(now.getTime());
      }
    },
  });

  vm.runInContext(MOURNING_INIT_SCRIPT, context);

  return attributes.get(MOURNING_ATTRIBUTE) ?? null;
}

const TODAY = new Date(2026, 8, 25, 10, 30); // 25 ก.ย. 2026 เวลาท้องถิ่น

test("สคริปต์ก่อน paint: ยังไม่เคยกดปิด → ต้องติด attribute ให้ CSS เปิดหน้าต่าง", () => {
  assert.equal(runInitScript({ now: TODAY }), MOURNING_STATE_SHOWN);
});

test("สคริปต์ก่อน paint: ค่าเริ่มต้นคือแสดงทุกครั้งที่โหลดหน้า (รีเฟรช = เห็นอีก)", () => {
  // ไม่มีค่าใน storage = รอบนี้ต้องแสดง · ค่าที่ไม่ใช่วันนี้ (เช่นของเก่าที่รูปแบบไม่ตรง) ก็ต้องแสดง
  assert.equal(runInitScript({ stored: "", now: TODAY }), MOURNING_STATE_SHOWN);
  assert.equal(runInitScript({ stored: "dismissed", now: TODAY }), MOURNING_STATE_SHOWN);
});

test("สคริปต์ก่อน paint: ติ๊ก 'ไม่แสดงอีกในวันนี้' → วันเดียวกันไม่เด้ง", () => {
  assert.equal(
    runInitScript({ stored: mourningDateStamp(TODAY), now: TODAY }),
    null,
    "วันที่เก็บไว้ตรงกับวันนี้ ต้องไม่ติด attribute",
  );
});

test("สคริปต์ก่อน paint: ขึ้นวันใหม่แล้วต้องกลับมาแสดงเอง", () => {
  const yesterday = new Date(2026, 8, 24, 23, 59);

  assert.equal(
    runInitScript({ stored: mourningDateStamp(yesterday), now: TODAY }),
    MOURNING_STATE_SHOWN,
    "ค่าที่เก็บเป็นของเมื่อวาน ต้องไม่ถูกตีความว่าปิดไว้วันนี้",
  );
});

test("สคริปต์ก่อน paint: เขียน/อ่านวันแบบเดียวกับ mourningDateStamp (รวมวันที่หลักเดียว)", () => {
  // 5 ม.ค. 2026 → เดือนและวันต้องเติมศูนย์หน้าให้ตรงกับฟังก์ชันฝั่ง TS
  const singleDigitDay = new Date(2026, 0, 5, 9, 0);
  assert.equal(mourningDateStamp(singleDigitDay), "2026-01-05");

  assert.equal(
    runInitScript({ stored: mourningDateStamp(singleDigitDay), now: singleDigitDay }),
    null,
    "สคริปต์กับฟังก์ชัน TS ต้องสร้างสตริงวันที่รูปแบบเดียวกัน",
  );
});

test("สคริปต์ก่อน paint: localStorage ถูกบล็อก → ยังต้องแสดง (ไม่ปิดประกาศทิ้ง)", () => {
  // เทียบกับแถบคุกกี้: ที่นี่ "ไม่แสดง" เสียหายกว่าการเห็นซ้ำ เพราะเป็นประกาศของบริษัท
  assert.equal(runInitScript({ now: TODAY, storageThrows: true }), MOURNING_STATE_SHOWN);
});

test("สคริปต์ก่อน paint: อ้างคีย์/attribute เดียวกับที่โค้ดใช้ และมี try/catch", () => {
  assert.ok(MOURNING_INIT_SCRIPT.includes(MOURNING_STORAGE_KEY));
  assert.ok(MOURNING_INIT_SCRIPT.includes(MOURNING_ATTRIBUTE));
  assert.ok(MOURNING_INIT_SCRIPT.includes(MOURNING_STATE_SHOWN));
  assert.ok(MOURNING_INIT_SCRIPT.startsWith("(function(){"));
  assert.ok(MOURNING_INIT_SCRIPT.includes("try"), "ต้องมี try กัน localStorage โยน error");
  assert.ok(MOURNING_INIT_SCRIPT.includes("catch"), "ต้องมี catch");
});

test("mourningDateStamp: ใช้เวลาท้องถิ่น ไม่ใช่ UTC", () => {
  // 1 ม.ค. 2026 00:30 เวลาท้องถิ่น → ถ้าใช้ toISOString() จะเพี้ยนเป็นวันที่ก่อนหน้าในบางโซนเวลา
  const earlyMorning = new Date(2026, 0, 1, 0, 30);
  assert.equal(mourningDateStamp(earlyMorning), "2026-01-01");
});

test("isMourningMuted: ต้องเป็นวันเดียวกันเท่านั้นจึงจะปิด", () => {
  const today = mourningDateStamp(TODAY);

  assert.equal(isMourningMuted(today, today), true);
  assert.equal(isMourningMuted("2026-09-24", today), false, "ของเมื่อวานต้องไม่ปิดวันนี้");
  assert.equal(isMourningMuted("", today), false);
  assert.equal(isMourningMuted(null, today), false);
  assert.equal(isMourningMuted(undefined, today), false);
  assert.equal(isMourningMuted(20260925, today), false, "ค่าที่ไม่ใช่สตริงต้องไม่ทำให้พัง");
});

test("CSS: หน้าต่างต้องถูกซ่อนไว้ก่อน แล้วค่อยเปิดเมื่อสคริปต์ยืนยัน", async () => {
  const css = await readStrippedCss();

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

test("CSS: หน้าต่างต้องกัน 'เนื้อเว็บกระตุก' ตอนล็อก/ปลดล็อกการเลื่อน", async () => {
  const css = await readStrippedCss();

  /*
    อาการที่ผู้ใช้รายงานในรอบที่ 21: ตอนปิดหน้าต่าง เนื้อเว็บหลักกระตุกหนึ่งจังหวะ
    สาเหตุ: `body { overflow: hidden }` ทำให้แถบเลื่อนหาย → ความกว้างวิวพอร์ตเพิ่มขึ้น
    ทางแก้: สงวนที่ให้แถบเลื่อนไว้ตลอดด้วย scrollbar-gutter: stable ที่ <html>
  */
  assert.ok(
    /html\s*\{[^}]*scrollbar-gutter:\s*stable/.test(css),
    "globals.css ต้องมี `scrollbar-gutter: stable` ที่ html ไม่งั้นเนื้อเว็บจะกระตุกตอนปิดหน้าต่าง",
  );
});

test("CSS: จางข้ามภาพของหน้าต่างไว้อาลัย ต้องตรงกับค่าที่โค้ดใช้", async () => {
  const css = await readStrippedCss();

  assert.ok(css.includes("[data-mourning-frame]"), "globals.css ต้องมีกฎ [data-mourning-frame]");
  assert.ok(
    css.includes('[data-mourning-frame][data-state="active"]'),
    "globals.css ต้องมีกฎสำหรับภาพที่กำลังแสดง",
  );
  assert.ok(
    css.includes(`opacity ${MOURNING_SLIDE_FADE_MS}ms`),
    `transition ของภาพต้องจาง ${MOURNING_SLIDE_FADE_MS}ms ให้ตรงกับ MOURNING_SLIDE_FADE_MS`,
  );
});

/* ── จัดลำดับภาพในตัวแก้ป้ายประกาศ (รอบที่ 170) ────────────────────────────────── */

test("mourning-editor: การ์ดภาพลากสลับลำดับได้ + มีปุ่มตั้งเป็นภาพแรก (ไม่กระทบปุ่มเดิม)", () => {
  const editor = readFileSync(path.join(PROJECT_ROOT, "features", "admin", "ui", "mourning-editor.tsx"), "utf8");

  /* ใช้ตรรกะกลางจาก lib (ทดสอบตรงแล้วใน test-mourning-config.ts) — ห้ามเขียนซ้ำในคอมโพเนนต์ */
  assert.ok(editor.includes("moveImageTo("), "ตัวแก้ต้องใช้ moveImageTo ตัวกลาง");
  assert.ok(editor.includes("selectedImageAfterMove("), "ดัชนีที่เลือกต้องติดตามภาพที่ย้าย");

  /* ลากวาง */
  assert.ok(editor.includes("draggable"), "การ์ดภาพต้องลากได้");
  assert.ok(editor.includes("onDragStart=") && editor.includes("onDrop="), "มีการเริ่มลากและจุดวาง");
  assert.ok(editor.includes("onDragEnd="), "ต้องเคลียร์สถานะลากเมื่อปล่อยนอกจุดวาง");

  /* ทางลัด + คำใบ้ (มาจากพจนานุกรม) */
  assert.ok(editor.includes("strings.mourningSetFirst"), "ต้องมีปุ่มตั้งเป็นภาพแรก");
  assert.ok(editor.includes("strings.mourningDragHandle"), "ต้องมีคำใบ้การลาก (ไม่ใช่ข้อความไทยใน .tsx)");

  /* ต้องยังมีทางใช้คีย์บอร์ด/จอสัมผัส (ปุ่มเลื่อน) — a11y ไม่ถอยหลัง */
  assert.ok(editor.includes("moveImage(index, -1)") && editor.includes("moveImage(index, 1)"), "ปุ่มเลื่อนขึ้น/ลงต้องยังอยู่");
});

/* ── รอบที่ 181: ป้ายต้องไม่เด้งใน iframe พรีวิวของหลังบ้าน ──────────────────────
 *
 * ฟีดแบ็กเจ้าของ: *"แก้ไขเนื้อหาหน้าแรกก็ยังมีป้ายประกาศกวน"* (ในเมนู sidebar ต่อจาก "ส่วนกลาง")
 * ต้นเหตุ: หลังบ้านฝังพรีวิวเป็น `<iframe>` (ตัวสร้างหน้าเว็บ · ส่วนกลาง · โหมด "หน้าเว็บจริง" = `/th`)
 *   และสคริปต์ก่อน paint ติด `data-mourning="shown"` ทุกครั้ง ⇒ ป้ายบังทั้งจอทับกรอบพรีวิว
 * แก้: ถ้าอยู่ใน iframe (และไม่ใช่โหมดพรีวิวป้ายประกาศ `?parts=notice`) = ไม่ต้องเด้ง
 *   ปลอดภัยเพราะ next.config.ts ตั้ง `frame-ancestors 'self'` ⇒ มีแต่หน้าเราเองที่ฝังเราได้
 */

test("รอบ 181: อยู่ใน iframe (พรีวิวหลังบ้าน) → ป้ายไม่เด้ง", () => {
  assert.equal(runInitScript({ now: TODAY, framed: true }), null, "อยู่ใน iframe = ห้ามติด attribute shown");
  assert.equal(
    runInitScript({ now: TODAY, framed: true, search: "?mode=draft" }),
    null,
    "พรีวิวฉบับร่างใน iframe ก็ต้องไม่เด้ง",
  );
  assert.equal(
    runInitScript({ now: TODAY, framed: true, search: "?mode=published" }),
    null,
    "พรีวิวฉบับเผยแพร่ใน iframe ก็ต้องไม่เด้ง",
  );
  assert.equal(
    runInitScript({ now: TODAY, framed: true, search: "?parts=nav" }),
    null,
    "โหมดเฉพาะแถบเมนู/ท้ายเว็บก็ต้องไม่เด้ง",
  );
});

test("รอบ 181: แท็บปกติยังเด้งตามเดิม (ผู้เข้าชมจริงไม่ถูกกระทบ)", () => {
  assert.equal(runInitScript({ now: TODAY }), MOURNING_STATE_SHOWN, "เปิดหน้าเว็บตรง ๆ ต้องเห็นป้ายเหมือนเดิม");
  assert.equal(
    runInitScript({ now: TODAY, search: "?parts=nav" }),
    MOURNING_STATE_SHOWN,
    "แท็บปกติที่มี query แปลก ๆ ก็ยังต้องเด้ง (เงื่อนไข iframe เท่านั้น)",
  );
});

test("รอบ 181: ข้อยกเว้นโหมดพรีวิว 'ป้ายประกาศ' (?parts=notice) ต้องเห็นป้ายจริง", () => {
  assert.equal(
    runInitScript({ now: TODAY, framed: true, search: "?parts=notice" }),
    MOURNING_STATE_SHOWN,
    "โหมดพรีวิวป้ายประกาศต้องเห็นป้าย (ไม่งั้นดูตัวอย่างไม่ได้)",
  );
  assert.equal(
    runInitScript({ now: TODAY, framed: true, search: "?mode=draft&parts=notice" }),
    MOURNING_STATE_SHOWN,
    "ต้องจับได้แม้ parts อยู่ท้าย query",
  );
  assert.equal(
    runInitScript({ now: TODAY, framed: true, search: "?mode=published&parts=notice&lang=th" }),
    MOURNING_STATE_SHOWN,
    "ต้องจับได้แม้มีพารามิเตอร์ต่อท้าย",
  );
  /* ชายขอบ: ต้องไม่จับแบบ "ขึ้นต้นเหมือน" (parts=noticex) */
  assert.equal(
    runInitScript({ now: TODAY, framed: true, search: "?parts=noticex" }),
    null,
    "ต้องเทียบทั้งพารามิเตอร์ ไม่ใช่ขึ้นต้นเหมือน",
  );
  assert.equal(
    runInitScript({ now: TODAY, framed: true, search: "?noparts=notice" }),
    null,
    "ต้องไม่จับพารามิเตอร์ที่ชื่อคล้ายกัน",
  );
});

test("รอบ 181: กติกาเดิมยังอยู่ — กดปิดไว้ถึงสิ้นวันมีผลเหนือทุกอย่าง", () => {
  const stamp = mourningDateStamp(TODAY);
  assert.equal(runInitScript({ now: TODAY, stored: stamp, framed: true, search: "?parts=notice" }), null);
  assert.equal(runInitScript({ now: TODAY, stored: stamp }), null);
});

test("รอบ 181: สคริปต์ที่ส่งจริงมีเงื่อนไข iframe และไม่รับค่าจาก URL ไปใช้ต่อ", () => {
  assert.ok(MOURNING_INIT_SCRIPT.includes("window.self!==window.top"), "สคริปต์ต้องเช็กการอยู่ใน iframe");
  assert.ok(MOURNING_INIT_SCRIPT.includes("parts=notice"), "สคริปต์ต้องมีข้อยกเว้นของโหมดพรีวิวป้ายประกาศ");
  assert.ok(
    MOURNING_INIT_SCRIPT.includes("catch(_){}") && MOURNING_INIT_SCRIPT.includes("setAttribute"),
    "ยังต้องเช็ก storage ก่อน แล้วค่อยติด attribute",
  );
  /* ⚠️ ข้อยกเว้นอ่านแค่ "มีพารามิเตอร์นี้ไหม" — ห้ามเอาค่าจาก URL ไปใช้ต่อ */
  assert.ok(!MOURNING_INIT_SCRIPT.includes("decodeURIComponent"), "ห้ามถอดรหัสค่าจาก URL มาใช้");
});
