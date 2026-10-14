"use server";

import { revalidatePath } from "next/cache";

import { isDatabaseConfigured } from "@/db/pool";
import { revalidateAdminPath, refreshPublicSite } from "@/lib/cache/refresh";
import { recordAudit } from "@/lib/audit/log";
import { requireAdminUser } from "@/lib/auth/dal";
import {
  isJobGenderValue,
  isJobStatus,
  newJobId,
  validateJobInput,
  type JobInput,
} from "@/lib/careers/model";
import {
  createJobPosting,
  deleteJobForever,
  loadJobPostingForAdmin,
  setJobPostingTrashed,
  updateJobPosting,
  type JobWriteInput,
} from "@/lib/careers/repository";
import { reorderRows } from "@/lib/admin/reorder";
import type { JobFormState, JobReorderState } from "@/features/admin/careers-state";

/**
 * Server Action ของหลังบ้าน "ประกาศรับสมัครงาน" (/admin/careers) — รอบที่ 265 · มติเจ้าของ D26
 *
 * กติกาโปรเจกต์ที่ต้องถือ (แบบเดียวกับจอข่าว/สินค้า/เมนู)
 * - **ตรวจสิทธิ์ทุก action** (`requireAdminUser("content")`) — ตรวจฝั่งเซิร์ฟเวอร์เสมอ
 * - **ห้ามเชื่อข้อมูลจากเบราว์เซอร์**: ค่าทุกช่องผ่าน `validateJobInput()` (เพดานความยาว/จำนวนอัตรา/คีย์เพศ)
 * - เพศ/อายุ **ไม่บังคับ** (มติ D26 ข้อ 4) · รหัสประกาศ **ออกให้ที่เซิร์ฟเวอร์** (`newJobId`) ไม่รับจากฟอร์ม
 * - บันทึกแล้ว **บอกเว็บให้สร้างหน้าใหม่** (`refreshPublicSite("page")`)
 * - ทุกการเปลี่ยนแปลงเขียน audit log · ไม่ส่งข้อความกลับไปให้จอ (ส่งแค่รหัสเหตุผล)
 */

const LIST_PATH = "/admin/careers";

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function intOf(value: string, fallback: number): number {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** อ่านค่าจากฟอร์ม → ข้อมูลที่ผ่านการตรวจแล้ว (หรือ null เมื่อไม่ผ่าน) */
function readJobInput(formData: FormData): JobInput | null {
  const status = field(formData, "status");
  const gender = field(formData, "gender");
  const input: JobInput = {
    titleTh: field(formData, "titleTh"),
    titleEn: field(formData, "titleEn"),
    departmentTh: field(formData, "departmentTh"),
    departmentEn: field(formData, "departmentEn"),
    openings: intOf(field(formData, "openings"), 0),
    gender: isJobGenderValue(gender) ? gender : "",
    ageTh: field(formData, "ageTh"),
    ageEn: field(formData, "ageEn"),
    qualificationsTh: field(formData, "qualificationsTh"),
    qualificationsEn: field(formData, "qualificationsEn"),
    experienceTh: field(formData, "experienceTh"),
    experienceEn: field(formData, "experienceEn"),
    sortOrder: intOf(field(formData, "sortOrder"), 0),
    status: isJobStatus(status) ? status : "draft",
  };
  return validateJobInput(input).length === 0 ? input : null;
}

function auditTarget(id: string): string {
  return `job:${id}`;
}

/** บันทึกประกาศ (ฟอร์มแก้ไข) — ใช้ `useActionState` */
export async function saveJobAction(_previous: JobFormState, formData: FormData): Promise<JobFormState> {
  const user = await requireAdminUser("content");
  if (!isDatabaseConfigured()) return { status: "error", reason: "database", createdId: "" };

  const id = field(formData, "id").trim();
  if (id === "") return { status: "error", reason: "missing", createdId: "" };

  const existing = await loadJobPostingForAdmin(id);
  if (existing === null) return { status: "error", reason: "missing", createdId: "" };

  const input = readJobInput(formData);
  if (input === null) return { status: "error", reason: "invalid", createdId: "" };

  const saved = await updateJobPosting({ ...input, id }, user.email);
  if (!saved) return { status: "error", reason: "database", createdId: "" };

  await recordAudit({
    actorEmail: user.email,
    action: "job-save",
    target: auditTarget(id),
    detail: `${input.status} · ${String(input.openings)} อัตรา`,
  });
  revalidateAdminPath(LIST_PATH);
  revalidateAdminPath(`${LIST_PATH}/${id}`);
  await refreshPublicSite("page");
  return { status: "saved", reason: "", createdId: id };
}

/** สร้างประกาศใหม่ — รหัสออกที่เซิร์ฟเวอร์ (`j<เวลา>`) และ **ตั้งเป็นฉบับร่างเสมอ** (มติ D26 ข้อ 5) */
export async function createJobAction(_previous: JobFormState, formData: FormData): Promise<JobFormState> {
  const user = await requireAdminUser("content");
  if (!isDatabaseConfigured()) return { status: "error", reason: "database", createdId: "" };

  const input = readJobInput(formData);
  if (input === null) return { status: "error", reason: "invalid", createdId: "" };

  const id = newJobId(Date.now());
  const write: JobWriteInput = {
    ...input,
    id,
    /* ประกาศใหม่ = ร่างก่อนเสมอ (มติ D26 ข้อ 5) · ลำดับมาจากฟอร์ม (หน้าจอเติม "ต่อท้าย" ให้แล้ว) */
    status: "draft",
  };
  const created = await createJobPosting(write, user.email);
  if (!created) return { status: "error", reason: "duplicate", createdId: "" };

  await recordAudit({ actorEmail: user.email, action: "job-save", target: auditTarget(id), detail: "draft · created" });
  revalidateAdminPath(LIST_PATH);
  return { status: "saved", reason: "", createdId: id };
}

/** ย้ายเข้าถังขยะ / กู้คืน — ประตูสองทางอยู่ที่ SQL (`setJobPostingTrashed`) */
export async function trashJobAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser("content");
  if (!isDatabaseConfigured()) return;

  const id = field(formData, "id").trim();
  const trashed = field(formData, "trashed") === "1";
  if (id === "") return;

  const changed = await setJobPostingTrashed(id, trashed, user.email);
  if (!changed) return;

  await recordAudit({
    actorEmail: user.email,
    action: trashed ? "job-trash" : "job-restore",
    target: auditTarget(id),
    detail: trashed ? "trashed" : "restored",
  });
  revalidatePath(LIST_PATH);
  await refreshPublicSite("page");
}

/** ลบถาวร — ทำได้เฉพาะของที่อยู่ในถัง (ประตูอยู่ที่ SQL) */
export async function deleteJobForeverAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser("content");
  if (!isDatabaseConfigured()) return;

  const id = field(formData, "id").trim();
  if (id === "") return;

  const deleted = await deleteJobForever(id);
  if (!deleted) return;

  await recordAudit({ actorEmail: user.email, action: "job-delete", target: auditTarget(id), detail: "permanent" });
  revalidatePath(LIST_PATH);
  await refreshPublicSite("page");
}

/** จัดลำดับประกาศ — ใช้เครื่องมือกลาง (`reorderRows("job", …)`) */
export async function reorderJobsAction(_previous: JobReorderState, formData: FormData): Promise<JobReorderState> {
  const user = await requireAdminUser("content");
  if (!isDatabaseConfigured()) return { saved: 0, failed: true };

  const ids = field(formData, "order")
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "");
  if (ids.length === 0) return { saved: 0, failed: true };

  const saved = await reorderRows("job", ids, user.email);
  if (saved === 0) return { saved: 0, failed: true };

  await recordAudit({ actorEmail: user.email, action: "job-save", target: "job:order", detail: `reorder ${String(saved)}` });
  revalidateAdminPath(LIST_PATH);
  await refreshPublicSite("page");
  return { saved, failed: false };
}
