"use client";

import { useEffect, useState } from "react";

/**
 * ตัวแจ้งผลการบันทึกของหลังบ้าน — **เป็นหน้าต่างลอยมุมจอ ไม่ดันเนื้อหา**
 *
 * ที่มา (คำเจ้าของ 2026-11-09): หลังกดเพิ่ม/ลบสไลด์หรือบันทึกส่วนอื่น ข้อความผลลัพธ์
 * เดิมไปโผล่ที่หัวหน้า ⇒ ต้องเลื่อนขึ้นไปอ่านแล้วเลื่อนกลับลงมาทำงานต่อ
 *
 * กติกา
 * - `AdminToastHost` ถูก mount **ครั้งเดียว** ใน `app/admin/layout.tsx`
 * - ฟอร์ม/หน้าจอที่อยากแจ้งผลเรียกผ่าน `<AdminToast message=… />` (client) หรือ
 *   `notifyAdminToast()` จาก event handler
 * - ข้อความมาจากพจนานุกรมของหน้าจอนั้น ๆ (ไฟล์นี้ไม่พิมพ์ข้อความผู้ใช้เอง)
 * - สำเร็จ/ข้อมูล = ปิดเองใน 8 วินาที · ผิดพลาด = อยู่จนกดปิด (ผู้ใช้ต้องอ่านทัน)
 */

export type AdminToastTone = "success" | "error" | "info";

type ToastPayload = {
  readonly message: string;
  readonly tone?: AdminToastTone;
};

type ToastState = {
  readonly id: number;
  readonly message: string;
  readonly tone: AdminToastTone;
};

export const ADMIN_TOAST_EVENT = "waiwai:admin-toast";

/** ยิงข้อความขึ้น toast จากที่ใดก็ได้ในฝั่ง client */
export function notifyAdminToast(message: string, tone: AdminToastTone = "success"): void {
  const text = message.trim();
  if (typeof window === "undefined" || text === "") return;
  /*
    เลื่อนไป dispatch หลัง effect รอบนี้จบ — กันกรณี `AdminToast` (ลูก) ทำงานก่อน
    `AdminToastHost` (layout) ติด listener แล้วข้อความแรกหาย (เช่น เพิ่ง redirect กลับมา)
  */
  window.setTimeout(() => {
    window.dispatchEvent(
      new CustomEvent<ToastPayload>(ADMIN_TOAST_EVENT, {
        detail: { message: text, tone },
      }),
    );
  }, 0);
}

/**
 * ใช้ในหน้า/ฟอร์มที่มีข้อความผลลัพธ์อยู่แล้ว — ไม่เรนเดอร์อะไรบนหน้า
 * ⚠️ ต้องเป็น client component (ไฟล์นี้มี "use client" แล้ว)
 */
export function AdminToast({
  message,
  tone = "success",
  trigger,
}: {
  readonly message: string;
  readonly tone?: AdminToastTone;
  /**
   * ค่าที่เปลี่ยนทุกครั้งที่ action ทำงาน (เช่น `state` จาก `useActionState`)
   * ⇒ ข้อความเดิมที่กดซ้ำ (เช่น "บันทึกแล้ว" สองครั้ง) ยังเด้งใหม่ได้
   * ไม่ส่ง = ใช้เฉพาะตอนข้อความเปลี่ยน (เพียงพอสำหรับหน้าที่ redirect/reload)
   */
  readonly trigger?: unknown;
}) {
  useEffect(() => {
    notifyAdminToast(message, tone);
  }, [message, tone, trigger]);

  return null;
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}

export function AdminToastHost({ dismissLabel }: { readonly dismissLabel: string }) {
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    function onToast(event: Event) {
      const detail = (event as CustomEvent<ToastPayload>).detail;
      if (detail === undefined || typeof detail.message !== "string") return;
      const message = detail.message.trim();
      if (message === "") return;

      const tone = detail.tone ?? "success";
      setToast((current) => {
        /* ข้อความเดิมที่ยังแสดงอยู่ = ไม่ต้องเด้งซ้ำ (หลายฟอร์มอาจรายงานผลพร้อมกัน) */
        if (current !== null && current.message === message && current.tone === tone) return current;
        return { id: Date.now(), message, tone };
      });
    }

    window.addEventListener(ADMIN_TOAST_EVENT, onToast);
    return () => window.removeEventListener(ADMIN_TOAST_EVENT, onToast);
  }, []);

  /* สำเร็จ/ข้อมูล = ปิดเอง · ผิดพลาด = ค้างไว้จนกดปิด */
  useEffect(() => {
    if (toast === null || toast.tone === "error") return;
    const timer = window.setTimeout(() => setToast(null), 8000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (toast === null) return null;

  const failed = toast.tone === "error";

  return (
    <div
      className="pointer-events-none fixed inset-x-3 bottom-3 z-[100] flex justify-center sm:inset-x-auto sm:right-5 sm:bottom-5 sm:justify-end"
      data-admin-toast=""
    >
      <div
        key={toast.id}
        role={failed ? "alert" : "status"}
        aria-live={failed ? "assertive" : "polite"}
        className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg ${
          failed ? "border-brand-red bg-surface text-fg" : "border-line-strong bg-surface text-fg"
        }`}
      >
        <p className="min-w-0 flex-1 leading-relaxed font-semibold">{toast.message}</p>
        <button
          type="button"
          aria-label={dismissLabel}
          onClick={() => setToast(null)}
          className="text-fg-muted hover:text-fg focus-visible:ring-ring -mt-1 -mr-1 shrink-0 rounded-md p-1 focus-visible:ring-2 focus-visible:outline-none"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}
