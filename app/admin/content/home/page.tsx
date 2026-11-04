import { redirect } from "next/navigation";

import { requireAdminUser } from "@/lib/auth/dal";

/**
 * ทางเข้าเดิมของ "หน้าแรก — แบบฟิลด์ (เลย์เอาต์เดิม)" — รอบ 330
 *
 * มติเจ้าของ 2026-11-04: *"เมนู หน้าแรก---แบบฟิลด์ ... ไม่จำเป็นแล้ว ... เอาออกเลย"*
 * หน้าแรกใช้ **ตัวสร้างหน้าเว็บ (บล็อก)** เป็นเจ้าของเนื้อหาทั้งหมดแล้ว (hero อยู่ที่ `/admin/hero`)
 * ⇒ ถอดหน้าจอฟอร์มออก แต่คง URL นี้ไว้เป็น **ทางผ่าน** เพื่อไม่ให้บุ๊กมาร์กเดิมเจอ 404
 * ⚠️ ต้องตรวจสิทธิ์ก่อนเสมอ — redirect ต้องไม่เปิดทางให้คนที่ยังไม่ล็อกอินเห็นหลังบ้าน
 */
export default async function AdminHomeContentPage() {
  await requireAdminUser("content");
  redirect("/admin/builder/home");
}
