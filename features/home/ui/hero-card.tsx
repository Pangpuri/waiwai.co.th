"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  HERO_CARD_ATTRIBUTE,
  HERO_CARD_STATE_MUTED,
  HERO_CARD_STORAGE_KEY,
  heroCardDateStamp,
} from "@/lib/hero-card";

import { HERO_CARD_CLOSE_MS, HERO_CARD_IMAGE } from "../hero-card";

/**
 * การ์ดประกาศเล็ก ๆ แปะมุมขวาล่างของ hero หน้าแรก (ผู้ใช้ขอในรอบที่ 21)
 *
 * กติกาเดียวกับประกาศไว้อาลัย — ทำงานร่วมกับ `lib/hero-card.ts` + `lib/day-mute.ts`:
 *  - **CSS เป็นคนตัดสินว่าแสดงหรือไม่** (attribute บน <html> ที่สคริปต์ก่อน paint ตั้ง)
 *    → การ์ดไม่ "ตุ๊บ" ขึ้นมาหลัง hydrate ซึ่งสำคัญเพราะมันลอยอยู่บนภาพ hero ที่เห็นเป็นอย่างแรก
 *  - ค่าเริ่มต้น: แสดงทุกครั้งที่โหลดหน้า · ติ๊ก "ไม่แสดงอีกในวันนี้" แล้วกดปิด = เงียบถึงสิ้นวันนี้
 *    (พรุ่งนี้กลับมาเอง) · ไม่ติ๊ก = ปิดเฉพาะรอบนี้
 *  - กดปิด: จดตัวเลือกทันที แล้วจางออก (HERO_CARD_CLOSE_MS) ค่อยซ่อน
 *
 * ผัง: จอเล็ก = การ์ดอยู่ในเนื้อเรื่องของ hero (ใต้ข้อความ/ปุ่ม) แนวอนุมานเป็นแถว
 *       จอใหญ่ (lg) = ลอยมุมขวาล่างของ hero เอียงเล็กน้อยเหมือนสติกเกอร์แปะบนภาพ
 *       ทำแบบนี้เพราะบนมือถือไม่มีที่ว่างพอจะวางการ์ดทับข้อความโดยไม่บังปุ่ม CTA
 *
 * ⚠️ **ห้าม return null ตามสถานะที่อ่านจาก DOM** — ตอนนี้ markup ถูก render ฝั่งเซิร์ฟเวอร์เสมอ
 * (ตัวที่ตัดสินคือ CSS) ถ้าเอา useSyncExternalStore มาใช้ตัดสินการ render จะเกิด 2 ปัญหา:
 *   1. ฝั่งเซิร์ฟเวอร์อ่าน DOM ไม่ได้ → ตอบ "ซ่อน" → การ์ดหายไปจาก HTML → CSS เปิดให้ตั้งแต่
 *      ก่อน paint ไม่ได้ (เสียกลไกกันจอวาบทั้งหมด) — เจอจริงตอนตรวจ HTML รอบที่ 21
 *   2. ถ้าให้ฝั่งเซิร์ฟเวอร์ตอบ "แสดง" แทน จะเกิด hydration mismatch กับวันที่ผู้ใช้ปิดไว้แล้ว
 * จึงไม่ต้องใช้ store อ่าน attribute ที่นี่ (ต่างจากหน้าต่างไว้อาลัยที่ต้องรู้สถานะเพื่อล็อกการเลื่อน)
 *
 * a11y: เป็น <aside> ที่มีชื่อจากหัวข้อการ์ด · ปุ่มปิดมี aria-label ว่า "ปิดการ์ดนี้"
 *       · เช็คบ็อกมี <label> ครอบจริง (กดที่ข้อความก็ติ๊กได้)
 *       · ตอนซ่อน CSS ใช้ display: none → ทั้งการ์ดหลุดจากลำดับโฟกัสและจากโปรแกรมอ่านหน้าจอเอง
 */

type HeroCardLabels = {
  readonly title: string;
  readonly body: string;
  readonly link: string;
  readonly close: string;
  readonly muteToday: string;
  readonly alt: string;
};

type HeroCardProps = {
  readonly href: string;
  readonly labels: HeroCardLabels;
};

export function HeroCard({ href, labels }: HeroCardProps) {
  const [isClosing, setIsClosing] = useState(false);
  const [muteToday, setMuteToday] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const close = useCallback(() => {
    try {
      if (muteToday) {
        window.localStorage.setItem(HERO_CARD_STORAGE_KEY, heroCardDateStamp(new Date()));
      } else {
        // ไม่ติ๊ก = ค่าเริ่มต้น "แสดงทุกครั้งที่โหลดหน้า" → ล้างค่าที่อาจค้างจากวันก่อน
        window.localStorage.removeItem(HERO_CARD_STORAGE_KEY);
      }
    } catch {
      // เบราว์เซอร์โหมดส่วนตัวเขียนไม่ได้ — การ์ดยังต้องปิดได้
    }

    setIsClosing(true);
  }, [muteToday]);

  // จางออกให้จบก่อน แล้วค่อยซ่อน (เปลี่ยน attribute → CSS ซ่อนการ์ด)
  useEffect(() => {
    if (!isClosing) return;

    const timer = window.setTimeout(() => {
      document.documentElement.setAttribute(HERO_CARD_ATTRIBUTE, HERO_CARD_STATE_MUTED);
      // การ์ดถูกซ่อนไปแล้ว — ไม่ควรทิ้งโฟกัสค้างไว้บนปุ่มที่มองไม่เห็น
      closeButtonRef.current?.blur();
      setIsClosing(false);
    }, HERO_CARD_CLOSE_MS);

    return () => window.clearTimeout(timer);
  }, [isClosing]);

  return (
    /*
      ตัวครอบทำหน้าที่ "วางตำแหน่ง" อย่างเดียว — ในการ์ดเป็นตัวที่ CSS เปิด/ปิด
      (ถ้าเอา attribute ไปไว้บนตัวครอบ opacity/แอนิเมชันจะชนกันเอง)
    */
    <div className="relative z-20 mt-10 lg:absolute lg:right-0 lg:bottom-0 lg:mt-0">
      <aside
        data-hero-card-panel=""
        data-closing={isClosing ? "" : undefined}
        aria-label={labels.title}
        /*
          ⚠️ ไม่ใส่คลาสมุมเอียง (rotate) ที่นี่ — มุมเอียงตั้งต้น + การ "ยิก" อยู่ที่
          `--hero-card-tilt` / `@keyframes hero-card-wiggle` ใน app/globals.css
          เพราะ keyframes ต้องอ้างมุมเดียวกัน (จอเล็ก 0deg · จอใหญ่ -2deg)
        */
        className="relative flex max-w-sm flex-col gap-3 rounded-2xl border border-line bg-surface/95 p-3 shadow-2xl backdrop-blur-sm lg:w-56 lg:max-w-none lg:gap-0 lg:p-3.5"
      >
        <div className="flex items-center gap-3 lg:flex-col lg:items-stretch lg:gap-0">
          <Image
            src={HERO_CARD_IMAGE.src}
            alt={labels.alt}
            width={HERO_CARD_IMAGE.width}
            height={HERO_CARD_IMAGE.height}
            sizes="(min-width: 1024px) 208px, 80px"
            loading="lazy"
            className="h-20 w-20 shrink-0 rounded-xl object-cover lg:h-auto lg:w-full lg:aspect-4/5"
          />

          <div className="min-w-0 lg:mt-3">
            <p className="font-display text-sm leading-snug font-extrabold text-fg">
              {labels.title}
            </p>
            <p className="mt-1 text-xs leading-snug text-fg-muted">{labels.body}</p>
            <Link
              href={href}
              className="mt-1.5 inline-block text-xs font-bold text-link underline underline-offset-4 transition-colors hover:text-accent"
            >
              {labels.link}
            </Link>
          </div>
        </div>

        {/* แถวควบคุม — จอใหญ่ยกปุ่มปิดไปมุมขวาบนของการ์ด (ลอยเหนือภาพ) */}
        <div className="flex items-center justify-between gap-3 border-t border-line pt-2.5 lg:mt-3">
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-fg-muted">
            <input
              type="checkbox"
              checked={muteToday}
              onChange={(event) => setMuteToday(event.currentTarget.checked)}
              className="h-3.5 w-3.5 shrink-0 accent-brand-red"
            />
            {labels.muteToday}
          </label>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={close}
            aria-label={labels.close}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line bg-surface text-sm font-bold text-fg-muted transition-colors hover:bg-bg-subtle hover:text-fg lg:absolute lg:top-2 lg:right-2 lg:border-on-brand/40 lg:bg-overlay/75 lg:text-on-brand lg:shadow-md lg:hover:bg-overlay lg:hover:text-on-brand"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
      </aside>
    </div>
  );
}
