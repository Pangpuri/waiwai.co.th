import type { Messages } from "@/lib/i18n/messages/th";

import { MockFigure } from "@/features/shell/ui/mock-figure";

import { AboutHeading } from "./about-heading";

type CompanyDistributionProps = {
  readonly messages: Messages;
};

/** ช่องทางการจัดจำหน่าย — ภาพอยู่ซ้าย ข้อความอยู่ขวา (สลับข้างกับ section วิจัยฯ) */
export function CompanyDistribution({ messages }: CompanyDistributionProps) {
  const m = messages.about.distribution;

  return (
    <section className="bg-bg-cream">
      <div className="container-site grid gap-10 py-16 lg:grid-cols-2 lg:items-center lg:py-24">
        <MockFigure
          badge={messages.about.media.badge}
          caption={m.figure}
          icon="truck"
          ratio="standard"
          tone="cream"
        />

        <AboutHeading eyebrow={m.eyebrow} title={m.title} body={m.body} />
      </div>
    </section>
  );
}
