"use server";

import { revalidatePath } from "next/cache";

import { INITIAL_RECIPE_UPLOAD_STATE, type RecipeSaveState, type RecipeUploadState } from "@/features/admin/recipe-state";
import { recordAudit } from "@/lib/audit/log";
import { requireAdminUser } from "@/lib/auth/dal";
import { revalidateAdminPath, refreshPublicSite } from "@/lib/cache/refresh";
import { isDatabaseConfigured } from "@/db/pool";
import { storeImageFile } from "@/lib/media/upload";
import {
  createRecipeForAdmin,
  loadRecipeForAdmin,
  setRecipeTrashed,
  updateRecipeForAdmin,
  type AdminRecipeInput,
  type AdminRecipeStatus,
} from "@/lib/recipes/repository";
import { recipeIdOfSourceId, validateRecipeInput, youTubeIdFromInput, type RecipeInput } from "@/lib/recipes/model";

/**
 * Server Action ของหลังบ้านเมนูอาหาร (รอบที่ 135 · แบบ WordPress "Posts")
 *
 * กติกาโปรเจกต์ที่ต้องถือ (เหมือนหลังบ้านข่าว/สินค้า)
 * - **ตรวจสิทธิ์ทุก action** (`requireAdminUser("content")`)
 * - **ห้ามเชื่อข้อมูลจากเบราว์เซอร์** — ผ่าน `validateRecipeInput()` (validator กลางของเมนู) เสมอ
 * - **ห้ามใช้ `id` ที่ส่งมาจากฟอร์มเป็นคีย์ตรง ๆ** — id ต้อง derive จาก `source_id` (บทเรียนรอบที่ 134)
 * - บันทึกแล้ว **ต้องบอกเว็บให้สร้างหน้าใหม่** (`refreshPublicSite("page")`)
 * - ทุกการแก้เนื้อหาเขียน **audit log**
 */

const LIST_PATH = "/admin/recipes";

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function readInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

/** `YYYY-MM-DD` หรือ null ถ้าเว้นว่าง/รูปแบบผิด */
function parseDate(value: string): string | null {
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function statusOf(value: string): AdminRecipeStatus {
  return value === "draft" ? "draft" : "published";
}

export async function saveRecipeAction(_previous: RecipeSaveState, formData: FormData): Promise<RecipeSaveState> {
  const user = await requireAdminUser("content");
  if (!isDatabaseConfigured()) return { status: "error", reason: "database", createdId: null };

  const id = field(formData, "id").trim();
  const existing = id === "" ? null : await loadRecipeForAdmin(id);
  if (id !== "" && existing === null) return { status: "error", reason: "not-found", createdId: null };

  /*
    ⚠️ id ถูกล็อก: derive จาก source_id ของแถวเดิม (หรือเวลาปัจจุบันเมื่อสร้างใหม่)
    ⇒ ฟอร์มที่ถูกแก้ให้ส่ง id อื่นมา สร้างเมนูใหม่/เปลี่ยน URL เดิมไม่ได้
  */
  const sourceId = existing?.sourceId ?? String(Date.now());
  const publishedOn = parseDate(field(formData, "publishedOn"));
  /*
    รอบที่ 136: ผู้ใช้วาง **ลิงก์ YouTube เต็ม** ได้ — ดึงรหัสให้เองที่นี่ (ที่เดียว ใช้ตัวดึงกลาง)
    ⚠️ ถ้าดึงไม่ได้ ปล่อยค่าเดิมไปให้ validator กลางปฏิเสธ (ข้อความ error มาจากที่เดียว ไม่ต้องเดา)
    ⚠️ เก็บเฉพาะ **รหัส** ลงฐานข้อมูล (มติ D20) ไม่เก็บ URL เต็ม
  */
  const videoIdInput = field(formData, "videoId").trim();
  const input: AdminRecipeInput = {
    titleTh: field(formData, "titleTh").trim(),
    titleEn: field(formData, "titleEn").trim(),
    videoId: youTubeIdFromInput(videoIdInput) ?? videoIdInput,
    publishedOn,
    sortOrder: readInt(field(formData, "sortOrder")),
    coverPath: field(formData, "coverPath").trim() === "" ? null : field(formData, "coverPath").trim(),
    status: statusOf(field(formData, "status")),
  };

  /* ตรวจด้วย validator กลาง — ประกอบเป็น `RecipeInput` ให้ตรงกติกา (id = r<source_id>, source_id เป็นตัวเลข) */
  const candidate: RecipeInput = {
    id: recipeIdOfSourceId(sourceId),
    sourceId,
    sourceUrl: "",
    titleTh: input.titleTh,
    titleEn: input.titleEn,
    videoId: input.videoId,
    publishedOn,
    sortOrder: input.sortOrder,
  };
  const issues = validateRecipeInput(candidate);
  if (issues.length > 0) {
    const code = issues[0]?.code ?? "";
    if (code === "bad-video-id") return { status: "error", reason: "video", createdId: null };
    if (code === "bad-date") return { status: "error", reason: "date", createdId: null };
    return { status: "error", reason: "title", createdId: null };
  }

  if (existing === null) {
    const createdId = await createRecipeForAdmin(input, user.email);
    await recordAudit({
      action: "recipe-save",
      actorEmail: user.email,
      target: `recipe:${createdId}`,
      detail: `created · ${input.status}`,
    });
    revalidateAdminPath(LIST_PATH);
    await refreshPublicSite("page");
    return { status: input.status === "draft" ? "draft" : "saved", reason: null, createdId };
  }

  await updateRecipeForAdmin(existing.id, input, user.email);
  await recordAudit({
    action: "recipe-save",
    actorEmail: user.email,
    target: `recipe:${existing.id}`,
    detail: `updated · ${input.status}`,
  });
  revalidateAdminPath(LIST_PATH);
  revalidateAdminPath(`${LIST_PATH}/${existing.id}`);
  revalidatePath(`${LIST_PATH}/${existing.id}`);
  await refreshPublicSite("page");
  return { status: input.status === "draft" ? "draft" : "saved", reason: null, createdId: existing.id };
}

/** ย้ายเข้าถังขยะ / กู้คืน — ใช้ฟอร์มสั้น ๆ จากหน้ารายการ (ไม่ต้องมี JS) */
export async function trashRecipeAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser("content");
  const id = field(formData, "id").trim();
  const trashed = field(formData, "trashed") === "1";
  if (id === "" || !isDatabaseConfigured()) return;

  await setRecipeTrashed(id, trashed, user.email);
  await recordAudit({
    action: trashed ? "recipe-trash" : "recipe-restore",
    actorEmail: user.email,
    target: `recipe:${id}`,
    detail: trashed ? "moved-to-trash" : "restored",
  });
  revalidateAdminPath(LIST_PATH);
  await refreshPublicSite("page");
}

/** อัปโหลดภาพปกจากเครื่อง — ใช้ท่อกลาง `storeImageFile` (ย่อภาพ/ตรวจหัวไฟล์/เพดาน 5MB) */
export async function uploadRecipeImageAction(
  _previous: RecipeUploadState,
  formData: FormData,
): Promise<RecipeUploadState> {
  await requireAdminUser("content");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ...INITIAL_RECIPE_UPLOAD_STATE, status: "invalid", reason: "missing" };
  }

  const stored = await storeImageFile(file, "recipe-editor");
  if (!stored.ok) return { ...INITIAL_RECIPE_UPLOAD_STATE, status: "invalid", reason: stored.reason };

  revalidateAdminPath(LIST_PATH);
  return { status: "ok", path: stored.path, reason: "" };
}
