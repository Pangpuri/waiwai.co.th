"use server";

import { revalidatePath } from "next/cache";

import { recordAudit } from "@/lib/audit/log";
import { requireAdminUser } from "@/lib/auth/dal";
import { deleteSubmission, setSubmissionStatus, type SubmissionStatus } from "@/lib/forms/repository";

/**
 * Server Actions ของ "กล่องข้อความ" (X1.9)
 *
 * ⚠️ ข้อมูลส่วนบุคคล (PDPA) ⇒ ทุก action เริ่มด้วย `requireAdminUser()` เสมอ
 * ⚠️ ใช้ฟอร์มธรรมดา + server action (ไม่มี JS ฝั่งไคลเอนต์) ⇒ ทำงานได้ทุกเบราว์เซอร์
 */

const INBOX_PATH = "/admin/inbox";

function readId(formData: FormData): number | null {
  const raw = formData.get("id");
  if (typeof raw !== "string") return null;
  const id = Number.parseInt(raw, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export async function setSubmissionStatusAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser();
  const id = readId(formData);
  if (id === null) return;

  const raw = formData.get("status");
  const status: SubmissionStatus = raw === "handled" || raw === "spam" || raw === "new" ? raw : "new";

  await setSubmissionStatus(id, status, user.email);
  await recordAudit({ action: "pages-update", actorEmail: user.email, target: `inbox:${id}`, detail: status });
  revalidatePath(INBOX_PATH);
}

export async function deleteSubmissionAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser();
  const id = readId(formData);
  if (id === null) return;

  await deleteSubmission(id);
  await recordAudit({ action: "pages-update", actorEmail: user.email, target: `inbox:${id}`, detail: "deleted" });
  revalidatePath(INBOX_PATH);
}
