import { formatYear } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages/th";

import { TIMELINE_ENTRIES, visibleTimeline } from "../content";
import { AboutHeading } from "./about-heading";

type CompanyStoryProps = {
  readonly locale: Locale;
  readonly messages: Messages;
};

/** เรื่องราวองค์กร + เส้นเวลาการเติบโต */
export function CompanyStory({ locale, messages }: CompanyStoryProps) {
  const m = messages.about.story;
  const timeline = visibleTimeline(TIMELINE_ENTRIES);

  return (
    <section className="container-site py-16 lg:py-24">
      <AboutHeading eyebrow={m.eyebrow} title={m.title} body={m.body} />

      <p className="mt-4 max-w-2xl text-base leading-relaxed text-fg-muted">{m.bodySecondary}</p>

      <div className="mt-14">
        <h3 className="font-display text-xl font-extrabold tracking-tight text-fg sm:text-2xl">
          {m.timelineTitle}
        </h3>

        {timeline.length > 0 ? (
          <ol className="mt-6 grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-4">
            {timeline.map((entry) => {
              const item = m.timeline[entry.id];
              const year = formatYear(entry.year, locale);

              return (
                <li key={entry.id} className="border-t-2 border-brand-yellow pt-4">
                  {/* ปีว่างได้ถ้าข้อมูลเพี้ยน — visibleTimeline กรองออกแล้ว จึงไม่ควรเกิด แต่กันไว้ให้ปลอดภัย */}
                  {year ? (
                    <p className="font-display text-2xl font-extrabold text-fg">{year}</p>
                  ) : null}

                  <h4 className="mt-2 font-display text-base font-bold text-fg">{item.title}</h4>
                  <p className="mt-2 text-sm leading-relaxed text-fg-muted">{item.description}</p>
                </li>
              );
            })}
          </ol>
        ) : null}

        <p className="mt-6 text-xs leading-relaxed text-fg-muted">{m.timelineNote}</p>
      </div>
    </section>
  );
}
