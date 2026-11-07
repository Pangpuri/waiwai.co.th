"use client";

import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect } from "react";

import {
  DOCUMENT_STATE_ATTRIBUTES,
  applyDocumentState,
  readDocumentState,
  type DocumentState,
} from "@/lib/document-state";

/**
 * ให้ attribute ที่สคริปต์ก่อน paint ติดไว้บน `<html>` อยู่รอดข้ามการนำทางฝั่ง client
 *
 * บั๊กจริง (รอบ 335): `app/[lang]/layout.tsx` เป็น root layout ที่มี `[lang]`
 * ⇒ `/th` → `/en` เปลี่ยน document element ใหม่ และ attribute ทั้งหมดหาย
 * ทำให้ผู้ใช้ที่กดยอมรับคุกกี้แล้วเห็นแถบคุกกี้เด้งกลับมาอีกครั้ง
 * (และประกาศไว้อาลัย/การ์ด hero/reveal ก็หายไปด้วย)
 *
 * กลไก
 * - เก็บ snapshot ไว้ใน module scope ⇒ อยู่ข้าม remount แต่รีเซ็ตเมื่อโหลดเอกสารใหม่
 * - effect รอบแรก: ยังไม่ได้ hydrate ⇒ attribute ถูกตั้งโดยสคริปต์ก่อน paint แล้ว → เก็บ snapshot
 * - effect รอบถัดไป (สลับภาษา/เปลี่ยนหน้า): เขียน snapshot กลับก่อนเบราว์เซอร์วาด
 * - MutationObserver คอยอัปเดต snapshot เมื่อผู้ใช้เปลี่ยนสถานะ (กดยอมรับคุกกี้ · ปิดประกาศ)
 *
 * ⚠️ ต้องเป็น `useLayoutEffect` ฝั่ง client เพื่อเขียนก่อน paint (ไม่ให้แถบคุกกี้วาบ)
 * ⚠️ อยู่ใน iframe พรีวิว = ไม่ต้องกู้คืน เพราะพรีวิวมีสคริปต์/บริบทของตัวเอง
 */
const useBeforePaintEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

let hasSnapshot = false;
let snapshot: DocumentState = {};

export function DocumentStateSync() {
  const pathname = usePathname();

  useBeforePaintEffect(() => {
    if (typeof window === "undefined") return;

    const root = document.documentElement;

    /*
      iframe พรีวิว: สคริปต์ก่อน paint ของพรีวิวเป็นเจ้าของ attribute เอง
      การกู้คืน snapshot จากหน้าเว็บจริงอาจทำให้ป้ายประกาศเด้งทับพรีวิวได้
    */
    if (window.self !== window.top) return;

    if (!hasSnapshot) {
      snapshot = readDocumentState(root);
      hasSnapshot = true;
    } else {
      applyDocumentState(root, snapshot);
    }

    const observer = new MutationObserver(() => {
      snapshot = readDocumentState(root);
    });
    observer.observe(root, {
      attributes: true,
      attributeFilter: [...DOCUMENT_STATE_ATTRIBUTES],
    });

    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
