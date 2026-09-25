import Link from "next/link";

import { localePath, type Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages/th";

import { AWARD_ITEM_IDS, CERTIFICATE_IDS } from "../content";
import { AboutHeading } from "./about-heading";

type CompanyAwardsProps = {
  readonly locale: Locale;
  readonly messages: Messages;
};

/**
 * รางวัลและใบรับรองมาตรฐาน
 * ใช้รายการ (ไม่ใช่ตัวเลขอันดับ) เพราะรางวัลเหล่านี้ไม่ได้จัดอันดับเทียบกัน
 * ปิดท้ายด้วยลิงก์ไปหน้า `/about/certifications` ที่มีภาพใบรับรองจริงให้กดขยายดู
 */
export function CompanyAwards({ locale, messages }: CompanyAwardsProps) {
  const m = messages.about.awards;

  return (
    <section className="bg-bg-subtle">
      <div className="container-site py-16 lg:py-24">
        <AboutHeading eyebrow={m.eyebrow} title={m.title} body={m.body} />

        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {AWARD_ITEM_IDS.map((id) => {
            const item = m.items[id];

            return (
              <li key={id} className="rounded-2xl border border-line bg-surface p-6">
                <span
                  aria-hidden="true"
                  className="block h-1.5 w-10 rounded-full bg-brand-yellow"
                />
                <h3 className="mt-4 font-display text-base font-extrabold text-fg">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-fg-muted">{item.description}</p>
              </li>
            );
          })}
        </ul>

        <h3 className="mt-14 font-display text-xl font-extrabold text-fg sm:text-2xl">
          {m.certificatesTitle}
        </h3>

        <ul className="mt-6 grid gap-6 sm:grid-cols-3">
          {CERTIFICATE_IDS.map((id) => {
            const item = m.certificates[id];

            return (
              <li key={id} className="rounded-2xl border border-line bg-surface p-6">
                <h4 className="font-display text-base font-bold text-fg">{item.title}</h4>
                <p className="mt-2 text-sm leading-relaxed text-fg-muted">{item.description}</p>
              </li>
            );
          })}
        </ul>

        <p className="mt-6 max-w-3xl text-xs leading-relaxed text-fg-muted">{m.note}</p>

        <Link
          href={localePath(locale, "/about/certifications")}
          className="mt-6 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-fg transition-colors hover:border-line-strong"
        >
          {m.certificatesCta}
          <span aria-hidden="true" className="text-accent">
            →
          </span>
        </Link>
      </div>
    </section>
  );
}
