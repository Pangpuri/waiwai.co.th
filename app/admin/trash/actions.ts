"use server";

import { revalidatePath } from "next/cache";

import { requireAdminUser } from "@/lib/auth/dal";
import { isDatabaseConfigured } from "@/lib/content/repository";
import {
  deleteContentTrashItemPermanently,
  emptyContentTrash,
  purgeExpiredContentTrash,
  restoreContentTrashItem,
} from "@/lib/trash/content";
import { isTrashKind, isTrashViewKind, isHeroTrashKind } from "@/lib/trash/plan";
import {
  deleteHeroTrashItemPermanently,
  emptyHeroTrash,
  purgeExpiredHeroTrash,
  restoreHeroTrashItem,
} from "@/lib/trash/hero";
import {
  deleteTrashItemPermanently,
  emptyTrash,
  purgeExpiredTrash,
  restoreTrashItem,
} from "@/lib/trash/repository";
import type { TrashActionState } from "@/features/admin/trash-state";

/**
 * Server Actions ของ "ถังขยะ" (X2.4 · ขยายรอบที่ 176 · 237)
 *
 * กติกาความปลอดภัย
 * - ทุก action เริ่มด้วย `requireAdminUser("<permission>")` เสมอ (ตรวจสิทธิ์ฝั่งเซิร์ฟเวอร์ ไม่พึ่ง UI)
 * - `kind` จากฟอร์ม **ต้องผ่าน `isTrashViewKind()` ก่อน** (ครอบภาพ/พรีเซ็ต · เนื้อหา · สไลด์)
 *   - ค่าที่ไม่รู้จักจบที่ `invalid` ไม่แตะฐานข้อมูล
 *   - จากนั้น **แยกทาง**: `isTrashKind()` → repository ของถังขยะรวม · `isHeroTrashKind()` → สไลด์ ·
 *     ที่เหลือ = เนื้อหา → `lib/trash/content.ts`
 *   - ชั้นล่างทุกฝ่ายมีชื่อตารางแบบค่าคงที่ ⇒ ต่อให้หลุดมาก็ไม่กลายเป็น SQL
 * - การลบถาวรทำได้เฉพาะของที่ **อยู่ในถังแล้ว** (เงื่อนไขอยู่ใน SQL ของ repository/content/hero)
 * - `revalidatePath` ทั้งหน้าถังขยะและหน้าต้นทาง เพราะทั้งคู่แสดงข้อมูลชุดเดียวกัน
 *   (รอบที่ 176: ของเนื้อหาที่กู้คืน/ลบจากตารางรวมต้องหายจากแท็บถังขยะของจอนั้นด้วย
 *    รอบที่ 237: สไลด์ต้องหายจากหน้า `/admin/hero` ด้วย)
 */

const TRASH_PATH = "/admin/trash";
const MEDIA_PATH = "/admin/media";
/** หน้าจอของเนื้อหา — แท็บ "ถังขยะ" ของแต่ละจอแสดงรายการชุดเดียวกับตารางรวม */
const CONTENT_PATHS: readonly string[] = ["/admin/products", "/admin/recipes", "/admin/news"];
/** หน้าจอของสไลด์ — มีส่วนถังขยะในหน้าเดียว (รอบที่ 237) */
const HERO_PATH = "/admin/hero";

function revalidateTrash(): void {
  revalidatePath(TRASH_PATH);
  revalidatePath(MEDIA_PATH);
  revalidatePath("/admin/builder/home");
  revalidatePath(HERO_PATH);
  for (const path of CONTENT_PATHS) revalidatePath(path);
}

/** กู้คืนของจากถัง (ภาพ/พรีเซ็ต · สไลด์ · เนื้อหา) — กลับมาใช้งานตามเดิม */
export async function restoreTrashAction(_previous: TrashActionState, formData: FormData): Promise<TrashActionState> {
  const user = await requireAdminUser("trash");
  if (!isDatabaseConfigured()) return { status: "failed", code: "db-missing", count: null };

  const kind = String(formData.get("kind") ?? "").trim();
  const id = String(formData.get("id") ?? "").trim();
  if (!isTrashViewKind(kind) || id === "") return { status: "failed", code: "invalid", count: null };

  /* แยกสามทางตามชนิด — ตัวตรวจรวมรับทั้งสามชุด แต่ละฝ่ายมีประตู SQL ของตัวเอง (รอบที่ 237) */
  const restored = isTrashKind(kind)
    ? await restoreTrashItem(kind, id, user.email)
    : isHeroTrashKind(kind)
      ? await restoreHeroTrashItem(id, user.email)
      : await restoreContentTrashItem(kind, id, user.email);
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
  if (!isTrashViewKind(kind) || id === "") return { status: "failed", code: "invalid", count: null };

  const deleted = isTrashKind(kind)
    ? await deleteTrashItemPermanently(kind, id, user.email)
    : isHeroTrashKind(kind)
      ? await deleteHeroTrashItemPermanently(id, user.email)
      : await deleteContentTrashItemPermanently(kind, id, user.email);
  if (!deleted) return { status: "failed", code: "missing", count: null };

  revalidateTrash();
  return { status: "ok", code: "deleted", count: null };
}

/**
 * ลบถาวรทุกอย่างในถัง (ผู้ดูแลสั่งเอง) — **ต้องติ๊กยืนยันก่อน** เพราะกู้คืนไม่ได้
 * รอบที่ 176: ครอบ **เนื้อหาด้วย** · รอบที่ 237: ครอบ **สไลด์** ด้วย (ปุ่มเขียนว่า "ทั้งหมด"
 * ⇒ ต้องไม่เหลือของค้างไว้เงียบ ๆ)
 */
export async function emptyTrashAction(_previous: TrashActionState, formData: FormData): Promise<TrashActionState> {
  const user = await requireAdminUser("trash");
  if (!isDatabaseConfigured()) return { status: "failed", code: "db-missing", count: null };

  /* ด่านยืนยันอยู่ที่เซิร์ฟเวอร์ (ไม่ใช่แค่ติ๊กในหน้าจอ) */
  if (formData.get("confirm") !== "yes") return { status: "failed", code: "invalid", count: null };

  const removedMedia = await emptyTrash(user.email);
  const removedContent = await emptyContentTrash(user.email);
  const removedHero = await emptyHeroTrash(user.email);
  const removed = removedMedia + removedContent + removedHero;

  revalidateTrash();
  return { status: "ok", code: "emptied", count: removed };
}

/**
 * ลบถาวรของที่พ้นระยะเก็บเดี๋ยวนี้ (ไม่รอรอบอัตโนมัติ)
 * ⚠️ รอบอัตโนมัติใช้ `runScheduledPurge()` (กันซ้ำ 24 ชม.) แต่ปุ่มนี้คือ "ผู้ดูแลสั่งเอง" ⇒ ลบเลย
 * ⚠️ ไม่ใช้ `useActionState` ⇒ ไม่มีพารามิเตอร์ state (แบบเดียวกับปุ่มลบตามระยะเก็บบนหน้าภาพรวม)
 * ⚠️ **รอบที่ 237:** เดิมปุ่มนี้ลบเฉพาะภาพ/พรีเซ็ต ทั้งที่เนื้อหา/สไลด์ก็มีวันหมดอายุเหมือนกัน
 *    (ปุ่มเขียนว่า "ของที่พ้นกำหนด" = ต้องครบทุกชนิด) ⇒ ต่อให้ครบทั้งสามฝ่ายแล้ว
 */
export async function purgeTrashNowAction(): Promise<void> {
  await requireAdminUser("trash");
  if (!isDatabaseConfigured()) return;

  await purgeExpiredTrash();
  await purgeExpiredContentTrash();
  await purgeExpiredHeroTrash({ now: new Date() });
  revalidateTrash();
}
