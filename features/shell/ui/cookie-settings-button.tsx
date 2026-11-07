"use client";

import { useState } from "react";

import { COOKIE_CONSENT_ATTRIBUTE, COOKIE_CONSENT_STORAGE_KEY } from "@/lib/cookie-consent";

/**
 * ปุ่ม "เปลี่ยนการตั้งค่าคุกกี้" บนหน้า /cookie-policy
 *
 * ล้างคำตอบเดิมใน localStorage และถอด attribute บน <html>
 * ⇒ CSS ของแถบคุกกี้จะแสดงแถบอีกครั้งโดยไม่ต้องรีโหลดหน้า
 *
 * ถ้าเบราว์เซอร์บล็อก localStorage ยังต้องถอด attribute ให้แถบกลับมาได้
 * (ผู้ใช้จะเห็นแถบแต่ระบบจำคำตอบข้ามการโหลดครั้งถัดไปไม่ได้ — ตรงกับนโยบาย)
 */
export function CookieSettingsButton({
  label,
  statusLabel,
}: {
  readonly label: string;
  readonly statusLabel: string;
}) {
  const [cleared, setCleared] = useState(false);

  function resetConsent(): void {
    try {
      window.localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY);
    } catch {
      // เบราว์เซอร์โหมดส่วนตัว/บล็อก storage — ยังต้องเปิดแถบให้เลือกใหม่ได้
    }
    document.documentElement.removeAttribute(COOKIE_CONSENT_ATTRIBUTE);
    setCleared(true);
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={resetConsent}
        className="w-fit rounded-full border border-line-strong px-5 py-2.5 text-sm font-semibold text-fg transition-colors hover:bg-bg-subtle focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
      >
        {label}
      </button>
      {cleared ? (
        <p role="status" aria-live="polite" className="text-sm text-fg-muted">
          {statusLabel}
        </p>
      ) : null}
    </div>
  );
}
