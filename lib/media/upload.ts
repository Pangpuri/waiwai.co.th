import { MAX_UPLOAD_BYTES, extensionFor, readImageInfo, safeFilename } from "@/lib/media/image-info";
import { insertMedia, newMediaId } from "@/lib/media/repository";
import type { UploadFailure } from "@/features/admin/upload-state";

/**
 * ตัวกลางสำหรับ "รับภาพเข้าเว็บ" — ใช้ร่วมกันทุกที่ที่อัปโหลดภาพ
 *
 * ลำดับความปลอดภัย (เหมือนกันทุกทางเข้า)
 *   1. ผู้เรียกต้องตรวจสิทธิ์ (`requireAdminUser("<permission>")`) **ก่อน** เรียกฟังก์ชันนี้
 *   2. ตรวจชนิดภาพจาก **หัวไฟล์จริง** (`readImageInfo`) ไม่เชื่อ `File.type` จากเบราว์เซอร์
 *   3. จำกัดขนาด (`MAX_UPLOAD_BYTES` = 5MB)
 *   4. ตัดชื่อไฟล์ด้วย `safeFilename` (กันฝังเส้นทาง/อักขระควบคุม)
 *   5. เก็บลงตาราง `media` แล้วคืน **พาธ** `/media/<id>` (มติ D9: ไม่เก็บ URL เต็ม)
 *
 * ⚠️ ต้องทำงานฝั่งเซิร์ฟเวอร์เท่านั้น (แตะฐานข้อมูลด้วยไดรเวอร์ pg)
 */

export type StoredImage =
  | {
      readonly ok: true;
      readonly path: string;
      readonly filename: string;
      /** อาจเป็น null ได้ ถ้าอ่านขนาดจากหัวไฟล์ไม่สำเร็จ (ผู้ใช้ยังใช้ภาพได้) */
      readonly width: number | null;
      readonly height: number | null;
      readonly altTh: string;
    }
  | { readonly ok: false; readonly reason: UploadFailure };

export async function storeImageFile(file: File, actor: string): Promise<StoredImage> {
  if (file.size === 0) return { ok: false, reason: "empty-file" };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, reason: "too-large" };

  const buffer = Buffer.from(await file.arrayBuffer());

  const info = readImageInfo(new Uint8Array(buffer));
  if (info === null) return { ok: false, reason: "not-image" };

  const id = newMediaId();
  const filename = safeFilename(file.name, `upload.${extensionFor(info.mime)}`);
  const altTh = filename.replace(/\.[a-z0-9]+$/i, "");

  try {
    await insertMedia({
      id,
      filename,
      mime: info.mime,
      sizeBytes: buffer.byteLength,
      width: info.width,
      height: info.height,
      data: buffer,
      /* คำอธิบายภาพเริ่มต้น = ชื่อไฟล์ (ผู้ใช้แก้ทีหลังได้) — ไม่ให้ค้างเพราะยังไม่ได้กรอก alt */
      altTh,
      altEn: "",
      createdBy: actor,
    });
  } catch {
    return { ok: false, reason: "database" };
  }

  return { ok: true, path: `/media/${id}`, filename, width: info.width, height: info.height, altTh };
}
