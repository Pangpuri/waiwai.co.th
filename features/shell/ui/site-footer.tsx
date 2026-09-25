import Link from "next/link";

import { localePath, type Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages/th";
import { SITE } from "@/lib/site";

import { buildFooterColumns } from "../nav";
import { BrandMark } from "./brand-mark";
import { LangSwitch } from "./lang-switch";
import { SectionCurve } from "./section-curve";

type SiteFooterProps = {
  readonly locale: Locale;
  readonly messages: Messages;
};

export function SiteFooter({ locale, messages }: SiteFooterProps) {
  const columns = buildFooterColumns(locale);
  const { contact, social } = SITE;
  const year = new Date().getFullYear();

  return (
    <footer className="relative bg-bg-subtle">
      {/* ขอบบนโค้งนุ่มแทนเส้นตรง — เนินของแถบนี้ยื่นขึ้นไปในพื้นที่ว่างของ section ด้านบน */}
      <SectionCurve tone="bg-subtle" edge="top" />

      <div className="container-site grid gap-10 py-14 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)] lg:gap-16">
        <div>
          <BrandMark locale={locale} label={messages.meta.siteName} />
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-fg-muted">
            {messages.footer.about}
          </p>

          {/* แสดงเฉพาะช่องที่มีข้อมูลจริง — ไม่ใส่ข้อมูลติดต่อสมมติ */}
          {contact.address || contact.phone || contact.email ? (
            <dl className="mt-6 space-y-2 text-sm text-fg-muted">
              {contact.address ? (
                <div>
                  <dt className="font-semibold text-fg">{messages.footer.contactAddress}</dt>
                  <dd className="mt-0.5 whitespace-pre-line">{contact.address}</dd>
                </div>
              ) : null}
              {contact.phone ? (
                <div>
                  <dt className="font-semibold text-fg">{messages.footer.contactPhone}</dt>
                  <dd className="mt-0.5">{contact.phone}</dd>
                </div>
              ) : null}
              {contact.email ? (
                <div>
                  <dt className="font-semibold text-fg">{messages.footer.contactEmail}</dt>
                  <dd className="mt-0.5">
                    <a className="text-link underline underline-offset-4" href={`mailto:${contact.email}`}>
                      {contact.email}
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>
          ) : null}
        </div>

        <div className="grid gap-8 sm:grid-cols-3">
          {columns.map((column) => (
            <nav key={column.id} aria-label={messages.footer[column.titleKey]}>
              <h2 className="font-display text-sm font-bold tracking-wide text-fg">
                {messages.footer[column.titleKey]}
              </h2>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={`${column.id}-${link.labelKey}`}>
                    <Link
                      href={link.href}
                      className="text-sm text-fg-muted transition-colors hover:text-accent"
                    >
                      {messages.footer.links[link.labelKey]}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>

      {social.length > 0 ? (
        <div className="container-site border-t border-line py-6">
          <h2 className="font-display text-sm font-bold text-fg">{messages.footer.followColumn}</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {social.map((item) => (
              <li key={item.id}>
                <a
                  href={item.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="rounded-full border border-line-strong px-4 py-1.5 text-sm font-medium text-fg transition-colors hover:bg-surface"
                >
                  {item.label}
                  <span className="sr-only"> {messages.a11y.newWindow}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="border-t border-line">
        <div className="container-site flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-fg-muted">
            © {year} {messages.meta.siteName}. {messages.footer.rights}
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <Link
              href={localePath(locale, "/privacy")}
              className="text-xs text-fg-muted transition-colors hover:text-accent"
            >
              {messages.footer.links.privacy}
            </Link>
            <Link
              href={localePath(locale, "/cookie-policy")}
              className="text-xs text-fg-muted transition-colors hover:text-accent"
            >
              {messages.footer.links.cookies}
            </Link>
            <LangSwitch current={locale} variant="footer" />
          </div>
        </div>
      </div>
    </footer>
  );
}
