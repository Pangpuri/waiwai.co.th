import Link from "next/link";

import { SectionCurve } from "@/features/shell/ui/section-curve";
import { localePath, type Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages/th";

import { HERO_SLIDES, type HeroSlideView } from "../slides";
import { HeroSlider } from "./hero-slider";

type HeroProps = {
  readonly locale: Locale;
  readonly messages: Messages;
};

/**
 * Hero หน้าแรก — ภาพสไลด์เต็มความกว้างเป็นฉากหลัง ข้อความ/ปุ่มทับด้านซ้าย
 *
 * แทนผังเดิม (พื้นเหลือง + การ์ดสินค้าแบบวาดทางขวา) ตามที่ผู้ใช้เลือก
 * → การ์ดวาด (PackShot) ยังใช้อยู่ที่ section "สินค้าแนะนำ" ของหน้าแรก
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
    /*
      ความสูงของแถบ hero — ยิ่งสูง ยิ่งเห็นภาพสไลด์มาก (ภาพถูกครอปน้อยลง)
      ปรับได้ที่ min-h-* สามจุดนี้ · ตอนนี้: จอเล็ก 34rem (544px) · lg 44rem (704px) · 2xl 50rem (800px)
      จอที่กว้างกว่า 800px จะเริ่มครอปด้านบน-ล่างอีกครั้ง (ภาพตัวอย่างชุดนี้เป็น 16:9)
    */
    <section className="relative isolate flex min-h-[34rem] items-center overflow-hidden bg-overlay text-on-brand lg:min-h-[44rem] 2xl:min-h-[50rem]">
      <HeroSlider
        slides={slides}
        labels={{
          gallery: m.galleryLabel,
          gotoSlide: m.gotoSlide,
          pause: m.pauseSlides,
          play: m.playSlides,
        }}
      />

      <div className="container-site relative z-10 py-16 lg:py-24">
        {/* ไม่มีฉากมืดทับภาพ → ข้อความใช้เงา (text-shadow-photo) เพื่อให้อ่านออกบนภาพสว่าง */}
        <div className="max-w-xl text-shadow-photo">
          <p className="inline-flex items-center gap-2 rounded-full border border-on-brand/30 bg-overlay/40 px-3.5 py-1.5 text-xs font-bold tracking-[0.16em] uppercase">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-yellow" />
            {m.eyebrow}
          </p>

          <h1 className="mt-6 font-display text-4xl leading-[1.08] font-extrabold tracking-tight text-on-brand sm:text-5xl lg:text-[3.75rem]">
            {m.title}{" "}
            {/* เหลืองคือสีที่แบรนด์ใช้อยู่แล้ว และตัดกับภาพได้ชัดกว่าตัวอักษรขาวล้วน */}
            <span className="text-brand-yellow">{m.titleAccent}</span>
          </h1>

          <p className="mt-6 max-w-lg text-base leading-relaxed text-on-brand/90 sm:text-lg">
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
              className="inline-flex items-center gap-2 rounded-full border-2 border-on-brand/60 px-6 py-3.5 text-sm font-bold backdrop-blur-sm transition-colors hover:bg-on-brand/10"
            >
              {messages.actions.findStore}
            </Link>
          </div>

          <p className="mt-6 text-xs text-on-brand/70">{m.note}</p>
        </div>
      </div>

      {/* ขอบล่างโค้งนุ่ม — สีพื้นของ section ถัดไป (พื้นหน้าเว็บ) */}
      <SectionCurve tone="bg" edge="bottom" />
    </section>
  );
}
