import { CareerFormFields } from "@/features/forms/ui/form-fields";
import { SubmitForm } from "@/features/forms/ui/submit-form";
import type { Messages } from "@/lib/i18n/messages/th";

/**
 * ฟอร์มสมัครงานออนไลน์ (X1.9 ส่วนที่ 2)
 *
 * มติผู้ใช้ รอบที่ 64: ใบสมัครต้อง **เข้าฐานข้อมูลจริง** + แนบเรซูเม่ได้
 * - ใช้ตัวครอบกลาง `SubmitForm` (กับดักบอต · ข้อความยินยอม · สถานะ · ตรวจซ้ำฝั่งเซิร์ฟเวอร์)
 * - ไฟล์ถูกตรวจจาก **ไบต์จริง** ที่เซิร์ฟเวอร์ (PDF/DOC/DOCX/TXT ≤ 5 MB) — ที่นี่เป็นแค่ความสะดวก
 * - ตำแหน่งมาจากรายการงานจริง (`JOBS`) ⇒ สมัครได้เฉพาะตำแหน่งที่ประกาศอยู่
 *
 * รอบที่ 86: **ช่องกรอกย้ายไปคอมโพเนนต์กลาง** `CareerFormFields` ⇒ บล็อก "ฟอร์ม" ในตัวสร้างหน้าเว็บ
 * ใช้ช่องกรอกชุดเดียวกันได้ (หน้าเว็บจริงกับบล็อกไม่มี markup ซ้ำ)
 */

export function ApplicationForm({ messages }: { readonly messages: Messages }) {
  const m = messages.careersPage;

  return (
    <SubmitForm
      formKind="careers"
      className="mt-8 max-w-3xl"
      strings={{
        submit: m.applySubmit,
        submitting: m.applySubmitting,
        consent: m.applyConsent,
        sent: m.applySent,
        invalid: m.applyInvalid,
        rateLimited: m.applyRateLimited,
        unavailable: m.applyUnavailable,
        consentRequired: m.applyConsentRequired,
        fileInvalid: m.applyResumeError,
      }}
    >
      <CareerFormFields
        strings={{
          positionLabel: m.applyPositionLabel,
          positionPlaceholder: m.applyPositionPlaceholder,
          jobTitle: (id) => m.jobs[id].title,
          nameLabel: m.applyNameLabel,
          phoneLabel: m.applyPhoneLabel2,
          emailLabel: m.applyEmailLabel2,
          resumeLabel: m.applyResumeLabel,
          resumeHint: m.applyResumeHint,
          messageLabel: m.applyMessageLabel,
        }}
      />
    </SubmitForm>
  );
}
