import Link from "next/link";

import { localePath, type Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages/th";
import { SITE } from "@/lib/site";

import { SectionHeading } from "./section-heading";

type WhereToBuyProps = {
  readonly locale: Locale;
  readonly messages: Messages;
};

export function WhereToBuy({ locale, messages }: WhereToBuyProps) {
  const m = messages.whereToBuy;

  return (
    // id นี้เป็นปลายทางของปุ่ม "สั่งซื้อสินค้าออนไลน์" บน header (features/shell/nav.ts → HEADER_CTA.anchor)
    <section id="where-to-buy" className="container-site scroll-mt-40 py-16 lg:py-24">
      <div className="rounded-3xl bg-brand-yellow px-6 py-12 text-accent-on-yellow sm:px-10 lg:px-14 lg:py-16">
        <SectionHeading eyebrow={m.eyebrow} title={m.title} body={m.body} />

        <ul className="mt-9 flex flex-wrap gap-3">
          {SITE.marketplaces.map((marketplace) => (
            <li key={marketplace.id}>
              <a
                href={marketplace.href}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-2 rounded-full bg-surface px-6 py-3.5 text-sm font-bold text-fg shadow-sm transition-transform hover:-translate-y-0.5"
              >
                {m.marketplaces[marketplace.id]}
                <span className="sr-only"> {messages.a11y.newWindow}</span>
                <span aria-hidden="true">↗</span>
              </a>
            </li>
          ))}

          <li>
            <Link
              href={localePath(locale, "/where-to-buy")}
              className="inline-flex items-center gap-2 rounded-full border-2 border-accent-on-yellow/70 px-6 py-3.5 text-sm font-bold transition-colors hover:bg-accent-on-yellow/10"
            >
              {messages.actions.findStore}
            </Link>
          </li>
        </ul>

        <p className="mt-7 text-sm text-accent-on-yellow/80">{m.retailNote}</p>
      </div>
    </section>
  );
}
