import { NextResponse } from "next/server";

import { getSessionUser, refreshMaintenanceBypass } from "@/lib/auth/dal";
import { can } from "@/lib/auth/roles";

/**
 * ต่ออายุ "บัตรผ่านดูเว็บระหว่างปิดปรับปรุง" (รอบที่ 96)
 *
 * ทำไมต้องมี route นี้
 * - `proxy.ts` ตรวจได้แค่ลายเซ็น/อายุ (ห้ามอ่าน DB ตามเอกสาร Next) ⇒ บัตรผ่านต้อง **สั้น** (15 นาที)
 * - แต่การ "ต่ออายุ" ต้องรู้ว่าเซสชันยังใช้ได้จริง ⇒ ต้องเป็นจุดที่ **อ่านฐานข้อมูลได้** = ที่นี่
 * - หน้าหลังบ้านเรียกจุดนี้เป็นระยะ (ดู `MaintenanceBypassPing`) ⇒ ผู้ที่ยังล็อกอินอยู่ได้บัตรผ่านใหม่เสมอ
 *   ส่วนคนที่ถูกเพิกถอน/ถูกปิดบัญชี จะไม่ได้บัตรใหม่ ⇒ ดูเว็บที่ปิดอยู่ได้อีกไม่เกิน 15 นาที
 *
 * ⚠️ ตอบ 204 เสมอ (ไม่เปิดเผยว่าล็อกอินหรือไม่ — ไม่มีข้อมูลอะไรให้ใช้โจมตี)
 * ⚠️ `force-dynamic` + `no-store`: ห้ามแคช (จะได้บัตรผ่านของคนอื่น)
 */
export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  const user = await getSessionUser();

  /*
    ตรวจกับฐานข้อมูลก่อนเสมอ — นี่คือหัวใจ: บัตรผ่านออกให้เฉพาะเซสชันที่ยังใช้ได้จริง
    ⚠️ route handler ใช้ redirect() ของ DAL ไม่ได้ ⇒ ตรวจสิทธิ์เองด้วย can(...) (กติกาโปรเจกต์)
    ใช้สิทธิ์พื้นฐาน "content" (มีทุกบทบาท) เพราะบัตรผ่านมีไว้ "ดูเว็บ" ไม่ได้ให้แก้ข้อมูลอื่น
  */
  if (user !== null && can(user.role, "content")) {
    await refreshMaintenanceBypass();
  }

  return new NextResponse(null, {
    status: 204,
    headers: { "cache-control": "no-store" },
  });
}
