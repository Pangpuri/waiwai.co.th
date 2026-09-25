import { Breadcrumb } from "@/features/shell/ui/breadcrumb";
import { formatYear } from "@/lib/format";
import { localePath, type Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages/th";

import { ABOUT_FACTS } from "../content";
import { MockFigure } from "@/features/shell/ui/mock-figure";

type AboutHeroProps = {
  readonly locale: Locale;
  readonly messages: Messages;
};

/**
 * หัวหน้า /about — Server Component (ไม่มี state)
 * ต่างจาก hero ของหน้าแรกตรงที่ทำหน้าที่ "บอกตำแหน่งในเว็บ" (breadcrumb)
 * แล้วสรุปข้อเท็จจริงสั้น ๆ ของบริษัท (ปีก่อตั้ง · พื้นที่ · ที่ตั้ง) ให้เห็นทันที
 */
export function AboutHero({ locale, messages }: AboutHeroProps) {
  const m = messages.about;

  return (
    <section className="border-b border-line bg-bg-subtle">
      <div className="container-site py-12 lg:py-16">
        <Breadcrumb
          ariaLabel={messages.a11y.breadcrumb}
          items={[
            { label: messages.nav.home, href: localePath(locale, "/") },
            { label: messages.nav.about },
          ]}
        />

        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.18em] text-accent uppercase">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-red" />
              {m.eyebrow}
            </p>

            <h1 className="mt-4 font-display text-4xl leading-[1.12] font-extrabold tracking-tight text-fg sm:text-5xl">
              {m.title}
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-relaxed text-fg-muted sm:text-lg">
              {m.intro}
            </p>

            <dl className="mt-8 grid gap-4 sm:grid-cols-3">
              {ABOUT_FACTS.map((fact) => {
                /*
                  `facts.founded` มีแต่ label (ค่าปีคำนวณจาก `year` ด้านล่าง)
                  ส่วนช่องอื่นมี value ในพจนานุกรม — ประกาศ type ไว้ให้อ่านค่าอย่างปลอดภัย
                  โดยไม่ต้องใช้ type assertion
                */
                const item: { readonly label: string; readonly value?: string } =
                  m.facts[fact.id];
                const value =
                  fact.year === undefined ? (item.value ?? "") : formatYear(fact.year, locale);

                return (
                  <div
                    key={fact.id}
                    className="rounded-2xl border border-line bg-surface px-4 py-3"
                  >
                    <dt className="text-[11px] font-semibold tracking-wide text-fg-muted uppercase">
                      {item.label}
                    </dt>
                    <dd className="mt-1 font-display text-lg font-extrabold text-fg">{value}</dd>
                  </div>
                );
              })}
            </dl>
          </div>

          <MockFigure
            badge={m.media.badge}
            caption={m.heroFigure}
            icon="site"
            ratio="standard"
            tone="yellow"
          />
        </div>

        <p className="mt-8 max-w-3xl rounded-2xl border border-line bg-surface px-4 py-3 text-xs leading-relaxed text-fg-muted">
          {m.note}
        </p>
      </div>
    </section>
  );
}
