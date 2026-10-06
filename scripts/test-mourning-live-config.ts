import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { liveTextOf, parseMourningLiveConfig, toLiveImage } from "@/lib/mourning/live-config";

/**
 * เทสต์ "ค่าสด" ของป้ายประกาศที่ส่งเข้ามาในพรีวิว (รอบที่ 168)
 *
 * บริบท: รอบที่ 161–166 รับเฉพาะ "ภาพ" ⇒ รอบนี้รับเพิ่ม **ข้อความ + สถานะเปิด-ปิด**
 * ⚠️ ค่าที่ส่งเข้ามา **ยังไม่ผ่านการตรวจของเซิร์ฟเวอร์** — ต้องแปลง/กรองก่อนเรนเดอร์เสมอ
 *    (เคสจริง: "empty src" + "NaN width/height" ในคอนโซล เพราะใช้ค่าดิบ)
 */

const root = join(import.meta.dirname, "..");
const read = (...parts: readonly string[]): string => readFileSync(join(root, ...parts), "utf8");

/* ── ภาพ ─────────────────────────────────────────────────────────────────── */

test("live-config: ภาพสดรับได้ทั้ง src / path / mediaId และเติมขนาดมาตรฐาน 3:1", () => {
  const fromPath = toLiveImage({ path: "/rip/a.jpg", altTh: "ภาพ ก" });
  assert.deepEqual(fromPath, { id: "/rip/a.jpg", src: "/rip/a.jpg", alt: "ภาพ ก", width: 1200, height: 400 });

  const fromSrc = toLiveImage({ id: "m1", src: "/media/m1", alt: "Alt", width: 600, height: 200 });
  assert.deepEqual(fromSrc, { id: "m1", src: "/media/m1", alt: "Alt", width: 600, height: 200 });

  /* mediaId เปล่า ๆ ก็ใช้ได้ (แถบแก้เคยส่งมาแบบนี้) */
  assert.equal(toLiveImage({ mediaId: "abc" })?.src, "/media/abc");

  /* alt อังกฤษว่าง = ใช้ altTh (เหมือน loader) */
  assert.equal(toLiveImage({ path: "/x.jpg", altTh: "ไทย", altEn: "" })?.alt, "ไทย");
});

test("live-config: ภาพที่ไม่มีแหล่งที่มา/ค่าขนาดเพี้ยน = ข้ามหรือใช้ค่าปลอดภัย", () => {
  assert.equal(toLiveImage(null), null);
  assert.equal(toLiveImage(undefined), null);
  assert.equal(toLiveImage(42), null);
  assert.equal(toLiveImage("ข้อความ"), null);
  assert.equal(toLiveImage({}), null, "ไม่มี src/path/mediaId = ข้าม (กัน empty src)");
  assert.equal(toLiveImage({ path: "" }), null);
  assert.equal(toLiveImage({ src: "", path: "", mediaId: "" }), null);

  /* ขนาดไม่ใช่ตัวเลข/ติดลบ/ศูนย์ = ใช้ 3:1 มาตรฐาน ไม่ปล่อย NaN ออกไป */
  const safe = toLiveImage({ path: "/x.jpg", width: Number.NaN, height: -5 });
  assert.equal(safe?.width, 1200);
  assert.equal(safe?.height, 400);
});

/* ── ข้อความ ─────────────────────────────────────────────────────────────── */

test("live-config: ข้อความเลือกภาษาตาม locale และถอยไปใช้ไทยเมื่ออังกฤษว่าง", () => {
  const value = { th: "ไทย", en: "English" };

  assert.equal(liveTextOf(value, "th"), "ไทย");
  assert.equal(liveTextOf(value, "en"), "English");
  /* EN ว่าง = ไม่บังคับ ⇒ ถอยไปใช้ไทย (แบบเดียวกับ loader) */
  assert.equal(liveTextOf({ th: "ไทย", en: "" }, "en"), "ไทย");
  assert.equal(liveTextOf({ th: "ไทย" }, "en"), "ไทย");
  /* ค่าที่ไม่ได้เป็นข้อความ = คืนสตริงว่าง (ไม่ทำ NaN/undefined หลุดไป) */
  assert.equal(liveTextOf({ th: 123, en: false }, "th"), "");
  /* ไม่ใช่ออบเจ็กต์ = null ให้ผู้เรียกถอยไปใช้ค่าจากเซิร์ฟเวอร์ */
  assert.equal(liveTextOf("ข้อความ", "th"), null);
  assert.equal(liveTextOf(null, "th"), null);
});

/* ── ก้อนค่าทั้งหมด ──────────────────────────────────────────────────────── */

test("live-config: อ่านก้อนค่าสดครบทั้งภาพ + ข้อความ + สถานะเปิด-ปิด", () => {
  const parsed = parseMourningLiveConfig(
    {
      enabled: false,
      caption: { th: "แคปชัน", en: "Caption" },
      closeLabel: { th: "ปิด", en: "Close" },
      muteTodayLabel: { th: "ไม่แสดงซ้ำ", en: "Mute" },
      seeNextLabel: { th: "ดูภาพต่อไป", en: "See next" },
      images: [{ path: "/media/a" }, { path: "" }, { path: "/rip/b.jpg", altTh: "บี" }],
    },
    "en",
  );

  assert.ok(parsed !== null);
  assert.equal(parsed.enabled, false, "สวิตช์ปิดต้องส่งต่อถึงพรีวิว");
  assert.equal(parsed.caption, "Caption");
  assert.equal(parsed.closeLabel, "Close");
  assert.equal(parsed.muteTodayLabel, "Mute");
  assert.equal(parsed.seeNextLabel, "See next");
  assert.equal(parsed.images.length, 2, "ภาพที่ไม่มีแหล่งที่มาถูกกรองออก");
  assert.equal(parsed.images[0]?.src, "/media/a");
  assert.equal(parsed.images[1]?.alt, "บี");
});

test("live-config: ข้อความว่างที่ผู้ใช้ตั้งใจล้าง = ว่างจริง (ไม่ดึงค่าอื่นมาแทน)", () => {
  const parsed = parseMourningLiveConfig(
    { enabled: true, caption: { th: "", en: "" }, closeLabel: { th: "ปิด" }, images: [{ path: "/x" }] },
    "th",
  );

  assert.ok(parsed !== null);
  assert.equal(parsed.caption, "", "caption เป็นช่องไม่บังคับ ⇒ ล้างได้");
  assert.equal(parsed.closeLabel, "ปิด");
  /* ช่องที่ไม่ได้ส่งมา = ว่าง (ผู้เรียกใช้ || ไม่ได้ — ดู `activeLabels` ฝั่งคอมโพเนนต์) */
  assert.equal(parsed.muteTodayLabel, "");
  assert.equal(parsed.seeNextLabel, "");
});

test("live-config: ข้อมูลไม่ครบต้องไม่ซ่อนป้าย และไม่ทำหน้าเว็บพัง", () => {
  /* ไม่มี images = ลิสต์ว่าง (ผู้เรียกจะไม่เรนเดอร์เพราะไม่มีภาพ) */
  const noImages = parseMourningLiveConfig({ enabled: true }, "th");
  assert.ok(noImages !== null);
  assert.deepEqual(noImages.images, []);

  /* images ไม่ใช่ array = ถือเป็นลิสต์ว่าง (ไม่โยน error) */
  const badImages = parseMourningLiveConfig({ images: "ไม่ใช่ลิสต์" }, "th");
  assert.ok(badImages !== null);
  assert.deepEqual(badImages.images, []);

  /* enabled ไม่ใช่ boolean = ถือว่าเปิด (ไม่ซ่อนป้ายเพราะข้อความไม่ครบ) */
  assert.equal(parseMourningLiveConfig({ enabled: "yes" }, "th")?.enabled, true);
  assert.equal(parseMourningLiveConfig({}, "th")?.enabled, true);

  /* ไม่ใช่ออบเจ็กต์ = null (ผู้เรียกถอยไปใช้ค่าจากเซิร์ฟเวอร์ทั้งหมด) */
  assert.equal(parseMourningLiveConfig(null, "th"), null);
  assert.equal(parseMourningLiveConfig([], "th"), null);
  assert.equal(parseMourningLiveConfig("x", "th"), null);
});

/* ── สแกนซอร์ส: กันถอยหลัง ────────────────────────────────────────────────── */

test("live-config: หน้าเว็บจริงต้องไม่รับค่าสด (เปิดเฉพาะในพรีวิว) และคอมโพเนนต์ต้องใช้ค่าสดครบ", () => {
  const notice = read("features", "shell", "ui", "mourning-notice.tsx");

  assert.ok(
    notice.includes('document.documentElement.getAttribute("data-preview-parts") !== "notice"'),
    "ต้องเปิดโหมดสดเฉพาะในหน้าพรีวิว",
  );
  assert.ok(notice.includes("parseMourningLiveConfig"), "ต้องใช้ตัวแปลงกลาง ไม่เขียนตรรกะซ้ำ");
  assert.ok(notice.includes("liveNotice?.images ?? images"), "ภาพสดต้องใช้เมื่อมี");
  assert.ok(
    notice.includes("caption: liveNotice.caption") &&
      notice.includes("close: liveNotice.closeLabel") &&
      notice.includes("muteToday: liveNotice.muteTodayLabel") &&
      notice.includes("seeNext: liveNotice.seeNextLabel"),
    "ข้อความสดทั้ง 4 ช่องต้องถูกใช้ในพรีวิว",
  );
  assert.ok(
    notice.includes("if (liveNotice !== null && !liveNotice.enabled) return null;"),
    "ปิดสวิตช์ในหลังบ้าน = ป้ายต้องหายจากพรีวิว",
  );

  /* composer ต้องส่ง locale ให้คอมโพเนนต์เลือกภาษา (ไม่งั้น EN จะเห็นข้อความไทย) */
  const layout = read("app", "[lang]", "layout.tsx");
  assert.ok(/<MourningNotice[\s\S]{0,120}locale=\{chromeLocale\}/.test(layout), "layout ต้องส่ง locale ให้ป้ายประกาศ");
});

test("live-config: พจนานุกรมต้องมีข้อความครอปครบทั้งสองภาษา", () => {
  const th = read("lib", "i18n", "messages", "areas", "th", "adminNotice.ts");
  const en = read("lib", "i18n", "messages", "areas", "en", "adminNotice.ts");

  assert.ok(th.includes("imageCropApplied"), "ไทยต้องมีข้อความแจ้งการครอป");
  assert.ok(en.includes("imageCropApplied"), "อังกฤษต้องมีข้อความแจ้งการครอป");
  assert.ok(th.includes("{aspect}") && th.includes("{ratio}"), "ข้อความไทยต้องมีตัวแทนค่า aspect/ratio");
  assert.ok(en.includes("{aspect}") && en.includes("{ratio}"), "ข้อความอังกฤษต้องมีตัวแทนค่า aspect/ratio");
});
