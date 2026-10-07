/**
 * โมดูล "สไลด์ & แคมเปญ" — ชั้นโมเดล (ตรรกะล้วน · ทดสอบได้โดยไม่ต้องมี DB)
 *
 * รอบที่ 184 · เฟส 1: สไลด์ของ hero หน้าแรกย้ายจากโค้ด (`features/home/slides.ts`) ขึ้นฐานข้อมูล
 * ⇒ การตลาดแก้ภาพ/ตำแหน่ง/ลำดับได้เองจากหลังบ้าน และเตรียมที่ให้ "การ์ดบนสไลด์" + ช่วงเวลาแคมเปญในเฟสถัดไป
 *
 * กติกาสำคัญ (ยึดของเดิมทั้งโปรเจกต์)
 * - เก็บ **พาธ** ไม่เก็บ URL เต็ม (มติ D9) · ภาพในคลัง = `/media/<id>` · ไฟล์ในโปรเจกต์ = `/slide/...`
 * - จุดโฟกัส 0–100 · ซูม 1–2 (ค่าเดียวกับ `lib/blocks/hero-slides.ts` รอบ 183 — ใช้ตัวช่วยเดียวกัน)
 * - ยังไม่เลือกภาพ/ไม่มีพาธ = **ไม่ผ่าน** (ต่างจากบล็อกที่ปล่อยเป็นคำเตือน เพราะสไลด์หน้าแรกต้องมีภาพจริง)
 */

import { HERO_ZOOM_MAX, HERO_ZOOM_MIN } from "@/lib/blocks/types";

/** จำนวนสไลด์สูงสุดที่แสดงบนหน้าแรก (เกินนี้ผู้ชมจำไม่ได้ว่าเห็นอะไรไปแล้ว) */
export const MAX_HERO_PAGE_SLIDES = 6;

/** สไลด์หนึ่งใบของหน้าแรก */
export type HeroPageSlide = {
  readonly id: string;
  readonly sortOrder: number;
  readonly mediaPath: string;
  readonly altTh: string;
  readonly altEn: string;
  readonly focusX: number;
  readonly focusY: number;
  readonly zoom: number;
  readonly isActive: boolean;
};

/** ค่าที่รับจากฟอร์มหลังบ้าน (ยังไม่ผ่านการตรวจ) */
export type HeroSlideInput = {
  readonly mediaPath: string;
  readonly altTh: string;
  readonly altEn: string;
  readonly focusX: number;
  readonly focusY: number;
  readonly zoom: number;
  readonly isActive: boolean;
};

export type HeroSlideParseOutcome =
  | { readonly ok: true; readonly value: HeroSlideInput }
  | { readonly ok: false; readonly problems: readonly string[] };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** บีบจุดโฟกัสให้เป็นจำนวนเต็ม 0–100 (ค่าที่ไม่ใช่ตัวเลข = กลางภาพ) */
export function clampFocus(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? clamp(Math.round(value), 0, 100) : 50;
}

/** บีบระดับซูมให้อยู่ใน 1–2 (ทศนิยม 2 ตำแหน่ง · ค่าที่ไม่ใช่ตัวเลข = ไม่ซูม) */
export function clampZoom(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return HERO_ZOOM_MIN;
  return clamp(Math.round(value * 100) / 100, HERO_ZOOM_MIN, HERO_ZOOM_MAX);
}

/** พาธต้องเป็นพาธภายในเว็บ (ห้าม URL เต็ม/ห้ามว่าง) — มติ D9 */
export function isLocalMediaPath(value: string): boolean {
  const path = value.trim();
  if (path === "" || !path.startsWith("/")) return false;
  return !path.startsWith("//") && !/^[a-z][a-z0-9+.-]*:/i.test(path);
}

/**
 * ตรวจค่าที่ส่งมาจากฟอร์ม/เบราว์เซอร์ก่อนบันทึก (ไม่เชื่อข้อมูลที่มาจากข้างนอก)
 * - ภาพต้องเป็นพาธในเว็บ · **alt ไทยต้องมี** (a11y + ด่าน check:content ของโปรเจกต์) · อังกฤษไม่บังคับแต่ถ้ามีต้องคู่กัน
 * - ช่วงค่าถูก "บีบ" ไม่ "ปฏิเสธ" (ผู้ใช้เลื่อนแถบแล้วเกินขอบไม่ควรถูกด่า)
 */
export function parseHeroSlideInput(raw: unknown): HeroSlideParseOutcome {
  const problems: string[] = [];
  const record = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;

  const mediaPath = typeof record["mediaPath"] === "string" ? record["mediaPath"].trim() : "";
  if (!isLocalMediaPath(mediaPath)) {
    problems.push("mediaPath: ต้องเป็นพาธภายในเว็บ (ขึ้นต้นด้วย /) และห้ามเป็น URL เต็ม");
  }

  const altTh = typeof record["altTh"] === "string" ? record["altTh"].trim() : "";
  if (altTh === "") problems.push("altTh: ต้องมีคำอธิบายภาพภาษาไทย (a11y)");

  const altEn = typeof record["altEn"] === "string" ? record["altEn"].trim() : "";
  if (altEn !== "" && altTh === "") problems.push("altEn: มีคำอธิบายอังกฤษแต่ไม่มีไทย");

  if (problems.length > 0) return { ok: false, problems };

  return {
    ok: true,
    value: {
      mediaPath,
      altTh,
      altEn,
      focusX: clampFocus(record["focusX"]),
      focusY: clampFocus(record["focusY"]),
      zoom: clampZoom(record["zoom"]),
      isActive: record["isActive"] !== false,
    },
  };
}

/** เรียงสไลด์ตามลำดับที่ตั้งไว้ (ค่าน้อยก่อน · ลำดับเท่ากันใช้ id ให้ผลนิ่ง) */
export function sortHeroPageSlides(slides: readonly HeroPageSlide[]): readonly HeroPageSlide[] {
  return [...slides].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** ย้ายสไลด์ขึ้น/ลงในรายการ (ใช้ทั้งหน้าจอหลังบ้านและเทสต์) */
export function moveHeroPageSlide(
  slides: readonly HeroPageSlide[],
  id: string,
  delta: number,
): readonly HeroPageSlide[] {
  const from = slides.findIndex((slide) => slide.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= slides.length) return slides;
  const next = [...slides];
  const moved = next[from];
  const target = next[to];
  if (moved === undefined || target === undefined) return slides;
  next[from] = target;
  next[to] = moved;
  return next;
}

/**
 * แปลง `object-position` ของเดิม (`features/home/slides.ts`) ให้เป็นจุดโฟกัสร้อยละ
 * รูปแบบที่รองรับ: `"center center"` · `"center 35%"` · `"20% 35%"` (คำสำคัญ: left/center/right · top/center/bottom)
 * ⚠️ อ่านไม่ได้ = กลางภาพ (ไม่เดา) — ใช้ตอนย้ายสไลด์เดิมขึ้นฐานข้อมูล
 */
export function focusFromObjectPosition(value: string): { readonly x: number; readonly y: number } {
  const parts = value.trim().toLowerCase().split(/\s+/).filter((part) => part !== "");
  if (parts.length === 0) return { x: 50, y: 50 };
  const [first = "", second = ""] = parts;
  if (parts.length === 1) return { x: axisValue(first, 50), y: 50 };
  return { x: axisValue(first, 50), y: axisValue(second, 50) };
}

function axisValue(token: string, fallback: number): number {
  if (token.endsWith("%")) {
    const parsed = Number.parseFloat(token.slice(0, -1));
    return Number.isFinite(parsed) ? clamp(parsed, 0, 100) : fallback;
  }
  /* คำสำคัญของ CSS — ใช้ค่ากลางของช่วงนั้น ๆ */
  if (token === "left" || token === "top") return 0;
  if (token === "right" || token === "bottom") return 100;
  return fallback;
}
