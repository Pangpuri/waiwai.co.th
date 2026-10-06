"use client";

/**
 * ย่อขนาด/แปลงภาพ **ในเบราว์เซอร์ก่อนอัปโหลด** (รอบที่ 99 · หนี้ "ย่อภาพ/WebP")
 *
 * ทำไมทำฝั่งเบราว์เซอร์ (ไม่ใช้ `sharp`)
 * - กติกาโปรเจกต์: **ห้ามเพิ่ม dependency โดยไม่ถาม** — และงานนี้ทำได้ด้วย API ของเบราว์เซอร์ล้วน
 *   (`createImageBitmap` + `canvas` + WebP encoder ที่มีอยู่ในทุกเบราว์เซอร์รุ่นใหม่)
 * - ภาพจากมือถือมัก 3–8 MB (เกินเพดาน 5MB ของเซิร์ฟเวอร์) ⇒ ย่อก่อนส่งช่วยทั้งผู้ใช้และฐานข้อมูล
 *   (มติ D11: เก็บไบต์ในฐานข้อมูล ⇒ ทุก MB ที่ลดได้คือที่เก็บจริงที่ประหยัด)
 *
 * ⚠️ หลักการที่ยึด
 * 1. **ไม่ทำให้แย่ลง**: ถ้าย่อ/แปลงไม่สำเร็จ หรือได้ไฟล์ใหญ่กว่าเดิม → ส่งไฟล์เดิม
 * 2. **เซิร์ฟเวอร์ยังเป็นด่านจริง**: เพดาน 5MB + ตรวจหัวไฟล์ (`lib/media/image-info.ts`) ไม่เปลี่ยน
 *    ⇒ ไฟล์ที่ผ่านเบราว์เซอร์มาไม่ถูกเชื่อมากไปกว่าเดิม
 * 3. **ผู้ใช้ที่ปิด JavaScript ยังอัปโหลดได้** (ส่งไฟล์เดิม) — เป็นเพียงทางลัด ไม่ใช่เงื่อนไข
 * 4. ไฟล์ชนิดอื่น (`accept` จำกัดอยู่แล้ว) ไม่ถูกแตะ
 */

/** ความยาวด้านที่ยาวที่สุดหลังย่อ (px) — พอสำหรับจอ 2x บนการ์ด/ฮีโร่ แต่ไม่ใหญ่เกินจำเป็น */
export const MAX_UPLOAD_EDGE = 2400;

/** คุณภาพ WebP (0–1) — 0.82 เป็นจุดที่สายตาแทบแยกไม่ออกแต่ไฟล์เล็กลงมาก */
export const WEBP_QUALITY = 0.82;

/** ไฟล์เล็กกว่านี้ไม่คุ้มเสี่ยงกับคุณภาพที่ลดลง (ไบต์) */
export const SHRINK_MIN_BYTES = 150 * 1024;

/** ชนิดที่รับได้ (ตรงกับที่เซิร์ฟเวอร์ยอมรับ — ห้ามกว้างกว่านี้) */
const SHRINKABLE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

/** ผลของการลองย่อ — ใช้บอกผู้ใช้บนหน้าจอได้ด้วย */
export type ShrinkOutcome = {
  readonly file: File;
  /** ย่อจริงหรือไม่ */
  readonly shrunken: boolean;
  readonly originalBytes: number;
  readonly bytes: number;
  /** เหตุผลเมื่อไม่ย่อ (ไว้แสดง/ดีบัก — ไม่ใช่ error) */
  readonly skipped: "unsupported" | "too-small" | "failed" | "not-smaller" | null;
};

/** ขนาดที่ควรย่อเป็น (ตรรกะล้วน — ทดสอบได้) */
export function scaleToFit(width: number, height: number, maxEdge: number): { readonly width: number; readonly height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { width: 0, height: 0 };
  }
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width: Math.round(width), height: Math.round(height) };

  const ratio = maxEdge / longest;
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}

/** ควรลองย่อไหม (ตรรกะล้วน) */
export function shouldAttemptShrink(input: { readonly type: string; readonly size: number }): boolean {
  if (!(SHRINKABLE_TYPES as readonly string[]).includes(input.type)) return false;
  return input.size >= SHRINK_MIN_BYTES;
}

/** ชื่อไฟล์หลังแปลงเป็น WebP (คงชื่อเดิม เปลี่ยนนามสกุลเท่านั้น) */
export function webpFilename(name: string): string {
  const trimmed = name.trim() === "" ? "image" : name.trim();
  const withoutExtension = trimmed.replace(/\.[A-Za-z0-9]{1,5}$/, "");
  return `${withoutExtension === "" ? "image" : withoutExtension}.webp`;
}

/** แปลง canvas เป็น Blob (รองรับทั้ง OffscreenCanvas และ canvas ปกติ) */
async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/webp", WEBP_QUALITY);
  });
}

/**
 * ลองย่อ + แปลงเป็น WebP — **ไม่มีทางโยน error** (ล้มเหลว = คืนไฟล์เดิมพร้อมเหตุผล)
 *
 * ใช้จาก client component เท่านั้น (ต้องมี DOM) — การตัดสินใจทั้งหมดอยู่ในฟังก์ชันบริสุทธิ์ด้านบน
 */
export async function shrinkImageFile(file: File): Promise<ShrinkOutcome> {
  const base: ShrinkOutcome = { file, shrunken: false, originalBytes: file.size, bytes: file.size, skipped: null };

  if (!shouldAttemptShrink(file)) {
    return { ...base, skipped: "unsupported" };
  }
  if (typeof document === "undefined" || typeof createImageBitmap !== "function") {
    return { ...base, skipped: "failed" };
  }

  try {
    const bitmap = await createImageBitmap(file);
    const size = scaleToFit(bitmap.width, bitmap.height, MAX_UPLOAD_EDGE);

    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (context === null || size.width === 0) {
      bitmap.close();
      return { ...base, skipped: "failed" };
    }
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    bitmap.close();

    const blob = await canvasToBlob(canvas);
    if (blob === null || blob.size === 0) return { ...base, skipped: "failed" };

    /* ⚠️ ใช้ผลลัพธ์เฉพาะเมื่อ "เล็กลงจริง" เท่านั้น */
    if (blob.size >= file.size) return { ...base, skipped: "not-smaller" };

    return {
      file: new File([blob], webpFilename(file.name), { type: "image/webp", lastModified: file.lastModified }),
      shrunken: true,
      originalBytes: file.size,
      bytes: blob.size,
      skipped: null,
    };
  } catch {
    return { ...base, skipped: "failed" };
  }
}

/** ข้อความสั้นสำหรับบอกผู้ใช้ว่าลดไปเท่าไร (แสดงเฉพาะเมื่อย่อจริง) */
export function shrinkSummary(outcome: ShrinkOutcome): string | null {
  if (!outcome.shrunken) return null;
  const before = Math.round(outcome.originalBytes / 1024);
  const after = Math.round(outcome.bytes / 1024);
  return `${before} KB → ${after} KB`;
}

/* ── ครอปกลางภาพให้ได้สัดส่วนที่ต้องการ ก่อนอัปโหลด (รอบที่ 168) ───────────────────
 *
 * ใช้กับ "ช่องภาพของป้ายประกาศ" (3:1) เพราะกรอบป้ายถูกล็อก 3:1 ไปแล้ว (รอบที่ 166)
 * ⇒ ถ้าเก็บไฟล์สัดส่วนอื่นไว้ ภาพจะถูก CSS ครอปทิ้งอยู่ดี ⇒ ครอปจริงตั้งแต่ต้นทาง
 *    ทำให้ "สิ่งที่เก็บ = สิ่งที่เห็น" และไฟล์เล็กลงโดยไม่ต้องมี dependency เพิ่ม
 *
 * ⚠️ หลักการเดียวกับ shrinkImageFile: **ไม่มีทางโยน error** — ล้มเหลว = คืนไฟล์เดิม
 */

/** คลาดเคลื่อนที่ยังถือว่า "สัดส่วนตรง" (2%) — ภาพ 2999×1000 ก็นับว่า 3:1 */
export const ASPECT_TOLERANCE = 0.02;

export type CropRect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

/** สัดส่วนต่างจากเป้าหมายเกิน tolerance ไหม (ตรรกะล้วน) */
export function isAspectMismatch(width: number, height: number, aspect: number, tolerance = ASPECT_TOLERANCE): boolean {
  if (!Number.isFinite(width) || !Number.isFinite(height) || !Number.isFinite(aspect)) return false;
  if (width <= 0 || height <= 0 || aspect <= 0) return false;
  return Math.abs(width / height - aspect) / aspect > tolerance;
}

/**
 * กรอบครอป "กลางภาพ" ที่ใหญ่ที่สุดสำหรับสัดส่วนที่ต้องการ (ตรรกะล้วน — ทดสอบได้)
 * ไม่มีอะไรต้องครอป (สัดส่วนตรงอยู่แล้ว) = คืนกรอบเต็มภาพ
 * ค่าเข้าไม่ถูกต้อง = คืน `null` (ผู้เรียกจะถอยไปใช้ไฟล์เดิม)
 */
export function centerCropRect(width: number, height: number, aspect: number): CropRect | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || !Number.isFinite(aspect)) return null;
  if (width <= 0 || height <= 0 || aspect <= 0) return null;

  const full = { x: 0, y: 0, width: Math.round(width), height: Math.round(height) };
  if (!isAspectMismatch(width, height, aspect)) return full;

  const current = width / height;
  if (current > aspect) {
    const cropWidth = Math.max(1, Math.round(height * aspect));
    return { x: Math.max(0, Math.round((width - cropWidth) / 2)), y: 0, width: cropWidth, height: full.height };
  }
  const cropHeight = Math.max(1, Math.round(width / aspect));
  return { x: 0, y: Math.max(0, Math.round((height - cropHeight) / 2)), width: full.width, height: cropHeight };
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y > 0) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x;
}

/** ป้ายสัดส่วนแบบอ่านง่ายสำหรับผู้ใช้ เช่น 1600×900 → "16:9" · 1234×987 → "1.25:1" */
export function ratioLabel(width: number, height: number): string {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return "";
  const w = Math.round(width);
  const h = Math.round(height);
  const divisor = gcd(w, h);
  if (divisor <= 0) return `${String(w)}:${String(h)}`;
  const left = w / divisor;
  const right = h / divisor;
  if (left > 40 || right > 40) return `${(w / h).toFixed(2)}:1`;
  return `${String(left)}:${String(right)}`;
}

export type CropOutcome = ShrinkOutcome & {
  /** ครอปจริงหรือไม่ (สัดส่วนเดิมไม่ตรง และประมวลผลสำเร็จ) */
  readonly cropped: boolean;
  /** ต้นฉบับเป็นสัดส่วนอื่นอยู่แล้ว (ใช้เตือนผู้ใช้เมื่อครอปไม่ได้) */
  readonly aspectMismatch: boolean;
  /** ป้ายสัดส่วนของต้นฉบับ เช่น "16:9" (ว่าง = อ่านไม่ได้) */
  readonly sourceAspectLabel: string;
};

/**
 * ครอปกลางภาพเป็นสัดส่วนที่ต้องการ + ย่อ/แปลง WebP — ใช้จาก client component เท่านั้น
 *
 * - **สัดส่วนไม่ตรง** ⇒ ใช้ไฟล์ที่ครอปเสมอ (เป้าหมายคือให้สัดส่วนถูก)
 * - **สัดส่วนตรงอยู่แล้ว** ⇒ ใช้ไฟล์ใหม่เฉพาะเมื่อเล็กลง (พฤติกรรมเดียวกับ shrinkImageFile)
 * - ล้มเหลว/เบราว์เซอร์เก่า ⇒ คืนไฟล์เดิม (ผู้ใช้ยังอัปโหลดได้ · CSS จะครอปให้ตอนแสดงผล)
 */
export async function cropImageFile(file: File, aspect: number, maxEdge = MAX_UPLOAD_EDGE): Promise<CropOutcome> {
  const base: CropOutcome = {
    file,
    shrunken: false,
    originalBytes: file.size,
    bytes: file.size,
    skipped: null,
    cropped: false,
    aspectMismatch: false,
    sourceAspectLabel: "",
  };

  if (typeof document === "undefined" || typeof createImageBitmap !== "function" || !Number.isFinite(aspect) || aspect <= 0) {
    return { ...base, skipped: "failed" };
  }

  try {
    const bitmap = await createImageBitmap(file);
    const sourceWidth = bitmap.width;
    const sourceHeight = bitmap.height;
    const aspectMismatch = isAspectMismatch(sourceWidth, sourceHeight, aspect);
    const label = ratioLabel(sourceWidth, sourceHeight);
    const rect = centerCropRect(sourceWidth, sourceHeight, aspect);
    if (rect === null) {
      bitmap.close();
      return { ...base, skipped: "failed", aspectMismatch, sourceAspectLabel: label };
    }

    const target = scaleToFit(rect.width, rect.height, maxEdge);
    const canvas = document.createElement("canvas");
    canvas.width = target.width;
    canvas.height = target.height;
    const context = canvas.getContext("2d");
    if (context === null || target.width === 0) {
      bitmap.close();
      return { ...base, skipped: "failed", aspectMismatch, sourceAspectLabel: label };
    }
    context.drawImage(bitmap, rect.x, rect.y, rect.width, rect.height, 0, 0, target.width, target.height);
    bitmap.close();

    const blob = await canvasToBlob(canvas);
    if (blob === null || blob.size === 0) {
      return { ...base, skipped: "failed", aspectMismatch, sourceAspectLabel: label };
    }

    /* สัดส่วนตรงอยู่แล้ว + ไฟล์ใหม่ไม่เล็กลง = ไม่คุ้มเสี่ยง ⇒ ใช้ไฟล์เดิม */
    if (!aspectMismatch && blob.size >= file.size) {
      return { ...base, skipped: "not-smaller", aspectMismatch, sourceAspectLabel: label };
    }

    return {
      file: new File([blob], webpFilename(file.name), { type: "image/webp", lastModified: file.lastModified }),
      shrunken: blob.size < file.size,
      originalBytes: file.size,
      bytes: blob.size,
      skipped: null,
      cropped: aspectMismatch,
      aspectMismatch,
      sourceAspectLabel: label,
    };
  } catch {
    return { ...base, skipped: "failed" };
  }
}
