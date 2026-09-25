"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
  MOURNING_ATTRIBUTE,
  MOURNING_STATE_DISMISSED,
  MOURNING_STATE_SHOWN,
  MOURNING_STORAGE_KEY,
} from "@/lib/mourning-notice";
import { advanceIndex, hasSlideControls } from "@/lib/slideshow";

import { MOURNING_CLOSE_MS, type MourningImageView } from "../mourning";

/**
 * หน้าต่างประกาศไว้อาลัย — เด้งครั้งเดียวเมื่อเข้าเว็บ
 *
 * ทำงานร่วมกับ lib/mourning-notice.ts (สคริปต์ก่อน paint + attribute บน <html>):
 *  - **CSS เป็นคนตัดสินว่าแสดงหรือไม่** (ดู app/globals.css) → ไม่มีอาการวาบ และไม่ต้องรอ hydrate
 *  - สถานะ "กำลังแสดงอยู่ไหม" อ่านจาก attribute บน <html> ด้วย useSyncExternalStore
 *    (ไม่ใช้ useEffect + setState ซึ่งทำให้เกิด cascading render) และเฝ้าการเปลี่ยนแปลงด้วย
 *    MutationObserver → พอปิดเสร็จแล้วเปลี่ยน attribute ตัวเก็บกวาดของ effect จะทำงานเอง
 *  - กดปิด: ติด `data-closing` ให้ CSS จางออกก่อน (MOURNING_CLOSE_MS) แล้วค่อยบันทึกว่าปิดแล้ว
 *    → ผู้ใช้เห็นภาพค่อย ๆ หาย ไม่ใช่หายวับ
 *
 * a11y: role=dialog + aria-modal · โฟกัสย้ายเข้าปุ่มปิด · Tab วนอยู่ในหน้าต่าง · Esc ปิดได้
 *      · ลูกศรซ้าย/ขวาเปลี่ยนภาพ · มี aria-live ให้โปรแกรมอ่านหน้าจอรู้ว่าเปลี่ยนภาพแล้ว
 */

type MourningNoticeLabels = {
  readonly dialogLabel: string;
  readonly caption: string;
  readonly close: string;
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
  const [index, setIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  // ระหว่างจางออกยังต้องล็อกการเลื่อนไว้ ไม่งั้นพื้นหลังจะเลื่อนตามนิ้วระหว่างที่ภาพยังไม่หาย
  const isOpen = isShown && !isClosing;

  const close = useCallback(() => {
    setIsClosing(true);
  }, []);

  // จางออกให้จบก่อน แล้วค่อยจำว่าผู้ใช้ปิดแล้ว
  useEffect(() => {
    if (!isClosing) return;

    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(MOURNING_STORAGE_KEY, MOURNING_STATE_DISMISSED);
      } catch {
        // เบราว์เซอร์โหมดส่วนตัวเขียนไม่ได้ — ยังต้องปิดหน้าต่างให้ผู้ใช้ใช้งานเว็บต่อได้
      }
      // การเปลี่ยน attribute จะทำให้ useSyncExternalStore อัปเดต → CSS ซ่อนหน้าต่าง และ effect ถูกเก็บกวาด
      document.documentElement.setAttribute(MOURNING_ATTRIBUTE, MOURNING_STATE_DISMISSED);
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
        วนกลับไปจุดแรก/จุดสุดท้ายของปุ่มที่อยู่ในหน้าต่าง (ปิด · ก่อนหน้า · ถัดไป)
      */
      if (event.key === "Tab") {
        const node = dialogRef.current;
        if (!node) return;

        const focusables = Array.from(node.querySelectorAll<HTMLElement>("button:not([disabled])"));
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
      <div data-mourning-panel="" className="flex w-full max-w-3xl flex-col items-center">
        <figure className="w-full" aria-live="polite">
          <div className="relative w-full overflow-hidden rounded-2xl border border-line-strong bg-surface">
            <Image
              src={active.src}
              alt={active.alt}
              width={active.width}
              height={active.height}
              sizes="(min-width: 768px) 768px, 92vw"
              loading="eager"
              className="h-auto w-full"
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

          <figcaption className="mt-4 text-center text-sm leading-relaxed text-on-brand/85">
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
      </div>
    </div>
  );
}
