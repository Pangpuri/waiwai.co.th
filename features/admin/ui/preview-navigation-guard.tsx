"use client";

import { useEffect } from "react";

import { installPreviewNavigationGuardInWindow } from "@/features/admin/ui/preview-navigation";

/**
 * ตัวดักลิงก์/ฟอร์ม **จากในเอกสารพรีวิวเอง** (รอบที่ 325)
 *
 * ทำไมต้องมีทั้งตัวนี้และตัวที่หน้าต่างแม่
 * - หน้าต่างแม่มีโอกาสแพ้การแข่งเวลา: iframe อาจโหลดเสร็จก่อน React ของ `/admin/builder/*` hydrate
 *   ⇒ `onLoad` ไม่เคยถูกเรียก และ `useEffect` ของแม่อาจติดตั้งบน `about:blank` แล้วหลุดไปพร้อมการนำทาง
 *   (เจอจริงกับ `/admin/builder/executives` · `/certifications` — บางครั้งดัก บางครั้งไม่ดัก)
 * - ตัวนี้อยู่ในเอกสารพรีวิวโดยตรง ⇒ effect รันตอนเอกสารนี้ hydrate แน่นอน
 * - ยังคงเก็บตัวดักฝั่งแม่ไว้สำหรับโหมด "หน้าเว็บจริง" (หน้าเว็บสาธารณะไม่มีคอมโพเนนต์นี้)
 *
 * เปิดพรีวิวตรง ๆ ในแท็บใหม่ (`window.parent === window`) = ไม่ดัก เพื่อให้ตรวจลิงก์จริงได้
 */
export function PreviewNavigationGuard() {
  useEffect(() => {
    if (window.parent === window) return;
    installPreviewNavigationGuardInWindow(window);
  }, []);

  return null;
}
