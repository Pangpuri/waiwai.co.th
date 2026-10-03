"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { GalleryStrings } from "@/features/blocks/render-strings";

/**
 * แกลเลอรี + lightbox ของ "บล็อกแกลเลอรี" (รอบที่ 86) — **Client Component**
 *
 * เขียนเองล้วน ๆ (ไม่เพิ่ม dependency) โดยยึดแบบเดียวกับ `features/about/ui/certification-gallery.tsx`
 * - คลิกภาพ → เปิดไดอะล็อกดูเต็มจอ
 * - ปิดได้ 3 ทาง: ปุ่มปิด · ปุ่ม Esc · คลิกนอกกรอบภาพ (ผู้ใช้คาดหวังครบทั้งสาม)
 * - คืนโฟกัสให้ภาพที่เปิดมา (ผู้ใช้คีย์บอร์ดไม่หลงตำแหน่ง) · ดัก Tab ไว้ในไดอะล็อก · ล็อกการเลื่อนพื้นหลัง
 *
 * ⚠️ รับ "ข้อมูลล้วน" เข้ามา (path/alt/caption) — ไม่ import ตัวเรนเดอร์บล็อก/พจนานุกรมเอง
 *    ⇒ ใช้ได้ทั้งหน้าเว็บจริงและพรีวิวหลังบ้าน (ตัวเรนเดอร์เป็นคนเตรียมข้อมูลให้)
 */

export type GalleryLightboxItem = {
  readonly id: string;
  readonly path: string;
  readonly alt: string;
  readonly caption: string;
};

const GRID_CLASS: Record<2 | 3 | 4, string> = {
  2: "grid gap-4 sm:grid-cols-2",
  3: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid gap-4 sm:grid-cols-2 lg:grid-cols-4",
};

export function GalleryLightbox({
  items,
  columns,
  strings,
}: {
  readonly items: readonly GalleryLightboxItem[];
  readonly columns: 2 | 3 | 4;
  readonly strings: GalleryStrings;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const close = useCallback(() => {
    setOpenIndex(null);
    /* คืนโฟกัสให้ภาพที่เปิดมา — ต้องเรียกหลังปิด จึงทำให้ใน callback เดียวกัน */
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (openIndex === null) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        return;
      }
      /* ในไดอะล็อกมีจุดโฟกัสเดียว (ปุ่มปิด) — ดัก Tab ไม่ให้โฟกัสหลุดไปเนื้อหาข้างหลัง */
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
  }, [openIndex, close]);

  const active = openIndex === null ? null : (items[openIndex] ?? null);

  return (
    <>
      <ul className={GRID_CLASS[columns]}>
        {items.map((item, index) => {
          const label = item.caption.trim() !== "" ? item.caption : item.alt;
          return (
            <li key={item.id}>
              <button
                type="button"
                aria-haspopup="dialog"
                aria-label={`${strings.open}: ${label}`}
                onClick={(event) => {
                  triggerRef.current = event.currentTarget;
                  setOpenIndex(index);
                }}
                className="group focus-visible:ring-ring border-line bg-surface hover:border-line-strong block w-full overflow-hidden rounded-2xl border p-0 focus-visible:ring-2 focus-visible:outline-none"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.path}
                  alt={item.alt}
                  loading="lazy"
                  className="bg-bg-subtle aspect-[4/3] w-full object-cover transition-transform group-hover:scale-[1.02]"
                />
                {item.caption.trim() === "" ? null : (
                  <span className="text-fg-muted block px-3 py-2 text-left text-xs">{item.caption}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {active === null ? null : (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${strings.dialog}: ${active.caption.trim() !== "" ? active.caption : active.alt}`}
          onClick={close}
          className="bg-overlay fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
        >
          {/* หยุดการ bubbling เพื่อไม่ให้คลิกที่ภาพถูกตีความเป็น "กดนอกกรอบ" */}
          <figure onClick={(event) => event.stopPropagation()} className="relative flex max-h-full max-w-full flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={active.path}
              alt={active.alt}
              className="border-line bg-surface h-auto max-h-[78vh] w-auto max-w-[92vw] rounded-xl border object-contain"
            />

            {active.caption.trim() === "" ? null : (
              <figcaption className="text-on-brand mt-3 max-w-[92vw] text-center text-xs leading-relaxed">{active.caption}</figcaption>
            )}

            <button
              ref={closeButtonRef}
              type="button"
              onClick={close}
              aria-label={strings.close}
              className="border-line bg-surface text-fg absolute -top-3 -right-3 grid h-10 w-10 place-items-center rounded-full border font-bold shadow-lg"
            >
              ✕
            </button>
          </figure>
        </div>
      )}
    </>
  );
}
