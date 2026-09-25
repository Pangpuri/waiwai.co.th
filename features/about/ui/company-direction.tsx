import type { Messages } from "@/lib/i18n/messages/th";

import { DIRECTION_ORDER, MISSION_ITEM_IDS } from "../content";
import { AboutHeading } from "./about-heading";

type CompanyDirectionProps = {
  readonly messages: Messages;
};

/**
 * วิสัยทัศน์ · นโยบาย · พันธกิจ
 *
 * พันธกิจมี 11 ข้อ จึงไม่ยัดลงการ์ดเดียวกับอีกสองหัวข้อ แต่แยกเป็นการ์ดเต็มความกว้าง
 * พร้อมรายการลำดับเลข (สองคอลัมน์บนจอใหญ่)
 */
export function CompanyDirection({ messages }: CompanyDirectionProps) {
  const m = messages.about.direction;

  return (
    <section className="bg-bg-cream">
      <div className="container-site py-16 lg:py-24">
        <AboutHeading eyebrow={m.eyebrow} title={m.title} body={m.body} />

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {DIRECTION_ORDER.map((id) => {
            const item = m[id];

            return (
              <article key={id} className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
                <h3 className="font-display text-xl font-extrabold text-fg">{item.title}</h3>
                <p className="mt-4 text-sm leading-relaxed text-fg-muted sm:text-base">
                  {item.description}
                </p>
              </article>
            );
          })}
        </div>

        <article className="mt-6 rounded-2xl border border-line bg-surface p-6 sm:p-8">
          <h3 className="font-display text-xl font-extrabold text-fg">{m.mission.title}</h3>
          <p className="mt-4 text-sm leading-relaxed text-fg-muted sm:text-base">
            {m.mission.description}
          </p>

          <ol className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {MISSION_ITEM_IDS.map((id, index) => (
              <li key={id} className="flex gap-3 text-sm leading-relaxed text-fg-muted">
                <span
                  aria-hidden="true"
                  className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-yellow font-display text-xs font-extrabold text-accent-on-yellow"
                >
                  {index + 1}
                </span>
                <span>{m.mission.items[id]}</span>
              </li>
            ))}
          </ol>
        </article>
      </div>
    </section>
  );
}
