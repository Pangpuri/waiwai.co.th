import { JOBS, type JobId } from "@/features/careers/jobs";
import { CONTACT_TOPICS, type ContactTopicId } from "@/features/contact/content";

/**
 * ช่องกรอกของฟอร์ม "ติดต่อ" และ "สมัครงาน" — **คอมโพเนนต์กลาง (รอบที่ 86)**
 *
 * ทำไมต้องแยกออกมา
 * - เดิมช่องกรอกถูกเขียนอยู่ในหน้าจริงเท่านั้น ⇒ บล็อก "ฟอร์ม" ในตัวสร้างหน้าเว็บฝังฟอร์มจริงไม่ได้
 * - ตอนนี้ **หน้าเว็บจริงกับบล็อกใช้โค้ดชุดเดียวกัน** ⇒ แก้ช่องกรอกที่เดียว ได้ทั้งสองที่ (ไม่มี markup ซ้ำ)
 * - เป็นคอมโพเนนต์บริสุทธิ์: ข้อความทุกตัวรับเข้ามาเป็น plain object ⇒ ใช้ได้ทั้ง Server และ Client
 *   (ตัวเรนเดอร์บล็อกถูกใช้ทั้งหน้าเว็บจริงและพรีวิวหลังบ้าน)
 *
 * ⚠️ ฟอร์ม "ข่าวสาร" ใช้ `NewsletterForm` เดิม (มี layout ของตัวเอง) — ไม่ได้อยู่ในไฟล์นี้
 */

const FIELD_CLASS =
  "w-full rounded-xl border-2 border-line-strong bg-surface px-4 py-3 text-sm text-fg outline-none placeholder:text-fg-muted/70 focus:border-brand-red";
const LABEL_CLASS = "block text-sm font-semibold text-fg";

function RequiredMark() {
  return (
    <>
      {" "}
      <span aria-hidden="true" className="text-brand-red">
        *
      </span>
    </>
  );
}

/* ── ฟอร์มติดต่อ ─────────────────────────────────────────────────────────── */

export type ContactFieldStrings = {
  readonly topicLabel: string;
  readonly topicPlaceholder: string;
  readonly topics: Readonly<Record<ContactTopicId, string>>;
  readonly nameLabel: string;
  readonly namePlaceholder: string;
  readonly emailLabel: string;
  readonly emailPlaceholder: string;
  readonly phoneLabel: string;
  readonly phonePlaceholder: string;
  readonly subjectLabel: string;
  readonly subjectPlaceholder: string;
  readonly detailsLabel: string;
  readonly detailsPlaceholder: string;
  readonly requiredNote: string;
};

export function ContactFormFields({ strings }: { readonly strings: ContactFieldStrings }) {
  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={LABEL_CLASS} htmlFor="contact-topic">
            {strings.topicLabel}
            <RequiredMark />
          </label>
          <select id="contact-topic" name="topic" required defaultValue="" className={`mt-2 ${FIELD_CLASS}`}>
            <option value="" disabled>
              {strings.topicPlaceholder}
            </option>
            {CONTACT_TOPICS.map((topic) => (
              <option key={topic} value={topic}>
                {strings.topics[topic]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="contact-name">
            {strings.nameLabel}
            <RequiredMark />
          </label>
          <input
            id="contact-name"
            name="name"
            type="text"
            required
            autoComplete="name"
            placeholder={strings.namePlaceholder}
            className={`mt-2 ${FIELD_CLASS}`}
          />
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="contact-email">
            {strings.emailLabel}
            <RequiredMark />
          </label>
          <input
            id="contact-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder={strings.emailPlaceholder}
            className={`mt-2 ${FIELD_CLASS}`}
          />
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="contact-phone">
            {strings.phoneLabel}
            <RequiredMark />
          </label>
          <input
            id="contact-phone"
            name="phone"
            type="tel"
            required
            autoComplete="tel"
            placeholder={strings.phonePlaceholder}
            className={`mt-2 ${FIELD_CLASS}`}
          />
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="contact-subject">
            {strings.subjectLabel}
            <RequiredMark />
          </label>
          <input
            id="contact-subject"
            name="subject"
            type="text"
            required
            placeholder={strings.subjectPlaceholder}
            className={`mt-2 ${FIELD_CLASS}`}
          />
        </div>

        <div className="sm:col-span-2">
          <label className={LABEL_CLASS} htmlFor="contact-details">
            {strings.detailsLabel}
            <RequiredMark />
          </label>
          <textarea
            id="contact-details"
            name="details"
            required
            rows={6}
            placeholder={strings.detailsPlaceholder}
            className={`mt-2 ${FIELD_CLASS}`}
          />
        </div>
      </div>

      <p className="text-fg-muted mt-4 text-xs">{strings.requiredNote}</p>
    </>
  );
}

/* ── ฟอร์มสมัครงาน ───────────────────────────────────────────────────────── */

export type CareerFieldStrings = {
  readonly positionLabel: string;
  readonly positionPlaceholder: string;
  /** ชื่อตำแหน่งตาม id ของงาน (ดึงจากพจนานุกรมของหน้าสมัครงาน) */
  readonly jobTitle: (id: JobId) => string;
  readonly nameLabel: string;
  readonly phoneLabel: string;
  readonly emailLabel: string;
  readonly resumeLabel: string;
  readonly resumeHint: string;
  readonly messageLabel: string;
};

export function CareerFormFields({ strings }: { readonly strings: CareerFieldStrings }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className={LABEL_CLASS} htmlFor="apply-position">
          {strings.positionLabel}
          <RequiredMark />
        </label>
        <select id="apply-position" name="topic" required defaultValue="" className={`mt-2 ${FIELD_CLASS}`}>
          <option value="" disabled>
            {strings.positionPlaceholder}
          </option>
          {JOBS.map((job) => (
            <option key={job.id} value={job.id}>
              {strings.jobTitle(job.id)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={LABEL_CLASS} htmlFor="apply-name">
          {strings.nameLabel}
          <RequiredMark />
        </label>
        <input id="apply-name" name="name" type="text" required autoComplete="name" className={`mt-2 ${FIELD_CLASS}`} />
      </div>

      <div>
        <label className={LABEL_CLASS} htmlFor="apply-phone">
          {strings.phoneLabel}
        </label>
        <input id="apply-phone" name="phone" type="tel" autoComplete="tel" className={`mt-2 ${FIELD_CLASS}`} />
      </div>

      <div className="sm:col-span-2">
        <label className={LABEL_CLASS} htmlFor="apply-email">
          {strings.emailLabel}
          <RequiredMark />
        </label>
        <input id="apply-email" name="email" type="email" required autoComplete="email" className={`mt-2 ${FIELD_CLASS}`} />
      </div>

      <div className="sm:col-span-2">
        <label className={LABEL_CLASS} htmlFor="apply-resume">
          {strings.resumeLabel}
        </label>
        <input
          id="apply-resume"
          name="resume"
          type="file"
          accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          className={`mt-2 ${FIELD_CLASS}`}
        />
        <p className="text-fg-muted mt-1 text-xs">{strings.resumeHint}</p>
      </div>

      <div className="sm:col-span-2">
        <label className={LABEL_CLASS} htmlFor="apply-message">
          {strings.messageLabel}
        </label>
        <textarea id="apply-message" name="message" rows={5} className={`mt-2 ${FIELD_CLASS}`} />
      </div>
    </div>
  );
}
