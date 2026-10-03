"use client";

import { useEffect, useState } from "react";

import { parseFooterConfig, type FooterConfig } from "@/lib/chrome/footer";
import type { Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages/th";

import { SiteFooter } from "./site-footer";

/**
 * ท้ายเว็บ "สด" สำหรับพรีวิวหลังบ้าน (W3) — กลไกเดียวกับหัวเว็บสด
 *
 * ตัวแก้ท้ายเว็บส่งค่าที่กำลังแก้ (ยังไม่บันทึก) ผ่าน `postMessage` → ตัวนี้ตรวจด้วย `parseFooterConfig`
 * แล้วเรนเดอร์ `SiteFooter` ตัวจริงด้วยค่าใหม่ ⇒ เห็นผลทันที
 *
 * ⚠️ ใช้เฉพาะเส้นทางพรีวิว — หน้าเว็บจริงใช้ SiteFooter ตรง ๆ (ไม่เพิ่ม JS ให้ผู้ชม)
 */
export function SiteFooterLive({
  locale,
  messages,
  initial,
}: {
  readonly locale: Locale;
  readonly messages: Messages;
  readonly initial: FooterConfig | null;
}) {
  const [config, setConfig] = useState<FooterConfig | null>(initial);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (window.parent === window) return;

      const data: unknown = event.data;
      if (typeof data !== "object" || data === null) return;
      const candidate = data as { type?: unknown; config?: unknown };
      if (candidate.type !== "waiwai:footer") return;

      if (candidate.config === null) {
        setConfig(null);
        return;
      }

      const parsed = parseFooterConfig(candidate.config, messages);
      if (parsed.ok) setConfig(parsed.config);
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [messages]);

  return <SiteFooter locale={locale} messages={messages} footer={config} />;
}
