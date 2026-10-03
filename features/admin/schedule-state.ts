import type { ScheduleProblem as ScheduleValueProblem } from "@/lib/blocks/schedule";

/**
 * สถานะของฟอร์ม "ตั้งเวลาเผยแพร่" (X2.7 ส่วนที่ 1 · รอบที่ 100)
 *
 * ทำไมต้องแยกไฟล์ (ไม่ประกาศในไฟล์ `"use server"`)
 * - ด่าน `check:actions` ห้ามไฟล์ Server Action export อะไรที่ไม่ใช่ฟังก์ชัน async
 *   (ค่าคงที่/ชนิด ต้องอยู่ไฟล์ธรรมดา — บทเรียนรอบที่ 66/68 ที่หน้าจอพังเพราะค่าคงที่ในไฟล์ action)
 * - หน้าจอ (client) ต้องใช้ชนิดนี้เพื่ออ่านผลลัพธ์ ⇒ ต้อง import ได้โดยไม่ลากโค้ดฝั่งเซิร์ฟเวอร์เข้ามา
 *
 * ⚠️ หน้าจอแมป `problem` ครบทุกกรณีด้วย `switch` แบบ exhaustive ในตัวสร้างหน้าเว็บ
 *    ⇒ เพิ่มรหัสใหม่แล้วลืมแปล = compile error (ไม่ปล่อยให้ขึ้นรหัสดิบ)
 */

/** รหัสเหตุผลที่ตั้งกำหนดไม่ได้ = เหตุผลจากตรรกะล้วน + กรณีที่รู้ได้เฉพาะฝั่งเซิร์ฟเวอร์ */
export type ScheduleProblem = ScheduleValueProblem | "missing-page" | "content" | "server";

export type ScheduleState = {
  /** `idle` = ยังไม่เคยส่งฟอร์ม (หน้าจอใช้ค่าที่อ่านจากฐานข้อมูล) */
  readonly status: "idle" | "scheduled" | "cleared" | "failed";
  /** เวลาที่จะเผยแพร่ (ISO/UTC) — null = ไม่ได้ตั้ง */
  readonly at: string | null;
  /** ใครตั้งไว้ (null = ไม่ได้ตั้ง) */
  readonly by: string | null;
  readonly problem: ScheduleProblem | null;
};

export const INITIAL_SCHEDULE_STATE: ScheduleState = {
  status: "idle",
  at: null,
  by: null,
  problem: null,
};
