/**
 * อ่านข้อมูลภาพจาก "หัวไฟล์" เอง (PNG/JPEG/WebP) — ตรรกะล้วน ทดสอบได้
 *
 * ทำไมไม่เชื่อเบราว์เซอร์
 * - `File.type` มาจากผู้ใช้ แก้ได้ → ถ้าเชื่อแล้วเสิร์ฟกลับ อาจกลายเป็นช่องโหว่ (เช่น อัปโหลด HTML/SVG ที่รันสคริปต์ได้)
 * - การตรวจ magic bytes เป็นวิธีที่ป้องกันได้จริงในระดับหนึ่ง และทำให้ไฟล์ที่เก็บเป็นภาพจริงแน่นอน
 * - ขนาดภาพ (width/height) อ่านจากหัวไฟล์เอง → ใช้ตั้งสัดส่วนภาพในหน้าเว็บโดยไม่ต้องรอโหลดภาพ
 */

export const ALLOWED_IMAGE_MIMES = ["image/png", "image/jpeg", "image/webp"] as const;
export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIMES)[number];

/** เพดานขนาดไฟล์อัปโหลด (มติ Q11: 5MB) */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export type ImageInfo = {
  readonly mime: AllowedImageMime;
  readonly width: number | null;
  readonly height: number | null;
};

function isAllowed(mime: string): mime is AllowedImageMime {
  return (ALLOWED_IMAGE_MIMES as readonly string[]).includes(mime);
}

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  for (let index = 0; index < signature.length; index += 1) {
    if (bytes[offset + index] !== signature[index]) return false;
  }
  return true;
}

function readUint16BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    (((bytes[offset] ?? 0) << 24) >>> 0) +
    ((bytes[offset + 1] ?? 0) << 16) +
    ((bytes[offset + 2] ?? 0) << 8) +
    (bytes[offset + 3] ?? 0)
  );
}

function readUint16LE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
}

function readUint24LE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8) | ((bytes[offset + 2] ?? 0) << 16);
}

/** PNG: magic 8 ไบต์ + IHDR ที่ offset 16 (width/height big-endian) */
function readPng(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  if (!startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return null;
  return { width: readUint32BE(bytes, 16), height: readUint32BE(bytes, 20) };
}

/** JPEG: เดินหา marker SOF0-SOF3/SOF5-SOF15 แล้วอ่าน height/width */
function readJpeg(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 4) return null;
  if (!startsWith(bytes, [0xff, 0xd8, 0xff])) return null;

  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1] ?? 0;
    /* marker ที่ไม่มีข้อมูลความยาว */
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return null;

    const length = readUint16BE(bytes, offset + 2);
    if (length < 2) return null;

    const isSof =
      (marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf);
    if (isSof) {
      return { height: readUint16BE(bytes, offset + 5), width: readUint16BE(bytes, offset + 7) };
    }

    offset += 2 + length;
  }

  return null;
}

/** WebP: VP8X (ขยาย), VP8L (lossless), VP8 (lossy) */
function readWebp(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 30) return null;
  if (!startsWith(bytes, [0x52, 0x49, 0x46, 0x46])) return null;
  if (!startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return null;

  const chunk = String.fromCharCode(bytes[12] ?? 0, bytes[13] ?? 0, bytes[14] ?? 0, bytes[15] ?? 0);

  if (chunk === "VP8X") {
    const width = readUint24LE(bytes, 24) + 1;
    const height = readUint24LE(bytes, 27) + 1;
    return { width, height };
  }

  if (chunk === "VP8L") {
    const b0 = bytes[21] ?? 0;
    const b1 = bytes[22] ?? 0;
    const b2 = bytes[23] ?? 0;
    const b3 = bytes[24] ?? 0;
    return { width: ((b1 & 0x3f) << 8 | b0) + 1, height: ((b3 & 0x0f) << 10 | b2 << 2 | (b1 & 0xc0) >> 6) + 1 };
  }

  if (chunk === "VP8 ") {
    if (!startsWith(bytes, [0x9d, 0x01, 0x2a], 23)) return null;
    return { width: readUint16LE(bytes, 26) & 0x3fff, height: readUint16LE(bytes, 28) & 0x3fff };
  }

  return null;
}

/**
 * ตรวจชนิดภาพจากหัวไฟล์ + อ่านขนาด
 * คืน null เมื่อไม่ใช่ภาพที่อนุญาต (ผู้เรียกต้องปฏิเสธการอัปโหลด)
 */
export function readImageInfo(bytes: Uint8Array): ImageInfo | null {
  const png = readPng(bytes);
  if (png !== null && isAllowed("image/png")) {
    return { mime: "image/png", width: png.width > 0 ? png.width : null, height: png.height > 0 ? png.height : null };
  }

  const jpeg = readJpeg(bytes);
  if (jpeg !== null) {
    return { mime: "image/jpeg", width: jpeg.width > 0 ? jpeg.width : null, height: jpeg.height > 0 ? jpeg.height : null };
  }

  const webp = readWebp(bytes);
  if (webp !== null) {
    return { mime: "image/webp", width: webp.width > 0 ? webp.width : null, height: webp.height > 0 ? webp.height : null };
  }

  return null;
}

/** นามสกุลที่ปลอดภัยสำหรับตั้งชื่อไฟล์สำรอง */
export function extensionFor(mime: AllowedImageMime): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

/** ล้างชื่อไฟล์ที่ผู้ใช้ส่งมา (ใช้แสดงผล/ดาวน์โหลดเท่านั้น) */
export function safeFilename(name: string, fallback: string): string {
  const cleaned = name
    .replace(/[\\/]/g, "-")
    .replace(/[\u0000-\u001f]/g, "")
    .trim()
    .slice(0, 120);
  return cleaned === "" ? fallback : cleaned;
}
