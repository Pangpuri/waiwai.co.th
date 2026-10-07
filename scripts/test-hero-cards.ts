import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  HERO_CARD_POSITIONS,
  MAX_HERO_CARDS_PER_SLIDE,
  heroCardWindowState,
  isHeroCardLiveNow,
  isSafeHeroCardHref,
  normalizeMoment,
  parseHeroCardInput,
} from "@/lib/hero/cards";

/**
 * รอบที่ 188 — "การ์ดบนสไลด์ + ช่วงเวลาแคมเปญ" (ตรรกะล้วน)
 * กติกาสำคัญ: เริ่ม = รวมขอบ · จบ = ไม่รวมขอบ (ให้ตรงกับเงื่อนไข SQL ที่หน้าเว็บใช้จริง)
 */

const NOW = Date.parse("2026-10-07T12:00:00.000Z");
const at = (iso: string): string => new Date(Date.parse(iso)).toISOString();

test("hero cards: สถานะแคมเปญตามช่วงเวลา (เริ่มรวมขอบ · จบไม่รวมขอบ)", () => {
  assert.equal(heroCardWindowState({ startsAt: null, endsAt: null }, NOW), "always");
  assert.equal(heroCardWindowState({ startsAt: at("2026-10-08T00:00:00Z"), endsAt: null }, NOW), "scheduled");
  assert.equal(heroCardWindowState({ startsAt: null, endsAt: at("2026-10-07T11:59:59Z") }, NOW), "expired");
  assert.equal(heroCardWindowState({ startsAt: at("2026-10-07T12:00:00Z"), endsAt: null }, NOW), "live", "เริ่มตรงเวลา = เริ่มแสดง");
  assert.equal(heroCardWindowState({ startsAt: null, endsAt: at("2026-10-07T12:00:00Z") }, NOW), "expired", "จบตรงเวลา = หมดแล้ว");
  assert.equal(heroCardWindowState({ startsAt: at("2026-10-01T00:00:00Z"), endsAt: at("2026-11-01T00:00:00Z") }, NOW), "live");
});

test("hero cards: isHeroCardLiveNow ต้องปิดการ์ดที่ปิดใช้งาน", () => {
  assert.equal(isHeroCardLiveNow({ startsAt: null, endsAt: null, isActive: true }, NOW), true);
  assert.equal(isHeroCardLiveNow({ startsAt: null, endsAt: null, isActive: false }, NOW), false, "ปิดไว้ = ไม่แสดง");
  assert.equal(isHeroCardLiveNow({ startsAt: at("2026-10-08T00:00:00Z"), endsAt: null, isActive: true }, NOW), false);
});

test("hero cards: ตรวจค่าจากฟอร์ม (หัวข้อไทยบังคับ · ลิงก์ปลอดภัย · ปฏิเสธเวลาผิด)", () => {
  const base = {
    title: { th: "แคมเปญ", en: "" },
    body: { th: "", en: "" },
    ctaLabel: { th: "", en: "" },
    ctaHref: "",
    position: "left",
    startsAt: "",
    endsAt: "",
    isActive: true,
  };
  const ok = parseHeroCardInput(base);
  assert.equal(ok.ok, true);
  assert.equal(ok.ok ? ok.value.startsAt : "x", null, "วันew่าง = ไม่จำกัดเวลา");
  assert.equal(ok.ok ? ok.value.position : "x", "left");

  const noTitle = parseHeroCardInput({ ...base, title: { th: "  ", en: "Hello" } });
  assert.equal(noTitle.ok, false, "การ์ดไม่มีหัวข้อไทย = ปฏิเสธ");
  assert.ok(!noTitle.ok && noTitle.problems.some((problem) => problem.includes("title.th")));

  const badWindow = parseHeroCardInput({ ...base, startsAt: "2026-11-01T00:00", endsAt: "2026-10-01T00:00" });
  assert.equal(badWindow.ok, false, "จบก่อนเริ่ม = ปฏิเสธ (การ์ดจะไม่มีวันแสดง)");

  const badLink = parseHeroCardInput({ ...base, ctaHref: "javascript:alert(1)" });
  assert.equal(badLink.ok, false, "ลิงก์อันตรายต้องไม่ผ่าน");
  assert.equal(isSafeHeroCardHref("/products"), true);
  assert.equal(isSafeHeroCardHref("https://example.com"), true);
  assert.equal(isSafeHeroCardHref("mailto:a@b.co"), true);
  assert.equal(isSafeHeroCardHref("javascript:alert(1)"), false);

  assert.equal(normalizeMoment(""), null);
  assert.equal(normalizeMoment("ไม่ใช่วันที่"), null);
  assert.equal(HERO_CARD_POSITIONS.length, 3);
  assert.ok(MAX_HERO_CARDS_PER_SLIDE >= 1);
});

test("hero cards: ต่อสายจริง — เงื่อนไขเวลาใน SQL + พาเนลในหน้าจอ + ไม่มีภาษาไทยใน .tsx", () => {
  const repo = readFileSync("lib/hero/cards-repository.ts", "utf8");
  assert.ok(repo.includes("PUBLIC_HERO_CARD_CONDITION"), "ต้องมีเงื่อนไขกลางของฝั่งเว็บ");
  assert.ok(
    repo.includes("starts_at is null or starts_at <= now()") && repo.includes("ends_at is null or ends_at > now()"),
    "ช่วงเวลาต้องถูกกรองที่ SQL ด้วย now() (เริ่มรวมขอบ · จบไม่รวมขอบ)",
  );
  assert.ok(repo.includes("await readQuery<"), "ฝั่งเว็บต้องอ่านผ่านประตูอ่านอย่างเดียว");
  assert.ok(/catch \{[\s\S]{0,120}return \{\};/.test(repo), "อ่านพังต้องคืนค่าว่าง ไม่ทำให้หน้าเว็บพัง");

  const page = readFileSync("app/admin/hero/page.tsx", "utf8");
  assert.ok(!page.includes("listHeroCardsForAdmin()"), "มติเจ้าของ 2026-10-07: ถอดการ์ดผูกสไลด์ 1:1 — หน้าจอต้องไม่โหลดการ์ดแบบเดิมแล้ว");
  const manager = readFileSync("features/admin/ui/hero-slide-manager.tsx", "utf8");
  assert.ok(!manager.includes("HeroCardEditor"), "พาเนลการ์ดในหน้าสไลด์ต้องถูกถอดออก (แคมเปญย้ายไปแท็บของตัวเอง)");
  const editor = readFileSync("features/admin/ui/hero-card-editor.tsx", "utf8");
  assert.ok(editor.includes("datetime-local") && editor.includes("heroCardWindowState"), "พาเนลต้องมีช่องช่วงเวลาและแสดงสถานะ");
  assert.ok(!/[\u0E00-\u0E7F]/.test(editor.split("return (")[1] ?? ""), "โค้ดพาเนลต้องไม่มีข้อความไทย (ใช้พจนานุกรม)");
});
