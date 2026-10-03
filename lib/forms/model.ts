import { isValidEmail } from "@/lib/validate";

/**
 * ตรรกะฟอร์มหน้าเว็บ (X1.9) — **บริสุทธิ์ ทดสอบได้ ไม่ต้องมี Next/DB**
 *
 * มติผู้ใช้ รอบที่ 64: ทุกฟอร์ม **เก็บลงฐานข้อมูล** ไม่พึ่งอีเมล
 * ⇒ ต้องตรวจให้ครบที่นี่ (ฝั่งเซิร์ฟเวอร์) เพราะ HTML attribute กันได้แค่คนที่ใช้เบราว์เซอร์ปกติ
 */

export const FORM_KINDS = ["contact", "newsletter", "careers"] as const;
export type FormKind = (typeof FORM_KINDS)[number];

export const MAX_NAME_LENGTH = 120;
export const MAX_EMAIL_LENGTH = 160;
export const MAX_PHONE_LENGTH = 40;
export const MAX_TOPIC_LENGTH = 80;
export const MAX_SUBJECT_LENGTH = 200;
export const MAX_MESSAGE_LENGTH = 4000;
export const MIN_MESSAGE_LENGTH = 10;

/** จำกัดความถี่: ส่งได้ไม่เกิน 5 ครั้ง / 10 นาที ต่ออีเมล */
export const MAX_SUBMISSIONS_PER_WINDOW = 5;
export const SUBMISSION_WINDOW_MS = 10 * 60 * 1000;

export type FieldIssue = {
  readonly field: string;
  readonly code: string;
};

export type SubmissionDraft = {
  readonly form: FormKind;
  readonly email: string;
  readonly name: string;
  readonly phone: string;
  readonly topic: string;
  readonly subject: string;
  readonly message: string;
  readonly consent: boolean;
  readonly payload: Readonly<Record<string, string>>;
};

export function isFormKind(value: unknown): value is FormKind {
  return typeof value === "string" && (FORM_KINDS as readonly string[]).includes(value);
}

function read(fields: Readonly<Record<string, string>>, key: string, max: number): string {
  const value = fields[key];
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export type ValidationResult =
  /** ผ่าน: `spam` = ต้องบันทึกเป็นสแปม (กับดักบอต) — ผู้ใช้ยังเห็นข้อความ "สำเร็จ" */
  | { readonly ok: true; readonly value: SubmissionDraft; readonly spam: boolean }
  | { readonly ok: false; readonly issues: readonly FieldIssue[]; readonly spam: boolean };

/**
 * ตรวจข้อมูลที่ส่งมาจากฟอร์ม
 *
 * - **กับดักบอต (honeypot)**: ช่อง `website` ต้องว่าง — มนุษย์มองไม่เห็น แต่บอตมักกรอก
 *   ⇒ ถ้ากรอก = ตอบ "สำเร็จ" แต่บันทึกเป็น `spam` (ไม่บอกบอตว่าโดนจับได้)
 * - ฟอร์มไหนต้องการอะไร: ติดต่อ = ชื่อ/อีเมล/หัวข้อ/รายละเอียด · รับข่าวสาร = อีเมล · สมัครงาน = ชื่อ/อีเมล/ตำแหน่ง
 * - **ต้องยินยอม (PDPA) ทุกฟอร์ม** — ไม่ยินยอม = ไม่รับ
 */
export function validateSubmission(form: unknown, fields: Readonly<Record<string, string>>): ValidationResult {
  const issues: FieldIssue[] = [];
  const spam = read(fields, "website", 200) !== "";

  if (!isFormKind(form)) {
    return { ok: false, issues: [{ field: "form", code: "unknown-form" }], spam: false };
  }

  const email = read(fields, "email", MAX_EMAIL_LENGTH);
  const name = read(fields, "name", MAX_NAME_LENGTH);
  const consent = fields["consent"] === "1" || fields["consent"] === "on" || fields["consent"] === "true";

  if (email === "" || !isValidEmail(email)) issues.push({ field: "email", code: "invalid-email" });
  if (!consent) issues.push({ field: "consent", code: "consent-required" });

  const phone = read(fields, "phone", MAX_PHONE_LENGTH);
  const topic = read(fields, "topic", MAX_TOPIC_LENGTH);
  const subject = read(fields, "subject", MAX_SUBJECT_LENGTH);
  const message = read(fields, "message", MAX_MESSAGE_LENGTH);

  if (form === "contact") {
    if (name === "") issues.push({ field: "name", code: "required" });
    if (topic === "") issues.push({ field: "topic", code: "required" });
    if (subject === "") issues.push({ field: "subject", code: "required" });
    if (message.length < MIN_MESSAGE_LENGTH) issues.push({ field: "message", code: "too-short" });
  }

  if (form === "careers") {
    if (name === "") issues.push({ field: "name", code: "required" });
    if (topic === "") issues.push({ field: "topic", code: "required" });
  }

  if (issues.length > 0) return { ok: false, issues, spam };

  /* เก็บฟิลด์เพิ่มเติมของแต่ละฟอร์ม (ไม่เก็บ honeypot) */
  const payload: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (key === "website" || key === "consent" || key === "form") continue;
    if (typeof value !== "string") continue;
    if (["email", "name", "phone", "topic", "subject", "message"].includes(key)) continue;
    payload[key.slice(0, 40)] = value.trim().slice(0, 500);
  }

  return {
    ok: true,
    spam,
    value: { form, email, name, phone, topic, subject, message, consent, payload },
  };
}

/**
 * ตรวจความถี่การส่ง (X1.9) — กันคน/bot ยิงรัว
 * @param recentAt เวลาที่ส่งในหน้าต่างล่าสุด (ms)
 */
export function evaluateSubmissionRate(recentAt: readonly number[], now: number): { readonly blocked: boolean; readonly retryAfterMs: number } {
  const inWindow = recentAt.filter((at) => now - at <= SUBMISSION_WINDOW_MS);
  if (inWindow.length < MAX_SUBMISSIONS_PER_WINDOW) return { blocked: false, retryAfterMs: 0 };

  const oldest = inWindow.reduce((earliest, at) => Math.min(earliest, at), now);
  return { blocked: true, retryAfterMs: Math.max(0, oldest + SUBMISSION_WINDOW_MS - now) };
}
