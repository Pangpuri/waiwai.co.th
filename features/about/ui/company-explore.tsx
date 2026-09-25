import Link from "next/link";

import { localePath, type Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages/th";

import { EXPLORE_LINKS } from "../content";
import { AboutHeading } from "./about-heading";

type CompanyExploreProps = {
  readonly locale: Locale;
  readonly messages: Messages;
};

/**
 * ทางไปหน้าข้อมูลองค์กรอื่น ๆ
 *
 * ⚠️ ปลายทางบางหน้ายังไม่ถูกสร้าง (ดู PRODUCT_ROADMAP.md § 9) — ลิงก์ชุดเดียวกับ
 * footer โดยตั้งใจ เพื่อให้เมนูกับหน้าหลักชี้ที่เดียวกันแล้วค่อยเติมหน้าปลายทาง
 */
export function CompanyExplore({ locale, messages }: CompanyExploreProps) {
  const m = messages.about.explore;

  return (
    <section className="container-site py-16 lg:py-24">
      <AboutHeading eyebrow={m.eyebrow} title={m.title} body={m.body} />

      <ul className="mt-10 grid gap-6 md:grid-cols-3">
        {EXPLORE_LINKS.map((link) => {
          const item = m[link.id];

          return (
            <li key={link.id}>
              <Link
                href={localePath(locale, link.path)}
                className="flex h-full flex-col rounded-2xl border border-line bg-surface p-6 transition-colors hover:border-line-strong"
              >
                <h3 className="font-display text-lg font-extrabold text-fg">{item.title}</h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-fg-muted">
                  {item.description}
                </p>
                <span aria-hidden="true" className="mt-5 text-sm font-semibold text-accent">
                  →
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
