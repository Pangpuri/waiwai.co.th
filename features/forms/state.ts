/**
 * สถานะของฟอร์มหน้าเว็บ (X1.9)
 *
 * ⚠️ บทเรียน รอบที่ 66: ไฟล์ `"use server"` **export ได้เฉพาะฟังก์ชัน async**
 *    เดิมวาง `INITIAL_PUBLIC_FORM_STATE` ไว้ใน `app/forms/actions.ts` ⇒ ตอน build จริงค่ากลายเป็น `undefined`
 *    (`state.fields.includes` พังตอน prerender หน้า /contact) ⇒ ย้ายมาไว้ไฟล์ธรรมดาแบบนี้
 */

export type PublicFormState = {
  /** null = ยังไม่ส่ง · ok = ส่งสำเร็จ · ค่าอื่น = รหัสข้อผิดพลาด (แปลที่หน้าจอ) */
  readonly status: "ok" | "invalid" | "rate-limited" | "unavailable" | null;
  /** ชื่อฟิลด์ที่มีปัญหา (ให้หน้าจอไฮไลต์) */
  readonly fields: readonly string[];
  readonly consent: boolean;
};

export const INITIAL_PUBLIC_FORM_STATE: PublicFormState = { status: null, fields: [], consent: false };
