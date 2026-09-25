"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { HERO_SLIDE_INTERVAL_MS, advanceIndex, hasSlideControls } from "@/lib/slideshow";

import type { HeroSlideView } from "../slides";

/**
 * สไลด์ภาพฉากหลังของ hero หน้าแรก
 *
 * ทำไมต้องเป็น Client Component: ต้องมี state (ภาพที่แสดงอยู่ · หยุดชั่วคราว) และ interval
 * ข้อความทุกตัวรับเข้ามาเป็น plain object จาก Server Component แล้ว (ไม่ import พจนานุกรม)
 *
 * วิธีทำ "ค่อย ๆ เลื่อนแล้ววน":
 *  - วางภาพทุกใบซ้อนกันไว้ตั้งแต่แรก แล้วสลับ `data-state` (กฎ CSS อยู่ใน app/globals.css)
 *    → จางข้ามภาพได้เนียน และภาพถูก preload ไว้แล้วจึงไม่มีจังหวะภาพหาย
 *  - ระยะเวลา/ความเร็วการซูมอยู่ใน CSS (`[data-hero-slide]`) ส่วน "จังหวะเปลี่ยนภาพ" อยู่ที่
 *    HERO_SLIDE_INTERVAL_MS ใน lib/slideshow.ts
 *  - ผู้ใช้ที่ขอ reduced-motion: ไม่เลื่อนอัตโนมัติ (ยังกดจุดเลือกภาพเองได้)
 *
 * a11y: ภาพที่ไม่ได้แสดงถูก `aria-hidden` (ไม่ให้โปรแกรมอ่านหน้าจออ่านทับกัน),
 *      มีปุ่มจุดบอกตำแหน่ง + ปุ่มหยุด/เล่นต่อ ตาม WCAG 2.2.2 (เนื้อหาที่เลื่อนเองต้องหยุดได้)
 */

type HeroSliderLabels = {
  readonly gallery: string;
  readonly gotoSlide: string;
  readonly pause: string;
  readonly play: string;
};

type HeroSliderProps = {
  readonly slides: readonly HeroSlideView[];
  readonly labels: HeroSliderLabels;
};

export function HeroSlider({ slides, labels }: HeroSliderProps) {
  const total = slides.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    // ภาพเดียว = ไม่มีอะไรต้องเลื่อน
    if (paused || total <= 1) return;

    // เคารพผู้ใช้ที่ปิดอนิเมชัน — ไม่เลื่อนให้เอง (แต่ยังเลือกภาพเองได้ด้วยปุ่ม)
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = window.setInterval(() => {
      setIndex((current) => advanceIndex(current, total));
    }, HERO_SLIDE_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [paused, total]);

  function goTo(next: number) {
    setIndex(advanceIndex(next, total));
  }

  return (
    <>
      <div className="absolute inset-0">
        {slides.map((slide, position) => {
          const isActive = position === index;

          return (
            <div
              key={slide.id}
              data-hero-slide=""
              data-state={isActive ? "active" : "idle"}
              aria-hidden={!isActive}
              className="absolute inset-0"
            >
              <Image
                src={slide.src}
                alt={slide.alt}
                fill
                sizes="100vw"
                style={{ objectPosition: slide.objectPosition }}
                className="object-cover"
                // ภาพแรกต้องมาถึงก่อน (Next 16 deprecate `priority` แล้ว)
                loading={position === 0 ? "eager" : "lazy"}
                fetchPriority={position === 0 ? "high" : "auto"}
              />
            </div>
          );
        })}

        {/* ฉากมืดให้ข้อความด้านซ้ายอ่านออก — เข้มซ้ายแล้วจางไปทางขวา ไม่ทึบทั้งภาพ */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-linear-to-r from-overlay via-overlay/75 to-overlay/30"
        />
      </div>

      {hasSlideControls(total) ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-8 z-20">
          <div className="container-site flex flex-wrap items-center justify-center gap-3">
            <div
              role="group"
              aria-label={labels.gallery}
              className="pointer-events-auto flex items-center gap-2 rounded-full bg-overlay/70 px-3 py-2.5"
            >
              {slides.map((slide, position) => {
                const isActive = position === index;

                return (
                  <button
                    key={slide.id}
                    type="button"
                    onClick={() => goTo(position)}
                    aria-label={`${labels.gotoSlide} ${position + 1}`}
                    aria-current={isActive}
                    className={[
                      "h-2.5 rounded-full transition-all duration-300",
                      isActive ? "w-8 bg-brand-yellow" : "w-2.5 bg-on-brand/70 hover:bg-on-brand",
                    ].join(" ")}
                  />
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setPaused((current) => !current)}
              aria-pressed={paused}
              className="pointer-events-auto rounded-full bg-overlay/70 px-4 py-2.5 text-xs font-semibold text-on-brand transition-colors hover:bg-overlay"
            >
              {paused ? labels.play : labels.pause}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
