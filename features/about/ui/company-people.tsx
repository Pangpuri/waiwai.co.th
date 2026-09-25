import type { Messages } from "@/lib/i18n/messages/th";

import { MockFigure } from "@/features/shell/ui/mock-figure";

import { AboutHeading } from "./about-heading";

type CompanyPeopleProps = {
  readonly messages: Messages;
};

/** บุคลากรและสิ่งแวดล้อม — ข้อความซ้าย ภาพขวา */
export function CompanyPeople({ messages }: CompanyPeopleProps) {
  const m = messages.about.people;

  return (
    <section className="container-site grid gap-10 py-16 lg:grid-cols-2 lg:items-center lg:py-24">
      <div>
        <AboutHeading eyebrow={m.eyebrow} title={m.title} body={m.body} />

        <p className="mt-4 text-base leading-relaxed text-fg-muted">{m.bodySecondary}</p>
      </div>

      <MockFigure
        badge={messages.about.media.badge}
        caption={m.figure}
        icon="team"
        ratio="standard"
        tone="yellow"
      />
    </section>
  );
}
