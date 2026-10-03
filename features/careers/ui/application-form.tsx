import { SubmitForm } from "@/features/forms/ui/submit-form";
import { JOBS, type JobId } from "@/features/careers/jobs";
import type { Messages } from "@/lib/i18n/messages/th";

/**
 * ฟอร์มสมัครงานออนไลน์ (X1.9 ส่วนที่ 2)
 *
 * มติผู้ใช้ รอบที่ 64: ใบสมัครต้อง **เข้าฐานข้อมูลจริง** + แนบเรซูเม่ได้
 * - ใช้ตัวครอบกลาง `SubmitForm` (กับดักบอต · ข้อความยินยอม · สถานะ · ตรวจซ้ำฝั่งเซิร์ฟเวอร์)
 * - ไฟล์ถูกตรวจจาก **ไบต์จริง** ที่เซิร์ฟเวอร์ (PDF/DOC/DOCX/TXT ≤ 5 MB) — ที่นี่เป็นแค่ความสะดวก
 * - ตำแหน่งมาจากรายการงานจริง (`JOBS`) ⇒ สมัครได้เฉพาะตำแหน่งที่ประกาศอยู่
 */

const FIELD_CLASS =
  "w-full rounded-xl border-2 border-line-strong bg-surface px-4 py-3 text-sm text-fg outline-none placeholder:text-fg-muted/70 focus:border-brand-red";
const LABEL_CLASS = "block text-sm font-semibold text-fg";

export function ApplicationForm({ messages }: { readonly messages: Messages }) {
  const m = messages.careersPage;
  const jobLabel = (id: JobId): string => m.jobs[id].title;

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
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={LABEL_CLASS} htmlFor="apply-position">
            {m.applyPositionLabel}
            <span aria-hidden="true" className="text-brand-red">
              {" "}
              *
            </span>
          </label>
          <select id="apply-position" name="topic" required defaultValue="" className={`mt-2 ${FIELD_CLASS}`}>
            <option value="" disabled>
              {m.applyPositionPlaceholder}
            </option>
            {JOBS.map((job) => (
              <option key={job.id} value={job.id}>
                {jobLabel(job.id)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="apply-name">
            {m.applyNameLabel}
            <span aria-hidden="true" className="text-brand-red">
              {" "}
              *
            </span>
          </label>
          <input id="apply-name" name="name" type="text" required autoComplete="name" className={`mt-2 ${FIELD_CLASS}`} />
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="apply-phone">
            {m.applyPhoneLabel2}
          </label>
          <input id="apply-phone" name="phone" type="tel" autoComplete="tel" className={`mt-2 ${FIELD_CLASS}`} />
        </div>

        <div className="sm:col-span-2">
          <label className={LABEL_CLASS} htmlFor="apply-email">
            {m.applyEmailLabel2}
            <span aria-hidden="true" className="text-brand-red">
              {" "}
              *
            </span>
          </label>
          <input id="apply-email" name="email" type="email" required autoComplete="email" className={`mt-2 ${FIELD_CLASS}`} />
        </div>

        <div className="sm:col-span-2">
          <label className={LABEL_CLASS} htmlFor="apply-resume">
            {m.applyResumeLabel}
          </label>
          <input
            id="apply-resume"
            name="resume"
            type="file"
            accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            className={`mt-2 ${FIELD_CLASS}`}
          />
          <p className="text-fg-muted mt-1 text-xs">{m.applyResumeHint}</p>
        </div>

        <div className="sm:col-span-2">
          <label className={LABEL_CLASS} htmlFor="apply-message">
            {m.applyMessageLabel}
          </label>
          <textarea id="apply-message" name="message" rows={5} className={`mt-2 ${FIELD_CLASS}`} />
        </div>
      </div>
    </SubmitForm>
  );
}
