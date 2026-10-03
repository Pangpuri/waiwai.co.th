"use server";

import { revalidatePath } from "next/cache";

import { requireAdminUser } from "@/lib/auth/dal";
import { isDatabaseConfigured } from "@/lib/content/repository";
import { isTrashKind } from "@/lib/trash/plan";
import {
  deleteTrashItemPermanently,
  emptyTrash,
  purgeExpiredTrash,
  restoreTrashItem,
} from "@/lib/trash/repository";
import type { TrashActionState } from "@/features/admin/trash-state";

/**
 * Server Actions ของ "ถังขยะ" (X2.4)
 *
 * กติกาความปลอดภัย
 * - ทุก action เริ่มด้วย `requireAdminUser("<permission>")` เสมอ (ตรวจสิทธิ์ฝั่งเซิร์ฟเวอร์ ไม่พึ่ง UI)
 * - `kind` จากฟอร์ม **ต้องผ่าน `isTrashKind()` ก่อน** — ค่าที่ไม่รู้จักจบที่ `invalid` ไม่แตะฐานข้อมูล
 *   (ชั้นล่างยังมี `TABLES` แบบค่าคงที่ ⇒ ต่อให้หลุดมาก็ไม่กลายเป็น SQL)
 * - การลบถาวรทำได้เฉพาะของที่ **อยู่ในถังแล้ว** (เงื่อนไขอยู่ใน SQL ของ repository)
 * - `revalidatePath` ทั้งหน้าถังขยะและหน้าต้นทาง เพราะทั้งคู่แสดงข้อมูลชุดเดียวกัน
 */

const TRASH_PATH = "/admin/trash";
const MEDIA_PATH = "/admin/media";

function revalidateTrash(): void {
  revalidatePath(TRASH_PATH);
  revalidatePath(MEDIA_PATH);
  revalidatePath("/admin/builder/home");
}

/** กู้คืนของจากถัง (ภาพ/พรีเซ็ตกลับมาใช้งานตามเดิม) */
export async function restoreTrashAction(_previous: TrashActionState, formData: FormData): Promise<TrashActionState> {
  const user = await requireAdminUser("trash");
  if (!isDatabaseConfigured()) return { status: "failed", code: "db-missing", count: null };

  const kind = String(formData.get("kind") ?? "").trim();
  const id = String(formData.get("id") ?? "").trim();
  if (!isTrashKind(kind) || id === "") return { status: "failed", code: "invalid", count: null };

  const restored = await restoreTrashItem(kind, id, user.email);
  if (!restored) return { status: "failed", code: "missing", count: null };

  revalidateTrash();
  return { status: "ok", code: "restored", count: null };
}

/** ลบถาวรทีละรายการ (กู้คืนไม่ได้) */
export async function deleteTrashItemAction(_previous: TrashActionState, formData: FormData): Promise<TrashActionState> {
  const user = await requireAdminUser("trash");
  if (!isDatabaseConfigured()) return { status: "failed", code: "db-missing", count: null };

  const kind = String(formData.get("kind") ?? "").trim();
  const id = String(formData.get("id") ?? "").trim();
  if (!isTrashKind(kind) || id === "") return { status: "failed", code: "invalid", count: null };

  const deleted = await deleteTrashItemPermanently(kind, id, user.email);
  if (!deleted) return { status: "failed", code: "missing", count: null };

  revalidateTrash();
  return { status: "ok", code: "deleted", count: null };
}

/** ลบถาวรทุกอย่างในถัง (ผู้ดูแลสั่งเอง) — **ต้องติ๊กยืนยันก่อน** เพราะกู้คืนไม่ได้ */
export async function emptyTrashAction(_previous: TrashActionState, formData: FormData): Promise<TrashActionState> {
  const user = await requireAdminUser("trash");
  if (!isDatabaseConfigured()) return { status: "failed", code: "db-missing", count: null };

  /* ด่านยืนยันอยู่ที่เซิร์ฟเวอร์ (ไม่ใช่แค่ติ๊กในหน้าจอ) */
  if (formData.get("confirm") !== "yes") return { status: "failed", code: "invalid", count: null };

  const removed = await emptyTrash(user.email);
  revalidateTrash();
  return { status: "ok", code: "emptied", count: removed };
}

/**
 * ลบถาวรของที่พ้นระยะเก็บเดี๋ยวนี้ (ไม่รอรอบอัตโนมัติ)
 * ⚠️ รอบอัตโนมัติใช้ `runScheduledPurge()` (กันซ้ำ 24 ชม.) แต่ปุ่มนี้คือ "ผู้ดูแลสั่งเอง" ⇒ ลบเลย
 * ⚠️ ไม่ใช้ `useActionState` ⇒ ไม่มีพารามิเตอร์ state (แบบเดียวกับปุ่มลบตามระยะเก็บบนหน้าภาพรวม)
 */
export async function purgeTrashNowAction(): Promise<void> {
  await requireAdminUser("trash");
  if (!isDatabaseConfigured()) return;

  await purgeExpiredTrash();
  revalidateTrash();
}
