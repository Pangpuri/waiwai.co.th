"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * ภาพสูตรอาหาร + lightbox (รอบ 342)
 *
 * - ภาพย่อ **พอดีความกว้างการ์ด** (`w-full h-auto object-contain`) ไม่ครอปข้อความในภาพ
 * - กดแล้วเปิดดูเต็มจอ (ปิดได้ 3 ทาง: ปุ่มปิด · Esc · คลิกนอกกรอบ) — แบบเดียวกับใบรับรอง
 * - ข้อความทุกตัวรับเป็น prop (ไม่ลากพจนานุกรมทั้งก้อนไป client)
 */
export function RecipeImageLightbox({
  src,
  alt,
  labels,
}: {
  readonly src: string;
  readonly alt: string;
  readonly labels: {
    readonly open: string;
    readonly close: string;
    readonly dialog: string;
  };
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        return;
      }
      /* ในไดอะล็อกมีจุดโฟกัสเดียว (ปุ่มปิด) — ดัก Tab ไม่ให้หลุดไปเนื้อหาข้างหลัง */
      if (event.key === "Tab") {
        event.preventDefault();
        closeButtonRef.current?.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, close]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-label={`${labels.open}: ${alt}`}
        onClick={() => setOpen(true)}
        className="focus-visible:ring-ring block w-full overflow-hidden rounded-xl border border-line bg-bg-subtle p-1 focus-visible:ring-2 focus-visible:outline-none"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} loading="lazy" className="h-auto w-full rounded-lg object-contain" />
      </button>

      {open
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`${labels.dialog}: ${alt}`}
              onClick={close}
              className="bg-overlay fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
            >
              <figure onClick={(event) => event.stopPropagation()} className="relative flex max-h-full max-w-full flex-col items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={alt}
                  className="h-auto max-h-[78vh] w-auto max-w-[92vw] rounded-xl border border-line bg-surface object-contain"
                />
                <figcaption className="text-on-brand mt-3 max-w-[92vw] text-center text-xs leading-relaxed">{alt}</figcaption>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={close}
                  aria-label={labels.close}
                  className="absolute -top-3 -right-3 grid h-10 w-10 place-items-center rounded-full border border-line bg-surface font-bold text-fg shadow-lg"
                >
                  ✕
                </button>
              </figure>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
