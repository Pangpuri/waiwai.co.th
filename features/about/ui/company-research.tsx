import type { Messages } from "@/lib/i18n/messages/th";

import { MockFigure } from "@/features/shell/ui/mock-figure";

import { AboutHeading } from "./about-heading";

type CompanyResearchProps = {
  readonly messages: Messages;
};

/** วิจัยและพัฒนา + การควบคุมคุณภาพ — แบ่งครึ่งข้อความ/ภาพ */
export function CompanyResearch({ messages }: CompanyResearchProps) {
  const m = messages.about.research;

  return (
    <section className="bg-bg-subtle">
      <div className="container-site grid gap-10 py-16 lg:grid-cols-2 lg:items-center lg:py-24">
        <div>
          <AboutHeading eyebrow={m.eyebrow} title={m.title} body={m.body} />

          <p className="mt-4 text-base leading-relaxed text-fg-muted">{m.bodySecondary}</p>

          <div className="mt-8 rounded-2xl border border-line bg-surface p-6">
            <h3 className="font-display text-lg font-extrabold text-fg">{m.qualityTitle}</h3>
            <p className="mt-3 text-sm leading-relaxed text-fg-muted">{m.qualityBody}</p>
          </div>
        </div>

        <MockFigure
          badge={messages.about.media.badge}
          caption={m.figure}
          icon="quality"
          ratio="standard"
          tone="subtle"
        />
      </div>
    </section>
  );
}
