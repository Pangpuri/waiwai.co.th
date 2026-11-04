"use server";

import { revalidatePath } from "next/cache";

import type { PreviewLinkActionState } from "@/features/admin/preview-link-state";
import { requireAdminUser } from "@/lib/auth/dal";
import { isDatabaseConfigured } from "@/lib/content/repository";
import { isLocale } from "@/lib/i18n/config";
import { isPreviewablePage } from "@/lib/pages/paths";
import { previewLinkPath } from "@/lib/preview-link/plan";
import {
  createPreviewLink,
  deleteClosedPreviewLink,
  deleteClosedPreviewLinks,
  revokePreviewLink,
} from "@/lib/preview-link/repository";

/**
 * Server Actions ของ "ลิงก์พรีวิวชั่วคราว" (X2.6)
 *
 * กติกาความปลอดภัย
 * - ทุก action เริ่มด้วย `requireAdminUser("preview")` (ตรวจสิทธิ์ฝั่งเซิร์ฟเวอร์ ไม่พึ่ง UI)
 * - `page` ต้องอยู่ในรายการที่พรีวิวได้ (`isPreviewablePage`) · `locale` ต้องเป็นภาษาที่รองรับ
 *   ⇒ ยิงค่าอะไรเข้ามาก็สร้างลิงก์ให้เฉพาะหน้าที่อนุญาต
 * - **โทเคนดิบคืนกลับไปแค่ครั้งเดียว** (พาธเท่านั้น) · ไม่บันทึกลง audit log
 * - การลบทำได้เฉพาะลิงก์ที่ **ปิดแล้ว** (หมดอายุ/ยกเลิก) — ด่านจริงอยู่ที่ SQL ใน repository
 */

const PAGE_PATH = "/admin/preview-links";

/** สร้างลิงก์ใหม่ — คืนพาธพรีวิวให้หน้าจอแสดง "ครั้งเดียว" */
export async function createPreviewLinkAction(
  _previous: PreviewLinkActionState,
  formData: FormData,
): Promise<PreviewLinkActionState> {
  const user = await requireAdminUser("preview");
  if (!isDatabaseConfigured()) return { status: "failed", code: "no-database", path: null, deleted: null };

  const page = String(formData.get("page") ?? "").trim();
  const locale = String(formData.get("locale") ?? "").trim();
  if (!isPreviewablePage(page) || !isLocale(locale)) return { status: "failed", code: "invalid", path: null, deleted: null };

  const created = await createPreviewLink({ page, actorEmail: user.email });
  if (!created.ok) {
    return { status: "failed", code: created.reason === "too-many" ? "too-many" : "no-database", path: null, deleted: null };
  }

  revalidatePath(PAGE_PATH);
  return { status: "ok", code: "created", path: previewLinkPath(locale, created.token), deleted: null };
}

/** ยกเลิกลิงก์ (ใช้ id — โทเคนดิบแสดงซ้ำไม่ได้) ⇒ ลิงก์ใช้ไม่ได้ทันที */
export async function revokePreviewLinkAction(
  _previous: PreviewLinkActionState,
  formData: FormData,
): Promise<PreviewLinkActionState> {
  const user = await requireAdminUser("preview");
  if (!isDatabaseConfigured()) return { status: "failed", code: "no-database", path: null, deleted: null };

  const id = String(formData.get("id") ?? "").trim();
  if (id === "") return { status: "failed", code: "invalid", path: null, deleted: null };

  const revoked = await revokePreviewLink(id, user.email);
  if (!revoked) return { status: "failed", code: "missing", path: null, deleted: null };

  revalidatePath(PAGE_PATH);
  return { status: "ok", code: "revoked", path: null, deleted: null };
}

/** ลบลิงก์ที่ปิดแล้วทีละรายการ — ลิงก์ที่ยังใช้ได้จะลบไม่ได้ (SQL บังคับ) */
export async function deletePreviewLinkAction(
  _previous: PreviewLinkActionState,
  formData: FormData,
): Promise<PreviewLinkActionState> {
  const user = await requireAdminUser("preview");
  if (!isDatabaseConfigured()) return { status: "failed", code: "no-database", path: null, deleted: null };

  const id = String(formData.get("id") ?? "").trim();
  if (id === "") return { status: "failed", code: "invalid", path: null, deleted: null };

  const deleted = await deleteClosedPreviewLink(id, user.email);
  if (!deleted) return { status: "failed", code: "not-closed", path: null, deleted: null };

  revalidatePath(PAGE_PATH);
  return { status: "ok", code: "deleted", path: null, deleted: null };
}

/**
 * ลบลิงก์ที่ปิดแล้วทั้งหมดด้วยมือ (ไม่รอครบอายุเก็บอัตโนมัติ)
 * ⚠️ ต้องติ๊กยืนยัน — ด่านจริงอยู่ที่ฝั่งเซิร์ฟเวอร์ ไม่ใช่แค่ disabled ของปุ่ม
 */
export async function deleteClosedPreviewLinksAction(
  _previous: PreviewLinkActionState,
  formData: FormData,
): Promise<PreviewLinkActionState> {
  const user = await requireAdminUser("preview");
  if (!isDatabaseConfigured()) return { status: "failed", code: "no-database", path: null, deleted: null };

  if (formData.get("confirm") !== "yes") {
    return { status: "failed", code: "confirm-required", path: null, deleted: null };
  }

  const deleted = await deleteClosedPreviewLinks(user.email);
  revalidatePath(PAGE_PATH);
  return { status: "ok", code: "deleted-many", path: null, deleted };
}
