import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
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

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

/**
 * อ่าน globals.css แบบ **ตัดคอมเมนต์ออกก่อน**
 *
 * บทเรียนรอบที่ 21: คอมเมนต์อธิบายในไฟล์ CSS มีวงเล็บปีกกา (`body { overflow: hidden }`)
 * ทำให้ regex ที่ไล่จับบล็อก `html { … scrollbar-gutter: stable }` ขาดกลางทาง → เทสต์แดงทั้งที่โค้ดถูก
 * (วิธีเดียวกับที่ scripts/check-i18n.ts ทำกับไฟล์ .tsx)
 */
async function readMourningCss(): Promise<string> {
  const raw = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  return raw.replace(/\/\*[\s\S]*?\*\//g, " ");
}

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
};

function runInitScript({ stored = null, now, storageThrows = false }: SandboxOptions): string | null {
  const attributes = new Map<string, string>();

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
  const css = await readMourningCss();

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
  const css = await readMourningCss();

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
  const css = await readMourningCss();

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
