"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
  MOURNING_ATTRIBUTE,
  MOURNING_STATE_MUTED,
  MOURNING_STATE_SHOWN,
  MOURNING_STORAGE_KEY,
  mourningDateStamp,
} from "@/lib/mourning-notice";
import { advanceIndex, hasSlideControls } from "@/lib/slideshow";

import { MOURNING_CLOSE_MS, type MourningImageView } from "../mourning";

/**
 * หน้าต่างประกาศไว้อาลัย — เด้งทุกครั้งที่โหลดหน้า (ค่าเริ่มต้น)
 *
 * ทำงานร่วมกับ lib/mourning-notice.ts (สคริปต์ก่อน paint + attribute บน <html>):
 *  - **CSS เป็นคนตัดสินว่าแสดงหรือไม่** (ดู app/globals.css) → ไม่มีอาการวาบ และไม่ต้องรอ hydrate
 *  - สถานะ "กำลังแสดงอยู่ไหม" อ่านจาก attribute บน <html> ด้วย useSyncExternalStore
 *    (ไม่ใช้ useEffect + setState ซึ่งทำให้เกิด cascading render) และเฝ้าการเปลี่ยนแปลงด้วย
 *    MutationObserver → พอปิดเสร็จแล้วเปลี่ยน attribute ตัวเก็บกวาดของ effect จะทำงานเอง
 *  - กดปิด: จดตัวเลือก "ไม่แสดงอีกในวันนี้" ทันที แล้วติด `data-closing` ให้ CSS จางออกก่อน
 *    (MOURNING_CLOSE_MS) ค่อยเปลี่ยน attribute → ผู้ใช้เห็นภาพค่อย ๆ หาย ไม่ใช่หายวับ
 *  - ติ๊ก "ไม่แสดงอีกในวันนี้" = เก็บ "วันที่ที่ปิด" ไว้เทียบกับวันที่ของเครื่องผู้ใช้ (เวลาท้องถิ่น)
 *    พอขึ้นวันใหม่หน้าต่างจะกลับมาเองโดยไม่ต้องมีใครล้างค่า
 *
 * a11y: role=dialog + aria-modal · โฟกัสย้ายเข้าปุ่มปิด · Tab วนอยู่ในหน้าต่าง · Esc ปิดได้
 *      · ลูกศรซ้าย/ขวาเปลี่ยนภาพ · มี aria-live ให้โปรแกรมอ่านหน้าจอรู้ว่าเปลี่ยนภาพแล้ว
 *      · เช็คบ็อกมี <label> ครอบจริง (กดที่ข้อความก็ติ๊กได้)
 */

type MourningNoticeLabels = {
  readonly dialogLabel: string;
  readonly caption: string;
  readonly close: string;
  readonly muteToday: string;
  readonly prev: string;
  readonly next: string;
  readonly gotoSlide: string;
};

type MourningNoticeProps = {
  readonly images: readonly MourningImageView[];
  readonly labels: MourningNoticeLabels;
};

/* ── แหล่งความจริงเดียวของ "หน้าต่างเปิดอยู่ไหม" คือ attribute บน <html> ─────────── */

function subscribeToMourningAttribute(onStoreChange: () => void): () => void {
  if (typeof MutationObserver === "undefined") return () => {};

  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: [MOURNING_ATTRIBUTE],
  });

  return () => observer.disconnect();
}

function readIsShown(): boolean {
  return document.documentElement.getAttribute(MOURNING_ATTRIBUTE) === MOURNING_STATE_SHOWN;
}

/** ฝั่งเซิร์ฟเวอร์ไม่มี DOM — และ CSS จะไม่เปิดหน้าต่างจนกว่าสคริปต์ก่อน paint จะติด attribute */
function readIsShownOnServer(): boolean {
  return false;
}

export function MourningNotice({ images, labels }: MourningNoticeProps) {
  const total = images.length;
  const isShown = useSyncExternalStore(
    subscribeToMourningAttribute,
    readIsShown,
    readIsShownOnServer,
  );
  const [isClosing, setIsClosing] = useState(false);
  const [muteToday, setMuteToday] = useState(false);
  const [index, setIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  // ระหว่างจางออกยังต้องล็อกการเลื่อนไว้ ไม่งั้นพื้นหลังจะเลื่อนตามนิ้วระหว่างที่ภาพยังไม่หาย
  const isOpen = isShown && !isClosing;

  /*
    จดตัวเลือกของผู้ใช้ "ตอนกดปิด" ไม่ใช่ตอนจางเสร็จ — ถ้าผู้ใช้ปิดแท็บระหว่างที่ภาพยังจางอยู่
    ตัวเลือกจะได้ไม่หายไป (เขียน storage สำเร็จแล้วตั้งแต่ตอนคลิก)
  */
  const close = useCallback(() => {
    try {
      if (muteToday) {
        window.localStorage.setItem(MOURNING_STORAGE_KEY, mourningDateStamp(new Date()));
      } else {
        // ไม่ติ๊ก = ค่าเริ่มต้น "แสดงทุกครั้งที่โหลดหน้า" → ล้างค่าที่อาจค้างจากวันก่อน
        window.localStorage.removeItem(MOURNING_STORAGE_KEY);
      }
    } catch {
      // เบราว์เซอร์โหมดส่วนตัวเขียนไม่ได้ — ยังต้องปิดหน้าต่างให้ผู้ใช้ใช้งานเว็บต่อได้
    }

    setIsClosing(true);
  }, [muteToday]);

  // จางออกให้จบก่อน แล้วค่อยซ่อน (เปลี่ยน attribute)
  useEffect(() => {
    if (!isClosing) return;

    const timer = window.setTimeout(() => {
      // การเปลี่ยน attribute จะทำให้ useSyncExternalStore อัปเดต → CSS ซ่อนหน้าต่าง และ effect ถูกเก็บกวาด
      document.documentElement.setAttribute(MOURNING_ATTRIBUTE, MOURNING_STATE_MUTED);
      // หน้าต่างถูกซ่อนไปแล้ว — ไม่ควรทิ้งโฟกัสค้างไว้บนปุ่มที่มองไม่เห็น
      closeButtonRef.current?.blur();
      setIsClosing(false);
    }, MOURNING_CLOSE_MS);

    return () => window.clearTimeout(timer);
  }, [isClosing]);

  // ล็อกการเลื่อนพื้นหลังตลอดเวลาที่หน้าต่างยังอยู่บนจอ (รวมระหว่างจางออก)
  // ถ้าปลดล็อกตั้งแต่เริ่มจาง พื้นหลังจะกระตุกตอนแถบเลื่อนโผล่กลับมาระหว่างที่ภาพยังไม่หาย
  useEffect(() => {
    if (!isShown) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isShown]);

  // คีย์ลัดใช้เฉพาะตอน "เปิดอยู่จริง" — ระหว่างจางออกกด Esc/ลูกศรไปก็ไม่มีประโยชน์
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }

      if (event.key === "ArrowLeft" && hasSlideControls(total)) {
        event.preventDefault();
        setIndex((current) => advanceIndex(current, total, -1));
        return;
      }

      if (event.key === "ArrowRight" && hasSlideControls(total)) {
        event.preventDefault();
        setIndex((current) => advanceIndex(current, total));
        return;
      }

      /*
        หน้าต่างนี้เป็น modal — โฟกัสต้องไม่หลุดไปที่เนื้อหาข้างหลัง
        วนกลับไปจุดแรก/จุดสุดท้ายของสิ่งที่โฟกัสได้ในหน้าต่าง
        (ปุ่มก่อนหน้า/ถัดไป · เช็คบ็อก · ปุ่มปิด)
      */
      if (event.key === "Tab") {
        const node = dialogRef.current;
        if (!node) return;

        const focusables = Array.from(
          node.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled])"),
        );
        const first = focusables.at(0) ?? null;
        const last = focusables.at(-1) ?? null;
        if (!first || !last) return;

        const active = document.activeElement;
        const inside = active instanceof Node && node.contains(active);

        if (event.shiftKey && (!inside || active === first)) {
          event.preventDefault();
          last.focus();
          return;
        }

        if (!event.shiftKey && (!inside || active === last)) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, total, close]);

  const active = total > 0 ? (images[advanceIndex(index, total)] ?? null) : null;
  if (!active) return null;

  return (
    <div
      ref={dialogRef}
      data-mourning-notice=""
      data-closing={isClosing ? "" : undefined}
      role="dialog"
      aria-modal="true"
      aria-label={labels.dialogLabel}
      className="fixed inset-0 z-[60] place-items-center bg-overlay p-4 sm:p-6"
    >
      <div data-mourning-panel="" className="flex w-full flex-col items-center">
        <figure className="flex w-full flex-col items-center" aria-live="polite">
          {/*
            รูปกว้างเต็มจอ (ผู้ใช้เลือก "เต็มจอแบบมีขอบ" รอบที่ 21) — เหลือขอบดำจาก p-4/p-6 ของฉากหลัง
            วิธีวาง (คัดจาก lightbox ใบรับรองที่ทำงานอยู่แล้ว):
            - กล่อง `relative` ข้างในโหลดขนาดตามรูป → ปุ่มลูกศรอยู่ตรงขอบรูปพอดี ไม่ลอยไปขอบจอ
            - การ์ด (มุมโค้ง/ขอบ/พื้น) อยู่บนตัว <img> ไม่ใช่บนกล่อง → ไม่มีแถบพื้นโผล่ข้างรูป
            - `max-w-[calc(100vw-2rem)]` อ้างความกว้าง "วิวพอร์ต" ไม่ใช่อ้างกล่องแม่
              → เลี่ยงปัญหาเปอร์เซ็นต์อ้างพ่อที่ความกว้างยังไม่รู้ค่า (กรณีรูปถูกจำกัดด้วยความสูง)
            - `max-h-[72vh]` กันจอเตี้ยแต่กว้าง (เช่น 2560×800) ที่รูปจะสูงจนปุ่มปิดล้นจอ
              → ความสูงชนเพดานเมื่อไหร่ ความกว้างถอยตามสัดส่วนเอง (3:1 เสมอ)
          */}
          <div className="relative">
            <Image
              src={active.src}
              alt={active.alt}
              width={active.width}
              height={active.height}
              sizes="100vw"
              loading="eager"
              className="block h-auto max-h-[72vh] w-auto max-w-[calc(100vw-2rem)] rounded-2xl border border-line-strong bg-surface sm:max-w-[calc(100vw-3rem)]"
            />

            {hasSlideControls(total) ? (
              <>
                <button
                  type="button"
                  onClick={() => setIndex((current) => advanceIndex(current, total, -1))}
                  aria-label={labels.prev}
                  className="absolute top-1/2 left-3 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-overlay/70 text-lg font-bold text-on-brand transition-colors hover:bg-overlay"
                >
                  <span aria-hidden="true">‹</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIndex((current) => advanceIndex(current, total))}
                  aria-label={labels.next}
                  className="absolute top-1/2 right-3 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-overlay/70 text-lg font-bold text-on-brand transition-colors hover:bg-overlay"
                >
                  <span aria-hidden="true">›</span>
                </button>
              </>
            ) : null}
          </div>

          <figcaption className="mt-4 max-w-3xl px-2 text-center text-sm leading-relaxed text-on-brand/85">
            {labels.caption}
          </figcaption>
        </figure>

        {hasSlideControls(total) ? (
          <div
            role="group"
            aria-label={labels.dialogLabel}
            className="mt-5 flex items-center gap-2"
          >
            {images.map((image, position) => {
              const isActive = position === index;

              return (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => setIndex(position)}
                  aria-label={`${labels.gotoSlide} ${position + 1}`}
                  aria-current={isActive}
                  className={[
                    "h-2.5 rounded-full transition-all duration-300",
                    isActive ? "w-8 bg-brand-yellow" : "w-2.5 bg-on-brand/60 hover:bg-on-brand",
                  ].join(" ")}
                />
              );
            })}
          </div>
        ) : null}

        <button
          ref={closeButtonRef}
          type="button"
          onClick={close}
          className="mt-6 rounded-full bg-brand-red px-7 py-3.5 text-sm font-bold text-on-brand shadow-lg transition-transform hover:-translate-y-0.5"
        >
          {labels.close}
        </button>

        {/*
          ตัวเลือก "ไม่แสดงอีกในวันนี้" — ไม่ติ๊กไว้เป็นค่าเริ่มต้น (ผู้ใช้เลือกกติกานี้)
          ถ้าติ๊กตอนกดปิด → เก็บ "วันที่ที่ปิด" ไว้ แล้ววันถัดไปหน้าต่างกลับมาเอง
          <label> ครอบ input จริง → กดที่ข้อความก็ติ๊กได้ และโปรแกรมอ่านหน้าจออ่านชื่อให้
        */}
        <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-sm text-on-brand/85">
          <input
            type="checkbox"
            checked={muteToday}
            onChange={(event) => setMuteToday(event.currentTarget.checked)}
            className="h-4 w-4 shrink-0 accent-brand-yellow"
          />
          {labels.muteToday}
        </label>
      </div>
    </div>
  );
}
