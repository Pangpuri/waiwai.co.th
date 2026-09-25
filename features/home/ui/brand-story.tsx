import Link from "next/link";

import { localePath, type Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages/th";

import { WORDMARK } from "@/features/shell/ui/brand-mark";
import { SectionCurve } from "@/features/shell/ui/section-curve";
import { BRAND_STAT_ORDER } from "../content";

type BrandStoryProps = {
  readonly locale: Locale;
  readonly messages: Messages;
};

export function BrandStory({ locale, messages }: BrandStoryProps) {
  const m = messages.brand;

  return (
    <section className="relative bg-bg-cream">
      {/* ขอบบนโค้งนุ่ม — เนินของแถบนี้ยื่นขึ้นไปในพื้นที่ว่างของ section ด้านบน */}
      <SectionCurve tone="bg-cream" edge="top" />

      <div className="container-site grid gap-12 py-16 lg:grid-cols-2 lg:items-center lg:gap-20 lg:py-24">
        {/* แผงภาพตกแต่ง — ยังไม่มีภาพถ่ายจริง */}
        <div
          aria-hidden="true"
          className="relative order-last aspect-4/3 overflow-hidden rounded-3xl bg-brand-yellow lg:order-first"
        >
          <div className="absolute inset-y-0 right-0 w-1/2 bg-stripes-brand opacity-60 [mask-image:linear-gradient(to_right,transparent,black)]" />
          <div className="absolute inset-0 grid place-items-center">
            <span className="font-display text-[5rem] leading-none font-extrabold text-brand-red sm:text-[7rem]">
              {WORDMARK.thai}
            </span>
          </div>
          <div className="absolute bottom-5 left-5 rounded-2xl bg-surface/95 px-4 py-3 shadow-lg">
            <p className="font-display text-xs font-bold tracking-[0.18em] text-fg-muted uppercase">
              {m.eyebrow}
            </p>
            <p className="mt-1 font-display text-base font-extrabold text-fg">
              {messages.meta.siteName}
            </p>
          </div>
        </div>

        <div>
          <p className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.18em] text-accent uppercase">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-red" />
            {m.eyebrow}
          </p>

          <h2 className="mt-3 font-display text-3xl leading-tight font-extrabold tracking-tight text-fg sm:text-4xl">
            {m.title}
          </h2>

          <p className="mt-5 text-base leading-relaxed text-fg-muted">{m.body}</p>
          <p className="mt-4 text-base leading-relaxed text-fg-muted">{m.bodySecondary}</p>

          <dl className="mt-9 grid grid-cols-2 gap-x-6 gap-y-7">
            {BRAND_STAT_ORDER.map((id) => {
              const stat = m.stats[id];
              return (
                <div key={id} className="border-t-2 border-brand-yellow pt-4">
                  <dt className="sr-only">{stat.label}</dt>
                  <dd>
                    <span className="block font-display text-2xl font-extrabold text-fg">
                      {stat.value}
                    </span>
                    <span className="mt-1 block text-sm leading-snug text-fg-muted">
                      {stat.label}
                    </span>
                  </dd>
                </div>
              );
            })}
          </dl>

          <Link
            href={localePath(locale, "/about")}
            className="mt-9 inline-flex items-center gap-2 rounded-full bg-brand-red px-6 py-3.5 text-sm font-bold text-on-brand transition-opacity hover:opacity-90"
          >
            {m.ctaLabel}
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>

      {/* ขอบล่างโค้งนุ่ม — สีพื้นของ section ถัดไป */}
      <SectionCurve tone="bg" edge="bottom" />
    </section>
  );
}
