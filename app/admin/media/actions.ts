"use server";

import { type UploadState } from "@/features/admin/upload-state";
import { requireAdminUser } from "@/lib/auth/dal";
import { isDatabaseConfigured } from "@/lib/content/repository";
import { storeImageFile } from "@/lib/media/upload";

/**
 * อัปโหลดภาพเข้าคลังภาพ (เรียกจากปุ่มเลือกไฟล์ **หรือการลากวาง**)
 *
 * ตรรกะทั้งหมดอยู่ใน `lib/media/upload.ts` (ใช้ร่วมกันหลายหน้าจอ — แก้ที่เดียว)
 * ที่นี่เหลือแค่: ตรวจสิทธิ์ → ตรวจว่ามีฐานข้อมูล → เรียกตัวกลาง → แปลงผลเป็น UploadState
 */

function failure(reason: UploadState["reason"]): UploadState {
  return { status: "error", path: null, filename: null, width: null, height: null, reason };
}

export async function uploadImageAction(_previous: UploadState, formData: FormData): Promise<UploadState> {
  const user = await requireAdminUser("media");

  if (!isDatabaseConfigured()) return failure("database");

  const file = formData.get("file");
  if (!(file instanceof File)) return failure("no-file");

  const stored = await storeImageFile(file, user.email);
  if (!stored.ok) return failure(stored.reason);

  return {
    status: "ok",
    path: stored.path,
    filename: stored.filename,
    width: stored.width,
    height: stored.height,
    reason: null,
  };
}
