import type { Messages } from "@/lib/i18n/messages/th";

import { MockFigure } from "@/features/shell/ui/mock-figure";

import { AboutHeading } from "./about-heading";

type CompanyProductsProps = {
  readonly messages: Messages;
};

/**
 * ผลิตภัณฑ์ 2 กลุ่ม (ในประเทศ / ต่างประเทศ)
 * ตั้งใจไม่อ้างชื่อรสชาติหรือจำนวนรสในส่วนนี้ — รายละเอียดสินค้าอยู่ที่หน้า /products
 */
export function CompanyProducts({ messages }: CompanyProductsProps) {
  const m = messages.about.products;
  const badge = messages.about.media.badge;

  return (
    <section className="container-site py-16 lg:py-24">
      <AboutHeading eyebrow={m.eyebrow} title={m.title} body={m.body} />

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        <article className="flex h-full flex-col rounded-2xl border border-line bg-surface p-6">
          <MockFigure
            badge={badge}
            caption={m.domestic.figure}
            icon="product"
            ratio="video"
            tone="yellow"
          />
          <h3 className="mt-6 font-display text-lg font-extrabold text-fg">
            {m.domestic.title}
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-fg-muted">{m.domestic.description}</p>
        </article>

        <article className="flex h-full flex-col rounded-2xl border border-line bg-surface p-6">
          <MockFigure
            badge={badge}
            caption={m.export.figure}
            icon="product"
            ratio="video"
            tone="cream"
          />
          <h3 className="mt-6 font-display text-lg font-extrabold text-fg">{m.export.title}</h3>
          <p className="mt-3 text-sm leading-relaxed text-fg-muted">{m.export.description}</p>
        </article>
      </div>
    </section>
  );
}
