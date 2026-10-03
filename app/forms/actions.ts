"use server";

import { recordAudit } from "@/lib/audit/log";
import type { PublicFormState } from "@/features/forms/state";
import { isDatabaseConfigured } from "@/lib/content/repository";
import { MAX_ATTACHMENT_BYTES, readAttachmentInfo, safeAttachmentName } from "@/lib/forms/attachment";
import { evaluateSubmissionRate, validateSubmission } from "@/lib/forms/model";
import { insertAttachment, insertSubmission, recentSubmissionTimes } from "@/lib/forms/repository";

/**
 * Server Action ของ "ฟอร์มหน้าเว็บ" (X1.9) — ติดต่อ · รับข่าวสาร (สมัครงานจะตามมา)
 *
 * ⚠️ หน้านี้เป็น **สาธารณะ** (ไม่ต้องล็อกอิน) ⇒ ต้องป้องกันตัวเองให้ครบ
 *   1. ตรวจค่าฝั่งเซิร์ฟเวอร์เสมอ (ไม่เชื่อ HTML attribute)
 *   2. กับดักบอต (honeypot) — ตอบ "สำเร็จ" แต่บันทึกเป็นสแปม (ไม่บอกบอต)
 *   3. จำกัดความถี่ต่ออีเมล (5 ครั้ง / 10 นาที)
 *   4. ไม่คืนรายละเอียดภายในให้ผู้ใช้ (แค่รหัสสถานะ)
 */

/* ⚠️ ห้าม export ค่าคงที่จากไฟล์ "use server" — ได้เฉพาะฟังก์ชัน async (ดู features/forms/state.ts) */

export async function submitPublicFormAction(_previous: PublicFormState, formData: FormData): Promise<PublicFormState> {
  const fields: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") fields[key] = value;
  }

  const consent = fields["consent"] === "1" || fields["consent"] === "on" || fields["consent"] === "true";
  const result = validateSubmission(formData.get("form"), fields);

  if (!result.ok) {
    return {
      status: "invalid",
      fields: result.issues.map((issue) => issue.field),
      consent,
    };
  }

  /*
    ไฟล์แนบ (เรซูเม่) — ตรวจจาก "ไบต์จริง" ไม่ใช่นามสกุล (X1.9 ส่วนที่ 2)
    ถ้าไฟล์ผิดชนิด/ใหญ่เกิน ⇒ ไม่รับทั้งใบสมัคร (ผู้ใช้แก้ให้ถูกแล้วส่งใหม่)
  */
  let attachment: { readonly filename: string; readonly mime: string; readonly sizeBytes: number; readonly data: Uint8Array } | null = null;
  if (result.value.form === "careers") {
    const file = formData.get("resume");
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        return { status: "invalid", fields: ["resume"], consent };
      }

      const bytes = new Uint8Array(await file.arrayBuffer());
      const info = readAttachmentInfo(bytes);
      if (info === null) {
        return { status: "invalid", fields: ["resume"], consent };
      }

      attachment = {
        filename: safeAttachmentName(file.name, info.extension),
        mime: info.mime,
        sizeBytes: file.size,
        data: bytes,
      };
    }
  }

  if (!isDatabaseConfigured()) {
    return { status: "unavailable", fields: [], consent };
  }

  /* จำกัดความถี่ (ต่ออีเมล) — ทำงานก่อนเขียนฐานข้อมูล */
  try {
    const recent = await recentSubmissionTimes(result.value.email);
    if (evaluateSubmissionRate(recent, Date.now()).blocked) {
      return { status: "rate-limited", fields: [], consent };
    }
  } catch {
    /* อ่านไม่ได้ = ปล่อยผ่าน (ไม่ให้ผู้ใช้จริงส่งไม่ได้เพราะ DB สะดุด) */
  }

  try {
    const id = await insertSubmission(result.value, result.spam);
    if (attachment !== null) await insertAttachment(id, attachment);
    if (result.spam) {
      await recordAudit({ action: "publish", actorEmail: null, target: `form-spam:${id}`, detail: result.value.form });
    }
    return { status: "ok", fields: [], consent: true };
  } catch {
    return { status: "unavailable", fields: [], consent };
  }
}
