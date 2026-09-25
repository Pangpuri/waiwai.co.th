import Link from "next/link";

import { localePath, type Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages/th";

import { SectionCurve } from "@/features/shell/ui/section-curve";
import { PackShot } from "./pack-shot";

type HeroProps = {
  readonly locale: Locale;
  readonly messages: Messages;
};

export function Hero({ locale, messages }: HeroProps) {
  const m = messages.hero;

  return (
    <section className="relative overflow-hidden bg-brand-yellow text-accent-on-yellow">
      {/* ลายเส้นเฉียงแบบซองบะหมี่ — ตกแต่งเท่านั้น */}
      <div
        aria-hidden="true"
        className="absolute inset-y-0 right-0 hidden w-2/5 bg-stripes-brand opacity-50 [mask-image:linear-gradient(to_right,transparent,black)] lg:block"
      />

      <div className="container-site relative grid gap-12 py-14 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-center lg:gap-16 lg:py-24">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-accent-on-yellow/10 px-3.5 py-1.5 text-xs font-bold tracking-[0.16em] uppercase">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-red" />
            {m.eyebrow}
          </p>

          <h1 className="mt-6 font-display text-4xl leading-[1.08] font-extrabold tracking-tight sm:text-5xl lg:text-[3.75rem]">
            {m.title}{" "}
            {/* แดงบนเหลืองได้ ~4.0:1 จึงใช้กับหัวข้อขนาดใหญ่เท่านั้น (AA large text = 3:1) */}
            <span className="text-brand-red">{m.titleAccent}</span>
          </h1>

          <p className="mt-6 max-w-lg text-base leading-relaxed text-accent-on-yellow/90 sm:text-lg">
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
              className="inline-flex items-center gap-2 rounded-full border-2 border-accent-on-yellow/70 px-6 py-3.5 text-sm font-bold transition-colors hover:bg-accent-on-yellow/10"
            >
              {messages.actions.findStore}
            </Link>
          </div>

          <p className="mt-6 text-xs text-accent-on-yellow/70">{m.note}</p>
        </div>

        <div className="relative mx-auto w-full max-w-xs sm:max-w-sm">
          <PackShot
            tone="red"
            name={messages.products.items.tomYumGoong.name}
            tagline={messages.products.items.tomYumGoong.tagline}
            className="rotate-[-3deg] shadow-2xl"
          />

          {/* ป้ายเล็ก ๆ ให้ภาพดูมีมิติ */}
          <div className="absolute -bottom-4 -left-4 rotate-[6deg] rounded-2xl bg-surface px-4 py-2.5 shadow-lg sm:-left-8">
            <p className="font-display text-sm font-extrabold text-fg">
              {messages.products.eyebrow}
            </p>
            <p className="text-xs text-fg-muted">{messages.products.categories.packet.name}</p>
          </div>
        </div>
      </div>

      {/* ขอบล่างโค้งนุ่ม — สีพื้นของ section ถัดไป (พื้นหน้าเว็บ) */}
      <SectionCurve tone="bg" edge="bottom" />
    </section>
  );
}
