import type { Messages } from "@/lib/i18n/messages/th";

import { MockFigure } from "@/features/shell/ui/mock-figure";

import { FACILITY_STATS, SITES } from "../content";
import { AboutHeading } from "./about-heading";

type CompanyFacilitiesProps = {
  readonly messages: Messages;
};

/**
 * พื้นที่และโรงงาน — ตัวเลขการแบ่งพื้นที่ ตามด้วยช่องภาพตัวอย่าง 3 ช่อง และที่ตั้ง 2 แห่ง
 * ตัวเลขทั้งหมดเป็นค่าที่บริษัทระบุไว้ (ไม่ใช่ค่าที่เราคำนวณเพิ่ม)
 */
export function CompanyFacilities({ messages }: CompanyFacilitiesProps) {
  const m = messages.about.facilities;
  const badge = messages.about.media.badge;

  return (
    <section className="bg-bg-cream">
      <div className="container-site py-16 lg:py-24">
        <AboutHeading eyebrow={m.eyebrow} title={m.title} body={m.body} />

        <h3 className="mt-12 font-display text-xl font-extrabold text-fg sm:text-2xl">
          {m.statsTitle}
        </h3>

        <dl className="mt-6 grid gap-6 sm:grid-cols-3">
          {FACILITY_STATS.map((id) => {
            const stat = m.stats[id];

            return (
              <div key={id} className="rounded-2xl border border-line bg-surface p-6">
                <dt className="text-sm font-semibold text-fg-muted">{stat.label}</dt>
                <dd className="mt-2 font-display text-3xl font-extrabold text-fg">
                  {stat.value}
                </dd>
              </div>
            );
          })}
        </dl>

        <p className="mt-4 text-xs leading-relaxed text-fg-muted">{m.statsNote}</p>

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          <MockFigure
            className="lg:col-span-2"
            badge={badge}
            caption={m.figures.site}
            icon="site"
            ratio="standard"
            tone="yellow"
          />
          <MockFigure
            badge={badge}
            caption={m.figures.dormitory}
            icon="dormitory"
            ratio="standard"
            tone="cream"
          />
          <MockFigure
            badge={badge}
            caption={m.figures.treatment}
            icon="water"
            ratio="standard"
            tone="subtle"
          />
        </div>

        <h3 className="mt-14 font-display text-xl font-extrabold text-fg sm:text-2xl">
          {m.sitesTitle}
        </h3>

        <ul className="mt-6 grid gap-6 sm:grid-cols-2">
          {SITES.map((id) => {
            const site = m.sites[id];

            return (
              <li key={id} className="rounded-2xl border border-line bg-surface p-6">
                <h4 className="font-display text-base font-bold text-fg">{site.title}</h4>
                <p className="mt-2 text-sm leading-relaxed text-fg-muted">{site.description}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
