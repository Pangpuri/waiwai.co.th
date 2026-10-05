"use server";

import { revalidatePath } from "next/cache";

import type { NewsSaveState } from "@/features/admin/news-state";
import { recordAudit } from "@/lib/audit/log";
import { requireAdminUser } from "@/lib/auth/dal";
import { revalidateAdminPath } from "@/lib/cache/refresh";
import { refreshPublicSite } from "@/lib/cache/refresh";
import { isDatabaseConfigured } from "@/db/pool";
import { newsTextLosses, newsTextToBlocks } from "@/lib/news/editor-text";
import {
  createNewsForAdmin,
  loadNewsForAdmin,
  setNewsTrashed,
  updateNewsForAdmin,
  type AdminNewsInput,
  type AdminNewsStatus,
} from "@/lib/news/repository";

/**
 * Server Action ของหลังบ้านข่าว/กิจกรรม (รอบที่ 123 · แบบ WordPress "Posts")
 *
 * กติกาโปรเจกต์ที่ต้องถือ
 * - **ตรวจสิทธิ์ทุก action** (`requireAdminUser("content")`) — ตรวจฝั่งเซิร์ฟเวอร์เสมอ
 * - **ห้ามเชื่อข้อมูลจากเบราว์เซอร์**: เนื้อหาผ่าน `newsTextToBlocks()` (จำกัดจำนวน/ความยาวตามเพดานกลาง)
 * - บันทึกแล้ว **ต้องบอกเว็บให้สร้างหน้าใหม่** ผ่าน `refreshPublicSite("page")`
 *   (นโยบายแคชอยู่ `lib/cache/plan.ts`) — ไม่งั้นกดบันทึกแล้วหน้าเว็บยังโชว์ของเก่าถึง 5 นาที
 * - ทุกการแก้เนื้อหาเขียน **audit log** (ใคร/ทำอะไร/กับข่าวไหน)
 * - ไม่ส่งข้อความกลับไปให้จอภาพ (ส่งแค่รหัสเหตุผล) ⇒ ข้อความทั้งหมดมาจากพจนานุกรม
 */

const LIST_PATH = "/admin/news";

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** `YYYY-MM-DDTHH:MM` (เวลาไทย) → ค่าเดิม หรือ null ถ้าไม่ถูกรูปแบบ/เว้นว่าง */
function parsePublishedLocal(value: string): string | null {
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed) ? trimmed : null;
}

function statusOf(value: string): AdminNewsStatus {
  return value === "draft" ? "draft" : "published";
}

export async function saveNewsAction(_previous: NewsSaveState, formData: FormData): Promise<NewsSaveState> {
  const user = await requireAdminUser("content");
  if (!isDatabaseConfigured()) return { status: "error", reason: "database", createdId: null };

  const id = field(formData, "id").trim();
  const titleTh = field(formData, "titleTh").trim();
  if (titleTh === "") return { status: "error", reason: "title", createdId: null };

  const bodyText = field(formData, "body");
  const body = newsTextToBlocks(bodyText);
  /* เกินเพดานแล้วของถูกตัด ⇒ ไม่บันทึก (กันข้อมูลหายเงียบ ๆ) */
  const losses = newsTextLosses(bodyText);
  if (losses.droppedBlocks > 0 || losses.droppedImages > 0) {
    return { status: "error", reason: "body", createdId: null };
  }

  const coverRaw = field(formData, "coverPath").trim();
  const input: AdminNewsInput = {
    titleTh,
    titleEn: field(formData, "titleEn").trim(),
    excerptTh: field(formData, "excerptTh").trim(),
    excerptEn: field(formData, "excerptEn").trim(),
    coverPath: coverRaw === "" ? null : coverRaw,
    publishedLocal: parsePublishedLocal(field(formData, "publishedLocal")),
    status: statusOf(field(formData, "status")),
    body,
  };

  if (id === "") {
    const createdId = await createNewsForAdmin(input, user.email);
    await recordAudit({
      action: "news-save",
      actorEmail: user.email,
      target: `news:${createdId}`,
      detail: `created · ${input.status}`,
    });
    revalidateAdminPath(LIST_PATH);
    await refreshPublicSite("page");
    return { status: input.status === "draft" ? "draft" : "saved", reason: null, createdId };
  }

  const existing = await loadNewsForAdmin(id);
  if (existing === null) return { status: "error", reason: "not-found", createdId: null };

  await updateNewsForAdmin(id, input, user.email);
  await recordAudit({
    action: "news-save",
    actorEmail: user.email,
    target: `news:${id}`,
    detail: `updated · ${input.status}`,
  });
  revalidateAdminPath(LIST_PATH);
  revalidateAdminPath(`${LIST_PATH}/${id}`);
  revalidatePath(`${LIST_PATH}/${id}`);
  await refreshPublicSite("page");
  return { status: input.status === "draft" ? "draft" : "saved", reason: null, createdId: id };
}

/** ย้ายเข้าถังขยะ / กู้คืน — ใช้ฟอร์มสั้น ๆ จากหน้ารายการ (ไม่ต้องมี JS) */
export async function trashNewsAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser("content");
  const id = field(formData, "id").trim();
  const trashed = field(formData, "trashed") === "1";
  if (id === "" || !isDatabaseConfigured()) return;

  await setNewsTrashed(id, trashed, user.email);
  await recordAudit({
    action: trashed ? "news-trash" : "news-restore",
    actorEmail: user.email,
    target: `news:${id}`,
    detail: trashed ? "moved-to-trash" : "restored",
  });
  revalidateAdminPath(LIST_PATH);
  await refreshPublicSite("page");
}
