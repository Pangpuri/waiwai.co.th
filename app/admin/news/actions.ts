"use server";

import { loadEntityRevision, recordEntityRevision } from "@/lib/revisions/repository";
import { newsRestoreOf, newsSnapshotOf } from "@/lib/revisions/model";
import { revalidatePath } from "next/cache";

import type { NewsSaveState, NewsUploadState } from "@/features/admin/news-state";
import { recordAudit } from "@/lib/audit/log";
import { requireAdminUser } from "@/lib/auth/dal";
import { revalidateAdminPath } from "@/lib/cache/refresh";
import { refreshPublicSite } from "@/lib/cache/refresh";
import { isDatabaseConfigured } from "@/db/pool";
import { storeImageFile } from "@/lib/media/upload";
import { parseNewsEditorBlocks } from "@/lib/news/editor-blocks";
import {
  createNewsForAdmin,
  deleteNewsForever,
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
 * - **ห้ามเชื่อข้อมูลจากเบราว์เซอร์**: เนื้อหาผ่าน `parseNewsEditorBlocks()` (จำกัดจำนวน/ความยาวตามเพดานกลาง)
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

  /*
    เนื้อหามาจาก **ตัวแก้แบบบล็อก** (การ์ด ข้อความ/ภาพ) ส่งมาเป็น JSON ในช่องซ่อน `bodyBlocks`
    ⚠️ ห้ามเชื่อเบราว์เซอร์: `parseNewsEditorBlocks()` ตรวจชนิด/เพดาน/ต้องมีรหัสภาพ แล้วคืนบล็อกที่ปลอดภัย
  */
  const rawBodyBlocks = field(formData, "bodyBlocks").trim();
  let parsedBlocks: unknown = [];
  try {
    parsedBlocks = JSON.parse(rawBodyBlocks === "" ? "[]" : rawBodyBlocks) as unknown;
  } catch {
    return { status: "error", reason: "body", createdId: null };
  }
  const body = parseNewsEditorBlocks(parsedBlocks);
  /* ส่งมาไม่ว่างแต่แปลงได้ 0 บล็อก = รูปแบบผิด/มีแต่ของว่าง ⇒ ไม่บันทึก (กันข้อมูลหายเงียบ ๆ) */
  if (body.length === 0 && parsedBlocks instanceof Array && parsedBlocks.length > 0) {
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
  /* B1 (รอบที่ 145): เก็บรุ่นหลังบันทึกสำเร็จ — อ่านค่าจริงจากฐานข้อมูล จึงตรงกับของจริงเสมอ */
  await recordNewsRevision(createdId, user.email);
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

/**
 * ลบข่าว **ถาวรจากถังขยะ** (รอบที่ 174) — ใช้ได้เฉพาะของที่อยู่ในถังแล้ว
 *
 * ⚠️ **ประตูไม่ได้อยู่ที่ UI**: `deleteNewsForever()` บังคับ `deleted_at is not null` ที่ SQL
 *    ⇒ ยิงฟอร์มลบข่าวที่ยังเผยแพร่อยู่ = ไม่มีอะไรเกิดขึ้น (fail-closed · พิสูจน์ใน `check:db`)
 */
export async function deleteNewsForeverAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser("content");
  const id = field(formData, "id").trim();
  if (id === "" || !isDatabaseConfigured()) return;

  const deleted = await deleteNewsForever(id);
  if (!deleted) return;

  await recordAudit({
    action: "news-delete",
    actorEmail: user.email,
    target: `news:${id}`,
    detail: "permanent",
  });
  revalidateAdminPath(LIST_PATH);
  await refreshPublicSite("page");
}

/**
 * อัปโหลดภาพจากเครื่องผู้ใช้ **จากในหน้าจอแก้ข่าว** (รอบที่ 126)
 *
 * เจ้าของขอ: *"…ไม่สามารถอัปโหลดจากเครื่องเข้ามาใส่ข่าวได้"*
 * - ตรวจสิทธิ์ `content` (สิทธิ์ของข่าว) · ใช้ท่อกลาง `storeImageFile` ตัวเดียวกับคลังภาพ
 *   ⇒ ย่อภาพในเบราว์เซอร์ (รอบที่ 99) · sniff หัวไฟล์ · เพดาน 5MB — เหมือนกันทุกจุด
 * - คืนพาธ `/media/<id>` ให้จอภาพเอาไปใส่การ์ดต่อได้ทันที
 */
export async function uploadNewsImageAction(
  _previous: NewsUploadState,
  formData: FormData,
): Promise<NewsUploadState> {
  await requireAdminUser("content");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "invalid", path: "", reason: "missing" };
  }

  const stored = await storeImageFile(file, "news-editor");
  if (!stored.ok) return { status: "invalid", path: "", reason: stored.reason };

  revalidateAdminPath(LIST_PATH);
  return { status: "ok", path: stored.path, reason: "" };
}

/* ── ประวัติรุ่น (B1 ส่วนที่ 2 · รอบที่ 145) ─────────────────────────────── */

async function recordNewsRevision(id: string, actor: string, note = ""): Promise<void> {
  const saved = await loadNewsForAdmin(id);
  if (saved === null) return;
  await recordEntityRevision({ kind: "news", entityId: id, snapshot: newsSnapshotOf(saved), actor, note });
}

/**
 * กู้คืนจากรุ่นในประวัติ
 * - ตรวจสิทธิ์ `content` · ตรวจว่ารุ่นนั้นเป็นของรายการนี้จริง
 * - **บันทึกสถานะปัจจุบันเป็นรุ่นใหม่ก่อนเขียนทับ** ⇒ กู้คืนผิดก็ย้อนกลับได้เสมอ
 */
export async function restoreNewsRevisionAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser("content");
  const id = field(formData, "id");
  const revisionId = field(formData, "revisionId");
  if (id === "" || revisionId === "") return;

  const snapshot = await loadEntityRevision({ kind: "news", entityId: id, revisionId });
  const current = await loadNewsForAdmin(id);
  if (snapshot === null || current === null) return;

  await recordNewsRevision(id, user.email, "ก่อนกู้คืน");

  const restore = newsRestoreOf(snapshot);
  await updateNewsForAdmin(id, { ...restore.values, coverPath: restore.coverPath, body: restore.body }, user.email);
  await recordNewsRevision(id, user.email, `กู้คืนรุ่น #${revisionId}`);
  await recordAudit({
    action: "news-revision-restore",
    actorEmail: user.email,
    target: `news:${id}`,
    detail: `revision=${revisionId}`,
  });

  revalidateAdminPath(LIST_PATH);
  revalidateAdminPath(`${LIST_PATH}/${id}`);
  await refreshPublicSite("page");
}
