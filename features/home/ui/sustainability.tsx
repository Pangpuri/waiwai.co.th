import type { Messages } from "@/lib/i18n/messages/th";

import { SUSTAINABILITY_POINT_ORDER, type SustainabilityPointId } from "../content";
import { SectionHeading } from "./section-heading";

const POINT_ICON: Record<SustainabilityPointId, string> = {
  packaging: "M12 3 3 7.5v9L12 21l9-4.5v-9L12 3Zm0 0v18M3 7.5 12 12l9-4.5",
  energy: "M13 2 4 14h6l-1 8 9-12h-6l1-8Z",
  people: "M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20M9.5 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM21 20v-1.5a4 4 0 0 0-3-3.87M16.5 3.6a4 4 0 0 1 0 7.75",
};

export function Sustainability({ messages }: { readonly messages: Messages }) {
  const m = messages.sustainability;

  return (
    <section className="container-site py-16 lg:py-24">
      <SectionHeading eyebrow={m.eyebrow} title={m.title} body={m.body} align="center" />

      <ul className="mt-12 grid gap-5 md:grid-cols-3">
        {SUSTAINABILITY_POINT_ORDER.map((id) => {
          const point = m.points[id];
          return (
            <li
              key={id}
              className="flex flex-col rounded-2xl border border-line bg-surface-raised p-7"
            >
              <span
                aria-hidden="true"
                className="grid h-12 w-12 place-items-center rounded-xl bg-bg-cream text-accent"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-6 w-6"
                >
                  <path d={POINT_ICON[id]} />
                </svg>
              </span>

              <h3 className="mt-5 font-display text-lg font-bold text-fg">{point.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">{point.description}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
