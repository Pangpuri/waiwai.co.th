import type { MourningNoticeImage } from "@/features/shell/mourning";
import type { Locale } from "@/lib/i18n/config";

/**
 * แปลงค่าป้ายประกาศที่รับ "สด ๆ" จากหลังบ้าน (ยังไม่บันทึก) ให้เป็นรูปทรงที่ตัวแสดงผลใช้
 *
 * บริบท (รอบที่ 161–168)
 * - ตัวแก้ป้ายประกาศยิง `CustomEvent` → workspace จับ → `postMessage` เข้า iframe พรีวิว
 * - ค่าที่ส่งมา **ยังไม่ผ่านการตรวจของเซิร์ฟเวอร์** และรูปร่างอาจต่างจากของที่เรนเดอร์จาก DB
 *   (เคยเกิด "empty string passed to src" + "Received NaN for width/height" ในคอนโซลจริง)
 * - รอบที่ 161–166 รับเฉพาะ "ภาพ" ⇒ รอบที่ 168 รับเพิ่ม **ข้อความ (caption/ปุ่ม) + สถานะเปิด-ปิด**
 *
 * หลักการ
 * 1. **เป็น pure module** (ไม่แตะ DOM/React) ⇒ `node --test` ตรวจได้ตรง ๆ
 * 2. รับได้ทั้ง `src` / `path` / `mediaId` · เดาชนาดไม่ได้ = ใช้ 3:1 มาตรฐาน (ตรงกับ loader)
 * 3. ภาพที่ยังไม่มีแหล่งที่มา = **ข้าม** (ไม่เรนเดอร์เลย ดีกว่าส่ง src ว่างให้เบราว์เซอร์)
 * 4. ข้อความเลือกภาษาตาม `locale` แล้ว **ถอยไปใช้ค่าของอีกภาษาเมื่อช่องนั้นว่าง**
 *    — แต่ถ้าผู้ใช้ตั้งใจล้างข้อความ (ว่างทั้งคู่) ก็ต้องได้ว่างจริง (caption เป็นช่องไม่บังคับ)
 */

export type MourningLiveNotice = {
  readonly enabled: boolean;
  readonly images: readonly MourningNoticeImage[];
  readonly caption: string;
  readonly closeLabel: string;
  readonly muteTodayLabel: string;
  readonly seeNextLabel: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * ภาพ 1 ใบจากข้อความสด → รูปทรงที่ตัวแสดงผลใช้ (หรือ `null` = ใช้ไม่ได้/ข้าม)
 * @internal ส่งออกเพื่อให้เทสต์ตรวจตรง ๆ (ไม่ใช่ API ของหน้าจอ)
 */
export function toLiveImage(raw: unknown): MourningNoticeImage | null {
  if (typeof raw !== "object" || raw === null) return null;
  const item = raw as {
    readonly id?: unknown;
    readonly src?: unknown;
    readonly path?: unknown;
    readonly mediaId?: unknown;
    readonly alt?: unknown;
    readonly altTh?: unknown;
    readonly width?: unknown;
    readonly height?: unknown;
  };
  const src =
    typeof item.src === "string" && item.src !== ""
      ? item.src
      : typeof item.path === "string" && item.path !== ""
        ? item.path
        : typeof item.mediaId === "string" && item.mediaId !== ""
          ? `/media/${item.mediaId}`
          : "";
  if (src === "") return null;
  /* ขนาดไม่รู้ = ใช้ 3:1 มาตรฐาน เพื่อให้กรอบไม่กระตุกตอนพรีวิว (ตรงกับ lib/mourning/loader.ts) */
  const width = typeof item.width === "number" && Number.isFinite(item.width) && item.width > 0 ? item.width : 1200;
  const height = typeof item.height === "number" && Number.isFinite(item.height) && item.height > 0 ? item.height : 400;
  const alt =
    typeof item.alt === "string" && item.alt !== ""
      ? item.alt
      : typeof item.altTh === "string"
        ? item.altTh
        : "";
  return {
    id: typeof item.id === "string" && item.id !== "" ? item.id : src,
    src,
    alt,
    width,
    height,
  };
}

/**
 * ข้อความไทย/อังกฤษ → ข้อความภาษาเดียวตาม `locale`
 * - ภาษาอังกฤษว่าง = ถอยไปใช้ไทย (แบบเดียวกับ loader: EN ไม่บังคับ)
 * - ไม่ใช่ออบเจ็กต์ = คืน `null` (ให้ผู้เรียกถอยไปใช้ค่าจากเซิร์ฟเวอร์)
 */
export function liveTextOf(raw: unknown, locale: Locale): string | null {
  if (!isRecord(raw)) return null;
  const th = typeof raw["th"] === "string" ? raw["th"] : "";
  const en = typeof raw["en"] === "string" ? raw["en"] : "";
  if (locale === "en" && en.trim() !== "") return en;
  return th;
}

/**
 * ข้อความสดทั้งก้อน → รูปทรงที่พร้อมเรนเดอร์
 * คืน `null` เมื่อข้อมูลไม่ใช่ออบเจ็กต์ (ผู้เรียกจะถอยไปใช้ค่าจากเซิร์ฟเวอร์ทั้งหมด)
 *
 * ⚠️ `enabled` ไม่ใช่ boolean = ถือว่าเปิด (ไม่ซ่อนป้ายเพราะข้อความไม่ครบ)
 */
export function parseMourningLiveConfig(raw: unknown, locale: Locale): MourningLiveNotice | null {
  if (!isRecord(raw)) return null;

  const rawImages = Array.isArray(raw["images"]) ? raw["images"] : [];
  const images = rawImages
    .map((item) => toLiveImage(item))
    .filter((item): item is MourningNoticeImage => item !== null);

  return {
    enabled: raw["enabled"] !== false,
    images,
    caption: liveTextOf(raw["caption"], locale) ?? "",
    closeLabel: liveTextOf(raw["closeLabel"], locale) ?? "",
    muteTodayLabel: liveTextOf(raw["muteTodayLabel"], locale) ?? "",
    seeNextLabel: liveTextOf(raw["seeNextLabel"], locale) ?? "",
  };
}
