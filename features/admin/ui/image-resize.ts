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
