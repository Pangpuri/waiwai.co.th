import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { managedHeroSlideViews } from "@/features/home/slides";
import {
  MAX_HERO_PAGE_SLIDES,
  clampFocus,
  clampZoom,
  DEFAULT_HERO_SETTING,
  HERO_EFFECTS,
  HERO_INTERVAL_MAX_MS,
  HERO_INTERVAL_MIN_MS,
  clampIntervalMs,
  focusFromObjectPosition,
  isHeroEffect,
  parseHeroSetting,
  isLocalMediaPath,
  moveHeroPageSlide,
  parseHeroSlideInput,
  sortHeroPageSlides,
  type HeroPageSlide,
} from "@/lib/hero/model";

/**
 * รอบที่ 184 · เฟส 1 ของโมดูล "สไลด์ & แคมเปญ" — ชั้นข้อมูล/โมเดล
 * ฟีดแบ็กเจ้าของ: *"แยกโมดูลจะจัดการง่ายกว่าไหม … จะมีการ์ดที่วางบนสไลด์ด้วย ที่ต้องทำพาเนลมาจัดการอัปเดตกิจกรรมหรือแคมเปญ"*
 * ⇒ เจ้าของเลือก "โมดูลแยก + เมนูใหม่" และเริ่มจาก "ย้าย 3 ภาพเดิมขึ้นก่อน"
 */

function slide(id: string, sortOrder: number): HeroPageSlide {
  return { id, sortOrder, mediaPath: `/slide/${id}.jpg`, altTh: `ภาพ ${id}`, altEn: "", focusX: 50, focusY: 50, zoom: 1, isActive: true };
}

test("hero module: ตรวจค่าที่รับจากฟอร์ม (พาธในเว็บ · alt ไทยบังคับ · บีบช่วงค่า)", () => {
  const good = parseHeroSlideInput({
    mediaPath: "  /slide/flavours-banner.jpg ",
    altTh: " ป้ายรสชาติ ",
    altEn: "",
    focusX: 500,
    focusY: -20,
    zoom: 9,
  });
  assert.equal(good.ok, true);
  assert.equal(good.ok ? good.value.mediaPath : "", "/slide/flavours-banner.jpg", "ตัดช่องว่างหัวท้าย");
  assert.equal(good.ok ? good.value.altTh : "", "ป้ายรสชาติ");
  assert.equal(good.ok ? good.value.focusX : -1, 100, "ค่าเกินถูกบีบ");
  assert.equal(good.ok ? good.value.focusY : -1, 0, "ค่าติดลบถูกบีบ");
  assert.equal(good.ok ? good.value.zoom : -1, 2, "ซูมเกินถูกบีบ");

  /* ภาพต้องเป็นพาธในเว็บ (ห้าม URL เต็ม — มติ D9) */
  for (const bad of ["", "   ", "https://example.com/a.jpg", "//cdn.example.com/a.jpg", "media/a.jpg"]) {
    const outcome = parseHeroSlideInput({ mediaPath: bad, altTh: "ก" });
    assert.equal(outcome.ok, false, `"${bad}" ต้องไม่ผ่าน`);
  }
  assert.equal(isLocalMediaPath("/media/abc123"), true);
  assert.equal(isLocalMediaPath("/slide/x.jpg"), true);

  /* alt ไทยบังคับ · อังกฤษไม่บังคับแต่ต้องไม่เดี่ยว */
  const noAlt = parseHeroSlideInput({ mediaPath: "/slide/x.jpg", altTh: "  " });
  assert.equal(noAlt.ok, false);
  assert.ok(!noAlt.ok && noAlt.problems.some((problem) => problem.includes("altTh")));

  /* ค่าที่ไม่ใช่ตัวเลข = ค่ากลาง (ไม่ระเบิด) และ isActive ไม่ส่งมา = เปิด */
  const sloppy = parseHeroSlideInput({ mediaPath: "/slide/x.jpg", altTh: "ก", focusX: "กลาง", zoom: null });
  assert.equal(sloppy.ok, true);
  assert.equal(sloppy.ok ? sloppy.value.focusX : -1, 50);
  assert.equal(sloppy.ok ? sloppy.value.zoom : -1, 1);
  assert.equal(sloppy.ok ? sloppy.value.isActive : false, true);
  assert.equal(parseHeroSlideInput({ mediaPath: "/slide/x.jpg", altTh: "ก", isActive: false }).ok && true, true);
  assert.equal(clampFocus(Number.NaN), 50);
  assert.equal(clampZoom(Number.POSITIVE_INFINITY), 1);
  assert.ok(MAX_HERO_PAGE_SLIDES >= 2 && MAX_HERO_PAGE_SLIDES <= 10, "เพดานสไลด์ต้องสมเหตุสมผล");
});

test("hero module: เรียงลำดับ/ย้ายสไลด์ได้ และผลนิ่งเมื่อลำดับเท่ากัน", () => {
  const slides = [slide("b", 2), slide("a", 1), slide("c", 1)];
  assert.deepEqual(sortHeroPageSlides(slides).map((item) => item.id), ["a", "c", "b"], "ลำดับเท่ากันใช้ id ให้ผลนิ่ง");

  /* อาร์เรย์ตั้งต้น = [b, a, c] ⇒ ย้าย a ขึ้น = สลับกับ b */
  const moved = moveHeroPageSlide(slides, "a", -1);
  assert.deepEqual(moved.map((item) => item.id), ["a", "b", "c"], "ย้ายขึ้นหนึ่งช่อง");
  assert.deepEqual(moveHeroPageSlide(slides, "b", -1), slides, "ใบแรกย้ายขึ้นไม่ได้ (คืนค่าเดิม)");
  assert.deepEqual(moveHeroPageSlide(slides, "c", 1), slides, "ใบสุดท้ายย้ายลงไม่ได้ (คืนค่าเดิม)");
  assert.deepEqual(moveHeroPageSlide(slides, "ไม่มีอยู่", -1), slides, "id ที่ไม่มี = ไม่ทำอะไร");
  assert.deepEqual(sortHeroPageSlides([]), []);
});

test("hero module: migration 0027 + สคีมา ตรงกัน (ตาราง/คอลัมน์/ดัชนี/ตรวจช่วงค่า)", () => {
  const migration = readFileSync("db/migrations/0027-hero-slides.sql", "utf8");
  const schema = readFileSync("db/schema.sql", "utf8");

  for (const piece of [
    "create table if not exists hero_slide",
    "media_path",
    "alt_th",
    "focus_x",
    "zoom numeric(4, 2)",
    "is_active",
    "deleted_at",
    "deleted_by",
    "create index if not exists hero_slide_order_idx",
  ]) {
    assert.ok(migration.includes(piece), `migration ต้องมี ${piece}`);
  }
  /* รันซ้ำได้ (idempotent) — ด่าน check:migrations บังคับอยู่แล้ว ที่นี่กันถอยหลัง */
  assert.ok(!/drop table/i.test(migration), "ห้าม drop table ในไฟล์ migration");
  assert.ok(migration.includes("check (focus_x between 0 and 100)"), "ต้องมีการตรวจช่วงจุดโฟกัส");
  assert.ok(migration.includes("check (zoom between 1 and 2)"), "ต้องมีการตรวจช่วงซูม");
  assert.ok(schema.includes("create table if not exists hero_slide"), "schema.sql (เอกสาร) ต้องมีตารางนี้ด้วย");
  assert.ok(/migration 0027/.test(schema), "schema.sql ต้องบอกว่ารอบไหนสร้างตารางนี้");
});

test("hero module: แปลง object-position เดิม → จุดโฟกัส (ใช้ตอนย้ายสไลด์ขึ้นฐานข้อมูล)", () => {
  assert.deepEqual(focusFromObjectPosition("center center"), { x: 50, y: 50 });
  assert.deepEqual(focusFromObjectPosition("center 35%"), { x: 50, y: 35 }, "ค่าจริงของภาพงานฉลอง/ภาพเปิดตัว 3 รส");
  assert.deepEqual(focusFromObjectPosition("20% 35%"), { x: 20, y: 35 });
  assert.deepEqual(focusFromObjectPosition("left top"), { x: 0, y: 0 });
  assert.deepEqual(focusFromObjectPosition("right bottom"), { x: 100, y: 100 });
  assert.deepEqual(focusFromObjectPosition("50%"), { x: 50, y: 50 }, "ให้ค่าเดียว = แกน x");
  assert.deepEqual(focusFromObjectPosition(""), { x: 50, y: 50 }, "ว่าง = กลางภาพ");
  assert.deepEqual(focusFromObjectPosition("ไม่รู้จัก"), { x: 50, y: 50 }, "อ่านไม่ได้ = กลางภาพ (ไม่เดา)");
  assert.deepEqual(focusFromObjectPosition("150% -5%"), { x: 100, y: 0 }, "บีบให้อยู่ในช่วง 0–100");

  /* สคริปต์นำเข้าต้องไม่ทับลำดับที่คนจัดไว้ + ต้องมีโหมดดูผล */
  const script = readFileSync("scripts/import-hero-slides.ts", "utf8");
  assert.ok(script.includes("preserveOrder: true"), "ตัวนำเข้าต้องคง sort_order เดิม (บทเรียนรอบ 140)");
  assert.ok(script.includes("--dry-run"), "ต้องมีโหมดดูผลอย่างเดียว");
  assert.ok(!/\bdelete\b/i.test(script.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")), "ตัวนำเข้าต้องไม่ลบข้อมูล");
});

test("hero module: ชั้นอ่านฝั่งเว็บต้อง fallback ปลอดภัย (ไม่มี DB/ตารางหาย = คืน [] ไม่ throw)", () => {
  const repository = readFileSync("lib/hero/repository.ts", "utf8");
  assert.ok(repository.includes("PUBLIC_HERO_CONDITION"), "ต้องมีเงื่อนไขกลางของฝั่งเว็บ");
  assert.ok(repository.includes("deleted_at is null and is_active"), "เงื่อนไขต้องกันทั้งของในถังและของที่ปิดไว้");
  assert.ok(repository.includes("if (!isDatabaseConfigured()) return [];"), "ไม่มี DB = คืนรายการว่างทันที");
  assert.ok(repository.includes("await readQuery<"), "ฝั่งเว็บต้องอ่านผ่านประตูอ่านอย่างเดียว (readQuery)");
  assert.ok(/catch \{[\s\S]{0,120}return \[\];/.test(repository), "อ่านพังต้องกลืนแล้วคืนรายการว่าง (หน้าเว็บห้ามพังเพราะ DB)");
  assert.ok(repository.includes("listHeroPageSlidesForAdmin"), "หลังบ้านใช้ getPool (สิทธิ์เต็ม) แยกจากฝั่งเว็บ");
});

test("hero module: ต่อสายหน้าแรก — สไลด์จากฐานข้อมูล + ถอยไปเทมเพลตเมื่อว่าง", () => {
  /* ตัวแปลง (ตรรกะล้วน) */
  const rows = [
    { id: "flavours", sortOrder: 10, mediaPath: "/slide/a.jpg", altTh: "ไทย ก", altEn: "EN A", focusX: 50, focusY: 50, zoom: 1, isActive: true },
    { id: "event", sortOrder: 20, mediaPath: "/slide/b.jpg", altTh: "ไทย ข", altEn: "", focusX: 0, focusY: 100, zoom: 1.5, isActive: true },
  ];
  const th = managedHeroSlideViews(rows, "th");
  assert.equal(th.length, 2);
  assert.deepEqual(th[0], { id: "flavours", src: "/slide/a.jpg", alt: "ไทย ก", objectPosition: "50% 50%" });
  assert.equal(managedHeroSlideViews(rows, "en")[0]?.alt, "EN A", "อังกฤษมีค่า = ใช้ค่าอังกฤษ");
  assert.equal(managedHeroSlideViews(rows, "en")[1]?.alt, "ไทย ข", "อังกฤษว่าง = ถอยไปใช้ไทย");
  assert.equal(th[1]?.objectPosition, "0% 100%", "จุดโฟกัสกลายเป็น object-position");
  assert.equal(th[0]?.reviewStatus, undefined, "สไลด์จากหลังบ้านต้องไม่มีป้าย 'รออนุมัติ'");
  assert.deepEqual(managedHeroSlideViews([], "th"), [], "ไม่มีข้อมูล = รายการว่าง (หน้าแรกถอยไปเทมเพลต)");

  /* หน้าแรกต้องถอยไปเทมเพลตเสมอเมื่อไม่มีสไลด์จากหลังบ้าน */
  const hero = readFileSync("features/home/ui/hero.tsx", "utf8");
  assert.ok(hero.includes("dbSlides = []"), "ต้องมีค่าเริ่มต้นเป็นรายการว่าง");
  assert.ok(
    /dbSlides\.length > 0 \? dbSlides : templateSlides/.test(hero),
    "มีสไลด์จากหลังบ้าน = ใช้ของหลังบ้าน · ไม่มี = เทมเพลตเดิม",
  );
  assert.ok(hero.includes("HERO_SLIDES.map"), "เทมเพลตเดิมต้องยังอยู่ (ไม่ลบของเดิม)");

  const page = readFileSync("app/[lang]/page.tsx", "utf8");
  assert.ok(page.includes("listHeroPageSlides()"), "หน้าแรกต้องอ่านสไลด์จากชั้นข้อมูลของโมดูล");
  assert.ok(page.includes("managedHeroSlideViews("), "ต้องแปลงวิวผ่านตัวช่วยกลาง (ไม่ประกอบเองในหน้า)");
  assert.ok(page.includes("revalidate = 300"), "หน้าแรกยังต้องเป็น ISR 300 วิเหมือนเดิม");
});

test("hero module: หลังบ้าน — เมนูในไซด์บาร์ + หน้าจอ /admin/hero (สิทธิ์ · อ่านผ่านชั้นข้อมูล)", () => {
  const layout = readFileSync("app/admin/layout.tsx", "utf8");
  /* เมนูต้องอยู่ "ต่อจากส่วนกลางของเว็บ" ทั้งในลิสต์ด้านบนและกลุ่มไซด์บาร์ */
  const linksIndex = layout.indexOf('{ href: "/admin/builder/chrome", label: messages.admin.chromeTitle');
  const heroLinkIndex = layout.indexOf('{ href: "/admin/hero", label: messages.admin.heroAdminTitle');
  assert.ok(heroLinkIndex > linksIndex, "เมนูลิสต์ต้องมี /admin/hero ต่อจากส่วนกลางของเว็บ");
  const sidebarChrome = layout.indexOf("{ href: \"/admin/builder/chrome\", label: messages.admin.navChrome }");
  const sidebarHero = layout.indexOf("{ href: \"/admin/hero\", label: messages.admin.navHero }");
  assert.ok(sidebarHero > sidebarChrome, "ไซด์บาร์ต้องมีสไลด์ & แคมเปญ ต่อจากส่วนกลางของเว็บ");
  assert.ok(layout.includes('permission: "content"') && layout.includes('"/admin/hero"'), "เมนูต้องผูกสิทธิ์");

  /* หน้าจอ: ตรวจสิทธิ์ + อ่านผ่านชั้นข้อมูล (ไม่ประกอบ SQL เองในหน้าจอ) */
  const page = readFileSync("app/admin/hero/page.tsx", "utf8");
  assert.ok(page.includes('requireAdminUser("content")'), "หน้าจอต้องตรวจสิทธิ์ก่อนอ่านข้อมูล");
  assert.ok(page.includes("listHeroPageSlidesForAdmin()"), "ต้องอ่านผ่านชั้นข้อมูลของโมดูล");
  assert.ok(page.includes("heroAdminNextStep"), "ต้องบอกผู้ใช้ว่าเฟสถัดไปทำอะไร (ไม่ให้เข้าใจว่าจบแล้ว)");

  /* คีย์พจนานุกรมครบสองภาษา */
  const th = readFileSync("lib/i18n/messages/areas/th/admin.ts", "utf8");
  const en = readFileSync("lib/i18n/messages/areas/en/admin.ts", "utf8");
  for (const key of ["navHero", "heroAdminTitle", "heroAdminIntro", "heroAdminCount", "heroAdminEmpty", "heroAdminActive", "heroAdminInactive", "heroAdminFocus", "heroAdminZoom", "heroAdminSeeSite", "heroAdminNextStep"]) {
    assert.ok(th.includes(`${key}:`), `พจนานุกรมไทยต้องมี ${key}`);
    assert.ok(en.includes(`${key}:`), `พจนานุกรมอังกฤษต้องมี ${key}`);
  }
});

test("hero module (เอฟเฟค): อ่านค่าตั้งค่าจากฐานข้อมูล/ฟอร์ม — บีบช่วงค่า ไม่โยน error", () => {
  assert.deepEqual(parseHeroSetting({ effect: "slide", intervalMs: 8000 }), { effect: "slide", intervalMs: 8000 });
  assert.deepEqual(parseHeroSetting({ effect: "zoom", interval_ms: 3000 }), { effect: "zoom", intervalMs: 3000 }, "รองรับชื่อคอลัมน์แบบ DB");
  assert.deepEqual(parseHeroSetting({ effect: "ไม่รู้จัก", intervalMs: 999999 }), { effect: "fade", intervalMs: HERO_INTERVAL_MAX_MS }, "ค่าเพี้ยน = ค่าเริ่มต้น + บีบเพดาน");
  assert.deepEqual(parseHeroSetting(undefined), DEFAULT_HERO_SETTING);
  assert.equal(clampIntervalMs(500), HERO_INTERVAL_MIN_MS, "เร็วเกินถูกบีบ");
  assert.equal(clampIntervalMs("abc"), DEFAULT_HERO_SETTING.intervalMs);
  assert.ok(HERO_EFFECTS.includes("fade") && HERO_EFFECTS.includes("slide") && HERO_EFFECTS.includes("zoom") && HERO_EFFECTS.includes("none"));
  assert.equal(new Set(HERO_EFFECTS).size, HERO_EFFECTS.length, "เอฟเฟคต้องไม่ซ้ำ");
  assert.equal(isHeroEffect("fade"), true);
  assert.equal(isHeroEffect("FADE"), false, "ตัวพิมพ์ต้องตรงเป๊ะ");

  /* ต่อสายจริง: CSS มีทุกเอฟเฟค · ตัวเลื่อนรับค่า · หน้าแรกอ่านค่าจากชั้นข้อมูล */
  const css = readFileSync("app/globals.css", "utf8");
  for (const effect of HERO_EFFECTS) {
    assert.ok(css.includes(`[data-effect="${effect}"]`), `CSS ต้องมีเอฟเฟค ${effect}`);
  }
  assert.ok(/prefers-reduced-motion: reduce\)[\s\S]{0,200}\[data-hero-slide\] \{\s*transition: none/.test(css), "โหมดลดการเคลื่อนไหวต้องตัดภาพทันที");
  const slider = readFileSync("features/home/ui/hero-slider.tsx", "utf8");
  assert.ok(slider.includes("data-effect={effect}") && slider.includes("intervalMs"), "ตัวเลื่อนต้องรับเอฟเฟค/ความเร็วจากข้อมูล");
  const page = readFileSync("app/[lang]/page.tsx", "utf8");
  assert.ok(page.includes("loadHeroSetting()") && page.includes("heroSetting="), "หน้าแรกต้องอ่านค่าตั้งค่าและส่งเข้า hero");
  const admin = readFileSync("app/admin/hero/page.tsx", "utf8");
  assert.ok(admin.includes("saveHeroSettingAction") && admin.includes("HERO_EFFECTS.map"), "จอหลังบ้านต้องมีฟอร์มเลือกเอฟเฟค");
  const actions = readFileSync("app/admin/hero/actions.ts", "utf8");
  assert.ok(actions.includes("saveHeroSettingAction") && actions.includes("parseHeroSetting"), "action ต้องตรวจค่าด้วยตัวช่วยกลาง");
});
