"use client";

import { useEffect, useState } from "react";

import { parseNavbarConfig, type NavbarConfig } from "@/lib/chrome/navbar";
import type { Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages/th";

import { SiteHeader } from "./site-header";

/**
 * หัวเว็บ "สด" สำหรับพรีวิวหลังบ้าน (ผู้ใช้สั่ง รอบที่ 54)
 *
 * *"ทำให้ navbar เป็น hot reload เปลี่ยนแบบเรียลไทม์เมื่อผู้ใช้วางภาพ — ลากภาพไปวางแล้วกดใช้ภาพ
 *   โลโก้ตรง navbar ต้องเปลี่ยนทันที"*
 *
 * วิธีทำ: ตัวแก้ navbar ในหลังบ้านส่งค่าที่กำลังแก้ (ยังไม่บันทึก) ผ่าน `postMessage`
 * → ตัวนี้แปลงด้วย `parseNavbarConfig` (ไม่เชื่อข้อมูลที่ส่งมา แม้มาจากหน้าจอเดียวกัน)
 * → เรนเดอร์ `SiteHeader` ตัวจริงด้วยค่าใหม่ ⇒ พรีวิวเหมือนเว็บจริงและอัปเดตทันที
 *
 * ⚠️ ใช้เฉพาะในเส้นทางพรีวิว (`/[lang]/preview/[page]`) เท่านั้น — หน้าเว็บจริงใช้ SiteHeader ตรง ๆ
 *    (ไม่เพิ่ม JS/เพย์โหลดให้ผู้ชมทั่วไป)
 */
export function SiteHeaderLive({
  locale,
  messages,
  initial,
}: {
  readonly locale: Locale;
  readonly messages: Messages;
  readonly initial: NavbarConfig | null;
}) {
  const [config, setConfig] = useState<NavbarConfig | null>(initial);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      /* รับเฉพาะข้อความจากหน้าต่างแม่ที่โดเมนเดียวกัน */
      if (event.origin !== window.location.origin) return;
      if (window.parent === window) return;

      const data: unknown = event.data;
      if (typeof data !== "object" || data === null) return;
      const candidate = data as { type?: unknown; config?: unknown };
      if (candidate.type !== "waiwai:navbar") return;

      /* ค่า null = กลับไปใช้เมนูเริ่มต้นในโค้ด */
      if (candidate.config === null) {
        setConfig(null);
        return;
      }

      const parsed = parseNavbarConfig(candidate.config, messages);
      if (parsed.ok) setConfig(parsed.config);
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [messages]);

  return <SiteHeader locale={locale} messages={messages} navbar={config} />;
}
