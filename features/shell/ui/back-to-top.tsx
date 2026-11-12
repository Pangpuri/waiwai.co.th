"use client";

import { useEffect, useState } from "react";

/**
 * ปุ่ม "กลับขึ้นด้านบน" สำหรับมือถือ (2026-11-12)
 *
 * ทำไมต้องมี: footer มือถือยาว — ผู้ใช้ที่เลื่อนถึงล่างต้องเลื่อนกลับเองไกลมาก
 * - แสดงเฉพาะมือถือ (`sm:hidden`) · ไม่กินพื้นที่ใน layout (fixed)
 * - ปรากฏหลังเลื่อนพ้นช่วงแรก เพื่อไม่บังเนื้อหาตอนเปิดหน้า
 * - `z-40` = อยู่ใต้แถบคุกกี้ (`z-50`) และป้ายประกาศ (`z-[60]`) ⇒ ไม่แย่งการกด
 * - เคารพ `prefers-reduced-motion`: เลื่อนแบบทันทีแทน smooth
 *
 * ⚠️ ข้อความมาจากพจนานุกรม (`actions.backToTop`) — ห้ามพิมพ์ไทยใน .tsx
 */
export function BackToTop({ label }: { readonly label: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 480);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => {
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
      }}
      className="border-line-strong bg-surface-raised text-fg hover:bg-bg-subtle focus-visible:ring-ring fixed right-4 bottom-4 z-40 grid size-11 place-items-center rounded-full border shadow-lg transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none sm:hidden"
    >
      <span aria-hidden="true" className="text-lg leading-none">
        ↑
      </span>
    </button>
  );
}
