import { MOURNING_IMAGES } from "@/features/shell/mourning";
import type { LocalizedValue } from "@/lib/content/types";
import type { Messages } from "@/lib/i18n/messages/th";

/**
 * ตั้งค่าป๊อปอัพ "ประกาศไว้อาลัย" — ให้แก้จากหลังบ้านได้ (ผู้ใช้สั่ง รอบที่ 35)
 *
 * ทำไมต้องมี
 * - เดิมค่าทุกอย่างอยู่ในโค้ด (`features/shell/mourning.ts` + พจนานุกรม) ⇒ เปลี่ยนภาพ/ข้อความต้องแก้โค้ดแล้ว deploy
 * - ค่าที่ผู้ใช้ชี้ว่าใช้จริงคือ **โฟลเดอร์ภาพ `public/rip/`** (ผู้ใช้: "ค่าจากเส้นโฟลเดอร์ภาพ rip")
 *   ⇒ ตอนนี้ย้ายมาเป็น "อัปโหลด/เลือกภาพจากคลังภาพ" ที่แก้ได้เองในหลังบ้าน
 *
 * เก็บที่ไหน: ตาราง `page_document` แถว `page = "mourning"` (draft/published + ประวัติ เหมือนหน้าเว็บ)
 * - **ค่าเริ่มต้น = ค่าที่โค้ด/พจนานุกรมใช้อยู่ตอนนี้** ⇒ ถ้าฐานข้อมูลว่างหรือยังไม่ตั้งค่า หน้าเว็บยังทำงานเหมือนเดิมเป๊ะ
 * - ข้อความ UI เล็ก ๆ (ปุ่มก่อนหน้า/ถัดไป/ป้ายหน้าต่าง) ยังมาจากพจนานุกรม (เป็นส่วนประกอบ ไม่ใช่เนื้อหา)
 */

export const MOURNING_PAGE_KEY = "mourning";
/**
 * เพดานจำนวนภาพประกาศ — ขยายจาก 6 เป็น 12 (ผู้ใช้สั่ง รอบที่ 36: "เผื่อเดือนนึงตายสัก 8 9 คน")
 * ผู้ชมต้องกด "ดูภาพต่อไป" ไล่ให้ครบก่อนปิดได้ (กติกาเดิมตั้งแต่รอบที่ 21) จึงต้องมีจุดนำทางครบทุกภาพ
 */
export const MAX_MOURNING_IMAGES = 12;

/**
 * สัดส่วนมาตรฐานของภาพป้ายประกาศ (3000×1000 = 3:1)
 *
 * ใช้ 2 ที่ (แหล่งความจริงเดียว):
 * 1. **ครอปตอนอัปโหลด** (รอบที่ 168) — ภาพที่ไม่ใช่ 3:1 ถูกครอปกลางให้อัตโนมัติ
 * 2. **ขนาดสำรอง** ตอนภาพที่อัปโหลดใหม่ไม่รู้ขนาดจริง (ดู lib/mourning/loader.ts)
 *    ⇒ กรอบป้ายไม่กระตุก (CSS ล็อกกล่องไว้ 3:1 แล้วตั้งแต่รอบที่ 166)
 */
export const MOURNING_IMAGE_ASPECT = 3;
export const MOURNING_IMAGE_WIDTH = 3000;
export const MOURNING_IMAGE_HEIGHT = 1000;

export type MourningImageConfig = {
  /** พาธในโปรเจกต์ (`/rip/...` ของเดิม) หรือ `/media/<id>` ของที่อัปโหลดใหม่ (มติ D9) */
  readonly path: string;
  readonly altTh: string;
  readonly altEn: string;
  readonly width: number | null;
  readonly height: number | null;
};

export type MourningConfig = {
  readonly enabled: boolean;
  readonly caption: LocalizedValue;
  readonly closeLabel: LocalizedValue;
  readonly muteTodayLabel: LocalizedValue;
  readonly seeNextLabel: LocalizedValue;
  readonly images: readonly MourningImageConfig[];
};

/**
 * ค่าตั้งต้น = สิ่งที่หน้าเว็บใช้อยู่ทุกวันนี้
 * ⚠️ รอบที่ 36 (ผู้ใช้สั่ง): **"เปลี่ยนเป็นรูปประกาศแทน"** ⇒ คำบรรยายตั้งต้น = ว่าง (ให้ตัวภาพเป็นตัวประกาศ)
 *    · ยังแก้ข้อความได้ถ้าต้องการ (ช่องนี้เป็น "ไม่บังคับ" แล้ว)
 */
export function defaultMourningConfig(messages: Messages): MourningConfig {
  return {
    enabled: true,
    caption: { th: "", en: "" },
    closeLabel: { th: messages.mourning.close, en: messages.mourning.close },
    muteTodayLabel: { th: messages.mourning.muteToday, en: messages.mourning.muteToday },
    seeNextLabel: { th: messages.mourning.seeNext, en: messages.mourning.seeNext },
    images: MOURNING_IMAGES.map((image) => ({
      path: image.src,
      altTh: messages.mourning.images[image.id].alt,
      altEn: "",
      width: image.width,
      height: image.height,
    })),
  };
}

/* ── ตรวจข้อมูลที่ส่งมาจากหน้าจอหลังบ้าน (ไม่เชื่อข้อมูลจากเบราว์เซอร์) ───────── */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toText(value: unknown, fallback: LocalizedValue): LocalizedValue {
  if (!isRecord(value)) return fallback;
  const th = typeof value["th"] === "string" ? value["th"] : fallback.th;
  const en = typeof value["en"] === "string" ? value["en"] : fallback.en;
  return { th, en };
}

export type MourningParseResult =
  | { readonly ok: true; readonly config: MourningConfig }
  | { readonly ok: false; readonly problems: readonly string[] };

export function parseMourningConfig(raw: unknown, messages: Messages): MourningParseResult {
  const fallback = defaultMourningConfig(messages);
  const problems: string[] = [];

  if (!isRecord(raw)) {
    return { ok: false, problems: ["ข้อมูลที่ส่งมาไม่ใช่ออบเจ็กต์"] };
  }

  if (raw["enabled"] !== undefined && typeof raw["enabled"] !== "boolean") {
    problems.push("enabled: ต้องเป็น true/false");
  }

  const rawImages = raw["images"];
  if (rawImages !== undefined && !Array.isArray(rawImages)) {
    problems.push("images: ต้องเป็นรายการ (array)");
  }

  const list = Array.isArray(rawImages) ? rawImages.slice(0, MAX_MOURNING_IMAGES) : [];
  if (Array.isArray(rawImages) && rawImages.length > MAX_MOURNING_IMAGES) {
    problems.push(`images: เกินจำนวนที่อนุญาต (${rawImages.length} > ${MAX_MOURNING_IMAGES}) — ตัดส่วนเกินทิ้ง`);
  }

  const images: MourningImageConfig[] = [];
  list.forEach((entry, index) => {
    if (!isRecord(entry)) {
      problems.push(`images[${index}]: ต้องเป็นออบเจ็กต์`);
      return;
    }

    const path = typeof entry["path"] === "string" ? entry["path"].trim() : "";
    /* ช่องว่างที่ผู้ใช้กด "+ เพิ่มภาพ" แล้วยังไม่ได้วางไฟล์ = ข้ามเงียบ ๆ (ไม่ใช่ error) */
    if (path === "") return;

    const width = typeof entry["width"] === "number" && entry["width"] > 0 ? Math.trunc(entry["width"]) : null;
    const height = typeof entry["height"] === "number" && entry["height"] > 0 ? Math.trunc(entry["height"]) : null;

    images.push({
      path,
      altTh: typeof entry["altTh"] === "string" ? entry["altTh"] : "",
      altEn: typeof entry["altEn"] === "string" ? entry["altEn"] : "",
      width,
      height,
    });
  });

  const config: MourningConfig = {
    enabled: raw["enabled"] === undefined ? fallback.enabled : raw["enabled"] === true,
    caption: toText(raw["caption"], fallback.caption),
    closeLabel: toText(raw["closeLabel"], fallback.closeLabel),
    muteTodayLabel: toText(raw["muteTodayLabel"], fallback.muteTodayLabel),
    seeNextLabel: toText(raw["seeNextLabel"], fallback.seeNextLabel),
    images,
  };

  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, config };
}

/* ── ตรวจความถูกต้อง (ใช้ทั้งหน้าจอหลังบ้านและตอนโหลดไปใช้) ──────────────────── */

export type MourningIssue = {
  readonly severity: "error" | "warning";
  readonly code: string;
  readonly path: string;
  readonly detail: string | null;
};

export function validateMourningConfig(config: MourningConfig): readonly MourningIssue[] {
  const issues: MourningIssue[] = [];

  /* ปิดอยู่ = ไม่ต้องตรวจอะไรเลย (เก็บร่างไว้ก่อนได้) */
  if (!config.enabled) return issues;

  /* ไม่มีภาพ = **ไม่ใช่ error** — เป็นสภาพที่ถูกต้อง (ผู้ใช้สั่ง รอบที่ 38: "ถ้าไม่มีภาพ ... ให้ข้ามส่วนนี้ไป")
     หน้าเว็บจะไม่แสดงป้ายนี้เลย · เตือนไว้ให้รู้ตัวว่ายังไม่ได้ใส่ภาพ */
  if (config.images.length === 0) {
    issues.push({ severity: "warning", code: "no-images", path: "images", detail: null });
  }

  /* คำบรรยายใต้ภาพเป็น "ไม่บังคับ" (รอบที่ 36: ใช้ตัวภาพเป็นตัวประกาศ) — ว่างได้ ไม่นับเป็น error */
  if (config.closeLabel.th.trim() === "") {
    issues.push({ severity: "error", code: "empty-th", path: "closeLabel.th", detail: null });
  }
  if (config.muteTodayLabel.th.trim() === "") {
    issues.push({ severity: "error", code: "empty-th", path: "muteTodayLabel.th", detail: null });
  }

  config.images.forEach((image, index) => {
    const path = `images[${index}]`;
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(image.path) || image.path.startsWith("//")) {
      issues.push({ severity: "error", code: "media-path-is-url", path: `${path}.path`, detail: "ต้องเก็บเป็นพาธ (มติ D9)" });
    } else if (!image.path.startsWith("/")) {
      issues.push({ severity: "error", code: "bad-path", path: `${path}.path`, detail: "พาธต้องขึ้นต้นด้วย /" });
    }
    if (image.altTh.trim() === "") {
      issues.push({ severity: "error", code: "missing-alt", path: `${path}.altTh`, detail: "ภาพต้องมีคำอธิบาย (มติ D7)" });
    }
  });

  return issues;
}

export function mourningErrorsOf(issues: readonly MourningIssue[]): readonly MourningIssue[] {
  return issues.filter((entry) => entry.severity === "error");
}

/* ── จัดลำดับภาพในป้ายประกาศ (รอบที่ 170 · ตรรกะล้วน — ทดสอบได้) ─────────────── */

/**
 * ย้ายภาพจากตำแหน่ง `from` ไปแทรกที่ตำแหน่ง `to`
 * ใช้ทั้งการลากวางในแกลเลอรีและปุ่ม "ตั้งเป็นภาพแรก" (to = 0)
 * ค่าดัชนีที่ใช้อ้างนอกช่วง = คืนรายการเดิม (ไม่ทำข้อมูลหาย)
 */
export function moveImageTo<T>(images: readonly T[], from: number, to: number): readonly T[] {
  if (from === to) return images;
  if (from < 0 || to < 0 || from >= images.length || to >= images.length) return images;
  const next = [...images];
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return images;
  next.splice(to, 0, moved);
  return next;
}

/**
 * ดัชนีที่ "เลือกอยู่" ควรอยู่ที่ไหนหลังย้ายภาพ — ต้องติดตามภาพที่เลือกเสมอ
 * ไม่งั้นแผงแก้ด้านล่างจะชี้ไปคนละภาพทันทีหลังจัดลำดับ
 */
export function selectedImageAfterMove(current: number, from: number, to: number): number {
  if (from === to) return current;
  if (current === from) return to;
  if (from < current && to >= current) return current - 1;
  if (from > current && to <= current) return current + 1;
  return current;
}

/* ── บอกผู้ใช้ว่า "แก้ส่วนไหนไปแล้ว และบันทึกหรือยัง" (ผู้ใช้สั่ง รอบที่ 38) ──────── */

export type MourningChangeKind =
  | "enabled"
  | "caption"
  | "close"
  | "mute"
  | "seeNext"
  | "image-added"
  | "image-removed"
  | "image-changed";

export type MourningChange = {
  readonly kind: MourningChangeKind;
  /** ลำดับภาพ (เริ่มที่ 1) — มีค่าเฉพาะเรื่องภาพ */
  readonly imageNumber: number | null;
};

function textChanged(a: LocalizedValue, b: LocalizedValue): boolean {
  return a.th !== b.th || a.en !== b.en;
}

function imageChanged(a: MourningImageConfig, b: MourningImageConfig): boolean {
  return a.path !== b.path || a.altTh !== b.altTh || a.altEn !== b.altEn || a.width !== b.width || a.height !== b.height;
}

/**
 * เทียบ "ค่าที่บันทึกไว้ล่าสุด" กับ "ค่าบนหน้าจอตอนนี้" → รายการที่เปลี่ยน (ไม่ซ้ำ ไม่ต้องเดา)
 * ใช้แสดงว่า "มีการแก้ไขที่ส่วนไหน ยังไม่บันทึก" และหายไปเมื่อกดบันทึกสำเร็จ
 */
export function diffMourningConfig(baseline: MourningConfig, current: MourningConfig): readonly MourningChange[] {
  const changes: MourningChange[] = [];

  if (baseline.enabled !== current.enabled) changes.push({ kind: "enabled", imageNumber: null });
  if (textChanged(baseline.caption, current.caption)) changes.push({ kind: "caption", imageNumber: null });
  if (textChanged(baseline.closeLabel, current.closeLabel)) changes.push({ kind: "close", imageNumber: null });
  if (textChanged(baseline.muteTodayLabel, current.muteTodayLabel)) changes.push({ kind: "mute", imageNumber: null });
  if (textChanged(baseline.seeNextLabel, current.seeNextLabel)) changes.push({ kind: "seeNext", imageNumber: null });

  const max = Math.max(baseline.images.length, current.images.length);
  for (let index = 0; index < max; index += 1) {
    const before = baseline.images[index];
    const after = current.images[index];

    if (before === undefined) changes.push({ kind: "image-added", imageNumber: index + 1 });
    else if (after === undefined) changes.push({ kind: "image-removed", imageNumber: index + 1 });
    else if (imageChanged(before, after)) changes.push({ kind: "image-changed", imageNumber: index + 1 });
  }

  return changes;
}
