/**
 * สถานะของฟอร์ม "ตั้งค่าเว็บ" (X1.3)
 *
 * ⚠️ บทเรียนซ้ำ รอบที่ 68: ไฟล์ `"use server"` **export ได้เฉพาะฟังก์ชัน async**
 *    รอบที่ 66 เกิดกับฟอร์มหน้าเว็บ (หน้า /contact พังตอน build) · รอบนี้เกิดกับหน้าตั้งค่าเว็บ (500 ตอน runtime)
 *    ⇒ ย้ายค่าคงที่มาไว้ไฟล์ธรรมดา และเพิ่มด่าน `npm run check:actions` กันไม่ให้เกิดอีก
 */

export type SettingsState = {
  readonly status: "idle" | "saved" | "published" | "invalid" | "failed";
  readonly problems: readonly string[];
};

export const INITIAL_SETTINGS_STATE: SettingsState = { status: "idle", problems: [] };
