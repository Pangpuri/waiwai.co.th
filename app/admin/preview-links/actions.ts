"use server";

import { revalidatePath } from "next/cache";

import type { PreviewLinkActionState } from "@/features/admin/preview-link-state";
import { requireAdminUser } from "@/lib/auth/dal";
import { isDatabaseConfigured } from "@/lib/content/repository";
import { isLocale } from "@/lib/i18n/config";
import { isPreviewablePage } from "@/lib/pages/paths";
import { previewLinkPath } from "@/lib/preview-link/plan";
import { createPreviewLink, revokePreviewLink } from "@/lib/preview-link/repository";

/**
 * Server Actions ของ "ลิงก์พรีวิวชั่วคราว" (X2.6)
 *
 * กติกาความปลอดภัย
 * - ทุก action เริ่มด้วย `requireAdminUser("<permission>")` (ตรวจสิทธิ์ฝั่งเซิร์ฟเวอร์ ไม่พึ่ง UI)
 * - `page` ต้องอยู่ในรายการที่พรีวิวได้ (`isPreviewablePage`) · `locale` ต้องเป็นภาษาที่รองรับ
 *   ⇒ ยิงค่าอะไรเข้ามาก็สร้างลิงก์ให้เฉพาะหน้าที่อนุญาต
 * - **โทเคนดิบคืนกลับไปแค่ครั้งเดียว** (พาธเท่านั้น) · ไม่บันทึกลง audit log
 */

const PAGE_PATH = "/admin/preview-links";

/** สร้างลิงก์ใหม่ — คืนพาธพรีวิวให้หน้าจอแสดง "ครั้งเดียว" */
export async function createPreviewLinkAction(
  _previous: PreviewLinkActionState,
  formData: FormData,
): Promise<PreviewLinkActionState> {
  const user = await requireAdminUser("preview");
  if (!isDatabaseConfigured()) return { status: "failed", code: "no-database", path: null };

  const page = String(formData.get("page") ?? "").trim();
  const locale = String(formData.get("locale") ?? "").trim();
  if (!isPreviewablePage(page) || !isLocale(locale)) return { status: "failed", code: "invalid", path: null };

  const created = await createPreviewLink({ page, actorEmail: user.email });
  if (!created.ok) {
    return { status: "failed", code: created.reason === "too-many" ? "too-many" : "no-database", path: null };
  }

  revalidatePath(PAGE_PATH);
  return { status: "ok", code: "created", path: previewLinkPath(locale, created.token) };
}

/** ยกเลิกลิงก์ (ใช้ id — โทเคนดิบแสดงซ้ำไม่ได้) ⇒ ลิงก์ใช้ไม่ได้ทันที */
export async function revokePreviewLinkAction(
  _previous: PreviewLinkActionState,
  formData: FormData,
): Promise<PreviewLinkActionState> {
  const user = await requireAdminUser("preview");
  if (!isDatabaseConfigured()) return { status: "failed", code: "no-database", path: null };

  const id = String(formData.get("id") ?? "").trim();
  if (id === "") return { status: "failed", code: "invalid", path: null };

  const revoked = await revokePreviewLink(id, user.email);
  if (!revoked) return { status: "failed", code: "missing", path: null };

  revalidatePath(PAGE_PATH);
  return { status: "ok", code: "revoked", path: null };
}
