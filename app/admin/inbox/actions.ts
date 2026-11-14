"use server";

import { revalidatePath } from "next/cache";

import { recordAudit } from "@/lib/audit/log";
import { requireAdminUser } from "@/lib/auth/dal";
import {
  deleteSubmission,
  findAttachment,
  findSubmission,
  listAttachments,
  setSubmissionNotificationStatus,
  setSubmissionStatus,
  type SubmissionStatus,
} from "@/lib/forms/repository";
import { saveFormMailRouting } from "@/lib/forms/mail-routing-repository";
import { checkErasureRequest } from "@/lib/privacy/erasure";
import { eraseSubject } from "@/lib/privacy/repository";
import { sendFormNotification } from "@/lib/forms/email-delivery";
import { CONTACT_TOPICS } from "@/features/contact/content";
import { parseFormMailRouting } from "@/lib/forms/mail-routing";
import type { FormMailRoutingState } from "@/features/admin/form-mail-state";

/**
 * Server Actions ของ "กล่องข้อความ" (X1.9)
 *
 * ⚠️ ข้อมูลส่วนบุคคล (PDPA) ⇒ ทุก action เริ่มด้วย `requireAdminUser("<permission>")` เสมอ
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
  const user = await requireAdminUser("inbox");
  const id = readId(formData);
  if (id === null) return;

  const raw = formData.get("status");
  const status: SubmissionStatus = raw === "handled" || raw === "spam" || raw === "new" ? raw : "new";

  await setSubmissionStatus(id, status, user.email);
  await recordAudit({ action: "pages-update", actorEmail: user.email, target: `inbox:${id}`, detail: status });
  revalidatePath(INBOX_PATH);
}

export async function deleteSubmissionAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser("inbox");
  const id = readId(formData);
  if (id === null) return;

  await deleteSubmission(id);
  await recordAudit({ action: "pages-update", actorEmail: user.email, target: `inbox:${id}`, detail: "deleted" });
  revalidatePath(INBOX_PATH);
}

/**
 * ลบข้อมูลทั้งหมดของอีเมลนี้ (คำขอใช้สิทธิ์ตาม PDPA · หนี้ที่ปิดในรอบที่ 77)
 *
 * ⚠️ สิ่งที่เกิดขึ้นจริง: ลบ **ทุกฟอร์ม** ของอีเมลนั้น + ไฟล์เรซูเม่ที่ผูกอยู่ (cascade)
 *    และบันทึก audit ด้วยอีเมล **แบบปิดบางส่วน** (ไม่เขียนอีเมลเต็มกลับเข้าไประบบหลังลบ)
 *
 * ต้องผ่านครบ 3 อย่างก่อนลบ: อีเมลพอเป็นอีเมล · **ติ๊กว่ายืนยันตัวตนผู้ขอแล้ว** · พิมพ์อีเมลซ้ำตรงกัน
 * (ขั้นตอนพิสูจน์ตัวตนเป็นงานของเจ้าหน้าที่ — ดู `PRODUCT_ROADMAP.md` § 9)
 */
export async function eraseSubjectAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser("inbox");

  const raw = (key: string): string => {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
  };

  const check = checkErasureRequest({
    email: raw("email"),
    confirmEmail: raw("confirmEmail"),
    verified: raw("verified") === "on",
  });

  /* ไม่ผ่านการตรวจ = ไม่ลบอะไรเลย (ไม่ต้องแจ้ง error ที่นี่ — หน้าจอตรวจซ้ำอีกชั้น) */
  if (!check.ok) {
    revalidatePath(INBOX_PATH);
    return;
  }

  await eraseSubject({ email: raw("email"), actorEmail: user.email });
  revalidatePath(INBOX_PATH);
}

function formMailRoutingFromForm(formData: FormData): unknown {
  const contact: Record<string, { readonly to: string; readonly cc: string }> = {};
  for (const topic of CONTACT_TOPICS) {
    contact[topic] = {
      to: String(formData.get(`contact.${topic}.to`) ?? ""),
      cc: String(formData.get(`contact.${topic}.cc`) ?? ""),
    };
  }

  return {
    contact,
    careers: {
      to: String(formData.get("careers.to") ?? ""),
      cc: String(formData.get("careers.cc") ?? ""),
    },
  };
}

export async function saveFormMailRoutingAction(
  _previous: FormMailRoutingState,
  formData: FormData,
): Promise<FormMailRoutingState> {
  const user = await requireAdminUser("inbox");
  const routing = parseFormMailRouting(formMailRoutingFromForm(formData));
  if (routing === null) return { status: "invalid" };

  try {
    await saveFormMailRouting(routing, user.email);
    await recordAudit({ action: "pages-update", actorEmail: user.email, target: "form-mail-routing", detail: "recipients-updated" });
  } catch (error) {
    console.error("[admin/inbox] could not save mail routing", error instanceof Error ? error.name : "unknown");
    return { status: "failed" };
  }

  revalidatePath(INBOX_PATH);
  return { status: "saved" };
}

function submissionDraft(row: NonNullable<Awaited<ReturnType<typeof findSubmission>>>) {
  if (row.form === "newsletter") return null;
  return {
    form: row.form,
    email: row.email,
    name: row.name,
    phone: row.phone,
    topic: row.topic,
    subject: row.subject,
    message: row.message,
    consent: row.consent,
    payload: row.payload,
  };
}

export async function retrySubmissionNotificationAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser("inbox");
  const id = readId(formData);
  if (id === null) return;

  const row = await findSubmission(id);
  if (
    row === null ||
    (row.form !== "contact" && row.form !== "careers") ||
    row.status === "spam" ||
    (row.notificationStatus !== "pending" && row.notificationStatus !== "failed")
  ) {
    return;
  }

  const draft = submissionDraft(row);
  if (draft === null) return;

  try {
    const attachmentRows = row.form === "careers" ? await listAttachments(row.id) : [];
    const mailAttachments = await Promise.all(
      attachmentRows.map(async (file) => {
        const attachment = await findAttachment(file.id);
        if (attachment === null) throw new Error("Resume attachment is missing");
        return { filename: attachment.filename, mime: attachment.mime, data: attachment.data };
      }),
    );
    await sendFormNotification(draft, mailAttachments);
    const updated = await setSubmissionNotificationStatus(id, "sent");
    if (!updated) throw new Error("Could not record email notification status");
  } catch (error) {
    console.error("[admin/inbox] email notification retry failed", error instanceof Error ? error.name : "unknown");
    await setSubmissionNotificationStatus(id, "failed");
    revalidatePath(INBOX_PATH);
    return;
  }

  await recordAudit({ action: "pages-update", actorEmail: user.email, target: `inbox:${id}`, detail: "notification-resent" });
  revalidatePath(INBOX_PATH);
}
