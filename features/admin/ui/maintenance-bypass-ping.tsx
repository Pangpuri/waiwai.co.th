"use client";

import { useEffect } from "react";

/**
 * ต่ออายุ "บัตรผ่านดูเว็บระหว่างปิดปรับปรุง" เป็นระยะ (รอบที่ 96)
 *
 * - เรียก `/admin/bypass` ตอนเข้าหน้าหลังบ้านครั้งแรก และทุก 5 นาทีระหว่างใช้งาน
 * - ตัว route เป็นคนตรวจเซสชันกับฐานข้อมูล (proxy ทำไม่ได้ — ห้ามอ่าน DB)
 *   ⇒ ใครถูกเพิกถอน/ถูกปิดบัญชี จะไม่ได้บัตรใบใหม่ และบัตรเก่าตายภายใน ≤ 15 นาที
 * - ⚠️ ล้มเหลว = เงียบสนิท (ต้องไม่รบกวนการทำงานหลังบ้าน) · ใช้ `fetch` แบบ `keepalive` + ไม่แคช
 * - ⚠️ ทำงานเฉพาะเมื่อเปิดโหมดปิดปรับปรุงเท่านั้น (props `enabled`) — ไม่มีประโยชน์ตอนเว็บเปิดปกติ
 */

/** ระยะห่างระหว่างการต่ออายุ (5 นาที) — ต้องน้อยกว่าอายุบัตร (15 นาที) เสมอ */
export const BYPASS_PING_INTERVAL_MS = 5 * 60 * 1000;

export function MaintenanceBypassPing({ enabled }: { readonly enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const ping = async (): Promise<void> => {
      try {
        await fetch("/admin/bypass", { method: "POST", cache: "no-store", credentials: "same-origin" });
      } catch {
        /* เงียบ — เป็นเพียงบัตรผ่าน ไม่ใช่ข้อมูลที่ต้องรับประกัน */
      }
    };

    if (!cancelled) void ping();
    const timer = setInterval(() => {
      if (!cancelled) void ping();
    }, BYPASS_PING_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled]);

  return null;
}
