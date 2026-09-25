import Link from "next/link";

import { SectionCurve } from "@/features/shell/ui/section-curve";
import { localePath, type Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages/th";

import { HERO_CARD_HREF } from "../hero-card";
import { HERO_SLIDES, type HeroSlideView } from "../slides";
import { HeroCard } from "./hero-card";
import { HeroSlider } from "./hero-slider";

type HeroProps = {
  readonly locale: Locale;
  readonly messages: Messages;
};

/**
 * Hero หน้าแรก — **แถบภาพสไลด์เต็มความกว้าง และข้อความอยู่ใต้ภาพ** (ไม่ทับกัน)
 *
 * รอบที่ 21: การตลาดขอให้ย้ายข้อความลงมาใต้สไลด์ เพราะเดิมข้อความทับอยู่บนภาพ
 * (อ่านยาก และบังสินค้าในภาพ) → hero จึงแบ่งเป็น 2 ชั้นชัดเจน
 *   1. **แถบภาพ** — สไลด์ + เนินโค้ง + การ์ดประกาศที่แปะอยู่บนภาพ
 *   2. **บล็อกข้อความ** — อยู่บนพื้นหน้าเว็บปกติ (สีจึงเป็นสีของพื้น ไม่ใช่สีบนภาพ)
 *
 * ผลที่ตามมาโดยตั้งใจ:
 *  - ข้อความไม่ต้องใช้เงา/ออร่าช่วยอ่านบนภาพอีก → ถอด `text-shadow-photo` และ `text-glow-soft`
 *    ออกจาก globals.css (ค่าอยู่ในประวัติ git ถ้าจะกลับไปทับบนภาพอีกครั้ง)
 *  - สีข้อความบนพื้นสว่าง/มืดต้องผ่านคอนทราสต์ทั้งสองโหมด → มีเทสต์คุมใน scripts/test-hero-contrast.ts
 *
 * เป็น Server Component: ประกอบข้อความ alt จากพจนานุกรมแล้วส่งข้อมูลธรรมดาเข้า Client Component
 */
export function Hero({ locale, messages }: HeroProps) {
  const m = messages.hero;

  const slides: readonly HeroSlideView[] = HERO_SLIDES.map((slide) => ({
    ...slide,
    alt: m.slides[slide.id].alt,
  }));

  return (
    <section className="relative isolate bg-bg">
      {/*
        ── ชั้นที่ 1: แถบภาพสไลด์ ────────────────────────────────────────────────
        ความสูง: จอเล็ก 24rem (384px) · lg 36rem (576px) — ปรับได้ที่ min-h-* สองจุดนี้
        (เดิม 34rem/44rem สูงเพราะมีข้อความอยู่ในแถบ · ย้ายข้อความออกแล้วจึงลดลง)
        ⚠️ แถบยิ่งเตี้ย ภาพยิ่งถูกครอปมาก (ภาพเป็น 16:9/2:1) — สเปกภาพอยู่ใน README
      */}
      <div className="relative min-h-[24rem] overflow-hidden bg-overlay text-on-brand lg:min-h-[36rem]">
        <HeroSlider
          slides={slides}
          labels={{
            gallery: m.galleryLabel,
            gotoSlide: m.gotoSlide,
            pause: m.pauseSlides,
            play: m.playSlides,
          }}
        />

        {/*
          การ์ดประกาศ — "สติกเกอร์บนภาพ" ตามที่ผู้ใช้เลือก (รอบที่ 21)
          · จอใหญ่: มุมขวาล่างของแถบภาพ (ตรงกับขอบ container ในแนวตั้ง)
          · จอเล็ก: ลอยมุมล่างของภาพ แต่ยกขึ้นให้พ้นจุดบอกตำแหน่งสไลด์ (bottom-24)
          ตัวครอบเป็น pointer-events-none เพื่อไม่ให้บังการกดสไลด์/ปุ่มของ slider
        */}
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-20 sm:bottom-20 lg:bottom-10">
          <div className="container-site relative">
            <HeroCard
              href={localePath(locale, HERO_CARD_HREF)}
              labels={{
                title: m.card.title,
                body: m.card.body,
                link: m.card.link,
                close: m.card.close,
                muteToday: m.card.muteToday,
                alt: m.card.alt,
              }}
            />
          </div>
        </div>

        {/* ขอบล่างโค้งนุ่ม — สีพื้นของส่วนถัดไป (พื้นหน้าเว็บ) */}
        <SectionCurve tone="bg" edge="bottom" />
      </div>

      {/*
        ── ชั้นที่ 2: ข้อความ ─────────────────────────────────────────────────────
        อยู่บนพื้นหน้าเว็บ → ใช้ token ของพื้น (fg · fg-muted · accent) ไม่ใช่สีบนภาพ
        สีหัวข้อ: คำหลัก = แดงแบรนด์ · คำรอง = แดงเข้ม (--accent ซึ่งสลับสีให้เองในโหมดมืด)
      */}
      <div className="container-site py-12 lg:py-16">
        <div className="max-w-3xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-bg-subtle px-3.5 py-1.5 text-xs font-bold tracking-[0.16em] text-fg-muted uppercase">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-red" />
            {m.eyebrow}
          </p>

          {/*
            คอนทราสต์ที่วัดจริง (ดู scripts/test-hero-contrast.ts):
              คำหลัก แดงแบรนด์  → พื้นสว่าง 4.80:1 · พื้นมืด 3.92:1 (ผ่านเกณฑ์ตัวอักษรใหญ่ 3:1)
              คำรอง  แดงเข้ม    → พื้นสว่าง 5.88:1 · พื้นมืด 6.79:1
            ⚠️ ห้ามใช้สีเหลืองแบรนด์กับข้อความบนพื้นสว่าง — ให้เพียง ~1.4:1 (อ่านไม่ออก)
          */}
          <h1 className="mt-6 font-display text-4xl leading-[1.08] font-extrabold tracking-tight text-brand-red sm:text-5xl lg:text-[3.75rem]">
            {m.title} <span className="text-accent">{m.titleAccent}</span>
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-relaxed text-fg-muted sm:text-lg">
            {m.body}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href={localePath(locale, "/products")}
              className="inline-flex items-center gap-2 rounded-full bg-brand-red px-6 py-3.5 text-sm font-bold text-on-brand shadow-sm transition-transform hover:-translate-y-0.5"
            >
              {messages.actions.viewProducts}
              <span aria-hidden="true">→</span>
            </Link>

            <Link
              href={localePath(locale, "/where-to-buy")}
              className="inline-flex items-center gap-2 rounded-full border-2 border-line-strong px-6 py-3.5 text-sm font-bold text-fg transition-colors hover:bg-bg-subtle"
            >
              {messages.actions.findStore}
            </Link>
          </div>

          <p className="mt-6 text-xs text-fg-muted">{m.note}</p>
        </div>
      </div>
    </section>
  );
}
