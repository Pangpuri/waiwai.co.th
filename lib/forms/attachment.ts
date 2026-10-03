/**
 * ตรวจไฟล์แนบของผู้สมัคร (เรซูเม่) — **บริสุทธิ์ ทดสอบได้ ไม่ต้องมี Next/DB**
 *
 * หลักการเดียวกับรูปภาพ (`lib/media/image-info.ts`)
 * - **ตรวจจากไบต์หัวไฟล์ (magic bytes) ไม่ใช่จากนามสกุล** — นามสกุลปลอมได้ง่าย
 * - ปฏิเสธไฟล์ที่ไม่รู้จัก ⇒ ไม่มีทางฝากไฟล์แปลกปลอมเข้าฐานข้อมูล
 * - ไม่เก็บไฟล์ที่ใหญ่เกินเพดาน
 * - ชื่อไฟล์ที่เก็บต้องเป็น ASCII ปลอดภัย (กัน header injection ตอนดาวน์โหลด)
 */

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

export type AttachmentInfo = {
  /** MIME ที่เรายอมรับ (ตรวจจากไบต์จริง) */
  readonly mime: string;
  readonly extension: string;
};

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((value, index) => bytes[offset + index] === value);
}

function includesAscii(bytes: Uint8Array, needle: string, limit: number): boolean {
  const target = needle.split("").map((char) => char.charCodeAt(0));
  const end = Math.min(bytes.length, limit);
  for (let start = 0; start + target.length <= end; start += 1) {
    if (target.every((value, index) => bytes[start + index] === value)) return true;
  }
  return false;
}

/**
 * อ่านชนิดไฟล์จากไบต์
 * รองรับ: PDF · Word (.doc, OLE2) · Word (.docx, ZIP ที่มีโฟลเดอร์ word/) · ข้อความล้วน
 */
export function readAttachmentInfo(bytes: Uint8Array): AttachmentInfo | null {
  if (bytes.length === 0) return null;

  /* %PDF */
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return { mime: "application/pdf", extension: "pdf" };

  /* OLE2 (doc/xls/ppt รุ่นเก่า) — D0 CF 11 E0 A1 B1 1A E1 */
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    return { mime: "application/msword", extension: "doc" };
  }

  /* ZIP (docx/xlsx/pptx) — ต้องเจอชื่อโฟลเดอร์ของ Word จึงถือเป็น .docx */
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) || startsWith(bytes, [0x50, 0x4b, 0x05, 0x06])) {
    if (includesAscii(bytes, "word/", 8192)) {
      return { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", extension: "docx" };
    }
    return null;
  }

  /* ข้อความล้วน: ไม่มีอักขระศูนย์ในไบต์แรก ๆ */
  const sample = bytes.subarray(0, Math.min(bytes.length, 512));
  const looksText = sample.every((byte) => byte === 0x09 || byte === 0x0a || byte === 0x0d || (byte >= 0x20 && byte !== 0x7f));
  if (looksText) return { mime: "text/plain", extension: "txt" };

  return null;
}

export function isAttachmentAllowed(mime: string): boolean {
  return (
    mime === "application/pdf" ||
    mime === "application/msword" ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mime === "text/plain"
  );
}

/**
 * ทำชื่อไฟล์ให้ปลอดภัยสำหรับเก็บและส่งกลับ
 * - เหลือเฉพาะ a-z 0-9 . _ - (ไม่ให้มีอักขระควบคุม/เครื่องหมายที่ทำให้ HTTP header เพี้ยน)
 * - ถ้าชื่อเดิมเป็นภาษาไทยทั้งหมด จะกลายเป็นค่าว่าง ⇒ ใช้ชื่อสำรองจากชนิดไฟล์
 */
export function safeAttachmentName(originalName: string, extension: string): string {
  const base = originalName.split(/[\\/]/).pop() ?? "";
  const dotIndex = base.lastIndexOf(".");
  const stem = dotIndex > 0 ? base.slice(0, dotIndex) : base;
  const cleaned = stem
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 60);

  const safeStem = cleaned === "" ? "attachment" : cleaned;
  return `${safeStem}.${extension}`;
}

/* ขนาดไฟล์อ่านง่าย — ย้ายไป lib/format/bytes.ts แล้ว (ใช้ร่วมกับคลังภาพ) */
export { formatBytes } from "@/lib/format/bytes";
