"use client";

import type { HeroEffect } from "@/lib/hero/model";
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
 *
 * ⚠️ **ไม่มีฉากมืดทับภาพ** (ผู้ใช้สั่งให้เอาออก — ต้องการให้ภาพสว่างเต็มที่)
 *    ความอ่านออกของข้อความจึงพึ่ง `text-shadow-photo` (utility ใน app/globals.css) แทน
 *    ถ้าอนาคตได้ภาพที่สว่างจัดกว่านี้ ทางเลือกคือเปิดฉากมืดเฉพาะด้านซ้ายกลับมา
 */

type HeroSliderLabels = {
  readonly gallery: string;
  readonly gotoSlide: string;
  readonly pause: string;
  readonly play: string;
  /** ป้ายบนสไลด์ที่ยังรอเจ้าของอนุมัติ (รอบที่ 108) */
  readonly sampleBadge: string;
  /** ป้ายบนสไลด์ที่ยังมีลายน้ำของเพจต้นทาง */
  readonly watermarkBadge: string;
};

/** วิวการ์ดแคมเปญที่แปลภาษาแล้ว (ส่งจาก hero.tsx) — รอบที่ 188 */
export type HeroCardView = {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly ctaLabel: string;
  readonly ctaHref: string;
  readonly position: "left" | "center" | "right";
  /** จุดยึดเป็นเปอร์เซ็นต์ของพื้นที่สไลด์ (รอบที่ 190) — ตรงกับที่ลากในหลังบ้าน */
  readonly anchorX?: number;
  /** พาธภาพของการ์ด (รอบที่ 193) — ว่าง = การ์ดข้อความล้วน */
  readonly imagePath?: string;
  /** คำอธิบายภาพ (alt) — ผู้ใช้กรอกในหลังบ้าน · ว่าง = ใช้หัวข้อแทน */
  readonly imageAlt?: string;
  readonly anchorY?: number;
};

type HeroSliderProps = {
  readonly slides: readonly HeroSlideView[];
  readonly labels: HeroSliderLabels;
  /** เอฟเฟคเปลี่ยนภาพ (รอบที่ 185) — ค่ามาจากหลังบ้าน · CSS ที่ `[data-effect=…]` เป็นตัวทำอนิเมชัน */
  readonly effect?: HeroEffect;
  /** เวลาต่อภาพ (มิลลิวินาที) — ค่ามาจากหลังบ้าน */
  readonly intervalMs?: number;
  /** การ์ดแคมเปญของแต่ละสไลด์ (คีย์ = id สไลด์ · ข้อความแปลภาษาแล้ว) — รอบที่ 188 */
  readonly heroCardViews?: Readonly<Record<string, readonly HeroCardView[]>>;
};

export function HeroSlider({ slides, labels, effect = "fade", intervalMs = HERO_SLIDE_INTERVAL_MS, heroCardViews = {} }: HeroSliderProps) {
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
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [paused, total, intervalMs]);

  /* การ์ดของสไลด์ที่กำลังแสดง (ถ้ามี) */
  const activeSlideId = slides[index]?.id ?? "";
  const activeCards = heroCardViews[activeSlideId] ?? [];

  function goTo(next: number) {
    setIndex(advanceIndex(next, total));
  }

  return (
    <>
      <div className="absolute inset-0" data-effect={effect}>
        {slides.map((slide, position) => {
          const isActive = position === index;

          return (
            <div
              key={slide.id}
              data-hero-slide=""
              data-state={isActive ? "active" : "idle"}
              data-review-status={slide.reviewStatus}
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

              {/*
                ป้าย "ภาพตัวอย่างรออนุมัติ" (รอบที่ 108) — แสดงเฉพาะภาพที่ยังไม่ผ่าน
                ผู้ใช้ (เจ้าของ) สั่งว่า "คงไว้ก่อน แต่ทำเครื่องหมายให้ชัด" ⇒ เห็นได้ทันทีตอนตรวจหน้าเว็บ
                ข้อความมาจากพจนานุกรม (สองภาษา) · ป้ายอยู่ในภาพที่ `aria-hidden` อยู่แล้ว
                ⇒ ไม่รบกวนโปรแกรมอ่านหน้าจอ และไม่ถูกอ่านซ้ำ
              */}
              <span className="pointer-events-none absolute top-4 left-4 z-10 inline-flex items-center gap-2 rounded-full bg-overlay/80 px-3 py-1.5 text-xs font-bold text-on-brand">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-yellow" />
                {slide.reviewStatus === "watermarked" ? labels.watermarkBadge : labels.sampleBadge}
              </span>
            </div>
          );
        })}
      </div>

        {/* การ์ดแคมเปญของสไลด์ที่กำลังแสดง (รอบที่ 188) — ตำแหน่งตามที่ตั้งในหลังบ้าน */}
        {activeCards.length > 0 ? (
                    <div className="pointer-events-none absolute inset-0 z-10">
            <div
              /* ตำแหน่งการ์ด: left/top เป็นเปอร์เซ็นต์ + เลื่อนกลับครึ่งหนึ่งของตัวเอง (สูตรเดียวกับพรีวิวหลังบ้าน) */
              style={{
                left: (activeCards[0]?.anchorX ?? 8) + "%",
                top: (activeCards[0]?.anchorY ?? 50) + "%",
                transform: "translate(-" + (activeCards[0]?.anchorX ?? 8) + "%, -" + (activeCards[0]?.anchorY ?? 50) + "%)",
              }}
              className="pointer-events-auto absolute flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 rounded-2xl bg-surface/95 p-4 text-fg shadow-lg sm:max-w-md"
            >
              {activeCards.map((card) => (
                <div key={card.id} className="flex flex-col gap-1">
                  {card.imagePath === undefined || card.imagePath.trim() === "" ? null : (
                    <img src={card.imagePath} alt={card.imageAlt === undefined || card.imageAlt.trim() === "" ? card.title : card.imageAlt} className="mb-1 h-24 w-full rounded-lg object-cover sm:h-28" />
                  )}
                  <p className="text-fg text-base font-bold sm:text-lg">{card.title}</p>
                  {card.body.trim() === "" ? null : <p className="text-fg-muted text-xs sm:text-sm">{card.body}</p>}
                  {card.ctaLabel.trim() === "" || card.ctaHref.trim() === "" ? null : (
                    <a href={card.ctaHref} className="text-brand-red text-sm font-semibold underline underline-offset-2">
                      {card.ctaLabel}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}
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
