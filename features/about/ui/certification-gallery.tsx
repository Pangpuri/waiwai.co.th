"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import type { CertificationCard } from "../certifications";

/**
 * การ์ดใบรับรอง + lightbox
 *
 * เป็น Client Component เพราะต้องมี state (ใบที่เปิดอยู่) และ event ของเบราว์เซอร์
 * ข้อความทุกตัวรับเข้ามาเป็น plain object จาก Server Component แล้ว (ไม่ import พจนานุกรม)
 *
 * วิธีปิด lightbox — ครบทั้งสามทางที่ผู้ใช้คาดหวัง
 *  1. ปุ่มปิด (มุมขวาบน)
 *  2. ปุ่ม Esc
 *  3. กดนอกกรอบภาพ (คลิกที่ฉากมืดรอบ ๆ)
 * พร้อมคืนโฟกัสกลับไปที่การ์ดที่เปิดมา เพื่อไม่ให้ผู้ใช้คีย์บอร์ดหลงตำแหน่ง
 */

type CertificationGalleryLabels = {
  readonly open: string;
  readonly close: string;
  readonly dialog: string;
  readonly issuer: string;
  readonly certificateNo: string;
  readonly site: string;
  readonly validPeriod: string;
};

type CertificationGalleryProps = {
  readonly cards: readonly CertificationCard[];
  readonly labels: CertificationGalleryLabels;
};

export function CertificationGallery({ cards, labels }: CertificationGalleryProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const close = useCallback(() => {
    setOpenIndex(null);
    // คืนโฟกัสให้การ์ดที่เปิดมา — ต้องเรียกหลังปิด จึงทำให้ใน callback เดียวกัน
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (openIndex === null) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        return;
      }

      /*
        ในไดอะล็อกมีจุดโฟกัสเดียว (ปุ่มปิด) — ดัก Tab ไว้ไม่ให้โฟกัสหลุดไปที่
        เนื้อหาหลังฉาก ซึ่งเป็นพฤติกรรมที่ผู้ใช้คีย์บอร์ดจะงง
      */
      if (event.key === "Tab") {
        event.preventDefault();
        closeButtonRef.current?.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    // ล็อกการเลื่อนพื้นหลังระหว่างเปิดภาพ และคืนค่าเดิมเมื่อปิด
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [openIndex, close]);

  const active = openIndex === null ? null : (cards[openIndex] ?? null);

  return (
    <>
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card, index) => (
          <li key={card.id}>
            <button
              type="button"
              aria-haspopup="dialog"
              aria-label={`${labels.open}: ${card.title}`}
              onClick={(event) => {
                triggerRef.current = event.currentTarget;
                setOpenIndex(index);
              }}
              className="group flex h-full w-full flex-col rounded-2xl border border-line bg-surface p-4 text-left transition-colors hover:border-line-strong"
            >
              <span className="relative block aspect-3/4 w-full overflow-hidden rounded-xl border border-line bg-bg-cream">
                <Image
                  src={card.src}
                  alt={card.title}
                  width={card.width}
                  height={card.height}
                  sizes="(min-width: 1024px) 28vw, (min-width: 640px) 44vw, 88vw"
                  className="h-full w-full object-contain"
                />
              </span>

              <span className="mt-4 block font-display text-base font-extrabold text-fg">
                {card.title}
              </span>

              <span className="mt-3 block text-xs leading-relaxed text-fg-muted">
                {labels.issuer}: <span className="font-semibold text-fg">{card.issuer}</span>
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-fg-muted">
                {labels.certificateNo}:{" "}
                <span className="font-semibold text-fg">{card.certificateNo}</span>
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-fg-muted">
                {labels.site}: <span className="font-semibold text-fg">{card.siteLabel}</span>
              </span>
              {card.validLabel ? (
                <span className="mt-1 block text-xs leading-relaxed text-fg-muted">
                  {labels.validPeriod}:{" "}
                  <span className="font-semibold text-fg">{card.validLabel}</span>
                </span>
              ) : null}

              <span aria-hidden="true" className="mt-4 block text-sm font-semibold text-accent">
                {labels.open} →
              </span>
            </button>
          </li>
        ))}
      </ul>

      {active ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${labels.dialog}: ${active.title}`}
          onClick={close}
          className="bg-overlay fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
        >
          {/* หยุดการ bubbling เพื่อไม่ให้คลิกที่ภาพถูกตีความเป็น "กดนอกกรอบ" */}
          <figure
            onClick={(event) => event.stopPropagation()}
            className="relative flex max-h-full max-w-full flex-col items-center"
          >
            <Image
              src={active.src}
              alt={active.title}
              width={active.width}
              height={active.height}
              sizes="90vw"
              className="h-auto max-h-[78vh] w-auto max-w-[92vw] rounded-xl border border-line bg-surface object-contain"
            />

            <figcaption className="text-on-brand mt-3 max-w-[92vw] text-center text-xs leading-relaxed">
              {active.title} · {active.issuer}
            </figcaption>

            <button
              ref={closeButtonRef}
              type="button"
              onClick={close}
              aria-label={labels.close}
              className="absolute -top-3 -right-3 grid h-10 w-10 place-items-center rounded-full border border-line bg-surface font-display text-base font-bold text-fg shadow-lg"
            >
              ✕
            </button>
          </figure>
        </div>
      ) : null}
    </>
  );
}
