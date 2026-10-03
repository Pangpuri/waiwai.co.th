"use server";

import { revalidatePath } from "next/cache";

import { recordAudit } from "@/lib/audit/log";
import { requireAdminUser } from "@/lib/auth/dal";
import { MAX_UPLOAD_BYTES, readImageInfo, type AllowedImageMime } from "@/lib/media/image-info";
import { findMediaUsage, listMedia, replaceMediaData, updateMediaAlt } from "@/lib/media/repository";
import { storeImageFile } from "@/lib/media/upload";
import { trashMedia } from "@/lib/trash/repository";

/**
 * Server Actions ของ "คลังภาพ" (X1.2)
 *
 * กฎสำคัญ: **ห้ามลบภาพที่ยังถูกใช้** — ตรวจก่อนลบทุกครั้ง และถ้าถูกใช้จะไม่ลบ + แจ้งว่าใช้ที่ไหน
 * (เหตุผล: หน้าเว็บจะพังทันทีถ้าลบภาพที่ยังอ้างถึง — บทเรียนจากเอกสารอ้างอิง เฟส 4.6)
 *
 * ⚠️ X2.4 (รอบที่ 78): "ลบ" ไม่ใช่ลบถาวรอีกต่อไป — **ย้ายเข้าถังขยะ** (`trashMedia`)
 * แล้วตัวลบตามกำหนดจึงลบถาวรเมื่อพ้นระยะเก็บ ⇒ เผลอกดลบกู้คืนได้จาก `/admin/trash`
 */

const MEDIA_PATH = "/admin/media";
/** หน้าถังขยะ — ต้อง revalidate ด้วยทุกครั้งที่ของย้ายเข้า/ออก (ทั้งสองหน้าอ่าน DB เดียวกัน) */
const TRASH_PATH = "/admin/trash";

export type MediaActionState = {
  readonly status: "idle" | "ok" | "blocked" | "invalid" | "failed";
  readonly message: readonly string[];
};

async function readUpload(formData: FormData, field: string): Promise<
  | { readonly ok: true; readonly mime: AllowedImageMime; readonly size: number; readonly width: number | null; readonly height: number | null; readonly data: Uint8Array }
  | { readonly ok: false; readonly reason: "missing" | "too-large" | "bad-type" }
> {
  const file = formData.get(field);
  if (!(file instanceof File) || file.size === 0) return { ok: false, reason: "missing" };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, reason: "too-large" };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const info = readImageInfo(bytes);
  if (info === null) return { ok: false, reason: "bad-type" };

  return { ok: true, mime: info.mime, size: file.size, width: info.width, height: info.height, data: bytes };
}

export async function updateMediaAltAction(formData: FormData): Promise<void> {
  await requireAdminUser();

  const id = String(formData.get("id") ?? "").trim();
  if (id === "") return;

  const altTh = String(formData.get("altTh") ?? "").trim().slice(0, 300);
  const altEn = String(formData.get("altEn") ?? "").trim().slice(0, 300);
  /* คำอธิบายภาพภาษาไทยบังคับ (a11y) — เว้นว่างไม่รับ */
  if (altTh === "") return;

  await updateMediaAlt(id, altTh, altEn);
  revalidatePath(MEDIA_PATH);
}

/**
 * "ลบ" ภาพ = **ย้ายเข้าถังขยะ** (X2.4) · ยังไม่ลบถาวร
 * ⇒ กู้คืนได้จาก `/admin/trash` จนพ้นระยะเก็บ · audit บันทึกใน `lib/trash/repository.ts` แล้ว
 */
export async function deleteMediaAction(_previous: MediaActionState, formData: FormData): Promise<MediaActionState> {
  const user = await requireAdminUser();

  const id = String(formData.get("id") ?? "").trim();
  if (id === "") return { status: "invalid", message: ["missing-id"] };

  const usage = await findMediaUsage(id);
  if (usage.length > 0) {
    /* ไม่ลบ + บอกว่าใช้ที่ไหน (ผู้ใช้จะได้ไปเอาออกก่อน) */
    return { status: "blocked", message: usage.map((entry) => `${entry.kind}:${entry.target}`) };
  }

  const moved = await trashMedia(id, user.email);
  if (!moved) return { status: "failed", message: ["not-found"] };

  revalidatePath(MEDIA_PATH);
  revalidatePath(TRASH_PATH);
  return { status: "ok", message: ["trashed"] };
}

/** แทนไฟล์เดิม (คีย์เดิม) — พาธไม่เปลี่ยน ทุกที่ที่ใช้อยู่ได้รูปใหม่ทันที */
export async function replaceMediaAction(_previous: MediaActionState, formData: FormData): Promise<MediaActionState> {
  const user = await requireAdminUser();

  const id = String(formData.get("id") ?? "").trim();
  if (id === "") return { status: "invalid", message: ["missing-id"] };

  const file = await readUpload(formData, "file");
  if (!file.ok) return { status: "invalid", message: [file.reason] };

  const replaced = await replaceMediaData(id, {
    mime: file.mime,
    sizeBytes: file.size,
    width: file.width,
    height: file.height,
    data: file.data,
  });
  if (!replaced) return { status: "failed", message: ["not-found"] };

  await recordAudit({ action: "pages-update", actorEmail: user.email, target: `media:${id}`, detail: "replaced" });
  revalidatePath(MEDIA_PATH);
  return { status: "ok", message: ["replaced"] };
}

/** อัปโหลดจากหน้าคลังภาพ (ใช้ตัวช่วยกลาง `storeImageFile` ตัวเดียวกับที่อื่น) */
export async function uploadFromLibraryAction(_previous: MediaActionState, formData: FormData): Promise<MediaActionState> {
  const user = await requireAdminUser();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { status: "invalid", message: ["missing"] };

  const stored = await storeImageFile(file, user.email);
  if (!stored.ok) return { status: "invalid", message: [stored.reason] };

  revalidatePath(MEDIA_PATH);
  return { status: "ok", message: [stored.path] };
}

/** ใช้ในหน้าจอ: นับภาพที่ยังไม่ถูกใช้ (สำหรับแสดงสถิติ) */
export async function countUnusedMedia(limit = 100): Promise<number> {
  const items = await listMedia(limit);
  let unused = 0;
  for (const item of items) {
    const usage = await findMediaUsage(item.id);
    if (usage.length === 0) unused += 1;
  }
  return unused;
}
