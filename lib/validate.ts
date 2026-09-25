/**
 * ตัวตรวจค่าที่ผู้ใช้กรอก — pure module เขียน unit test คุมได้
 * ไม่ใช้ regex ที่ซับซ้อนเกินจำเป็น เพราะจะปฏิเสธอีเมลที่ถูกต้องบางรูปแบบ
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** ความยาวสูงสุดตาม RFC 5321 */
const EMAIL_MAX_LENGTH = 254;

export function isValidEmail(value: unknown): boolean {
  if (typeof value !== "string") return false;

  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > EMAIL_MAX_LENGTH) return false;
  if (trimmed.includes("..")) return false;

  return EMAIL_PATTERN.test(trimmed);
}
