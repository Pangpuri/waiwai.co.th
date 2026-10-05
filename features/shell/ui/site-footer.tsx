import Link from "next/link";

import { localePath, type Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages/th";
import { SITE } from "@/lib/site";

import type { FooterConfig } from "@/lib/chrome/footer";
import { resolveFooterView } from "@/lib/chrome/footer-view";

import { buildFooterColumns } from "../nav";
import { BrandMark } from "./brand-mark";
import { LangSwitch } from "./lang-switch";
import { NavIcon } from "./nav-icon";
import { SectionCurve } from "./section-curve";

type SiteFooterProps = {
  readonly locale: Locale;
  readonly messages: Messages;
  /** ค่าตั้งท้ายเว็บจากหลังบ้าน (W3) — `null` = ใช้ของเดิมในโค้ดเป๊ะ ๆ */
  readonly footer?: FooterConfig | null;
  /**
   * true = นี่คือท้ายเว็บของ layout หลัก (ติดธง `data-layout-footer`)
   * ใช้ให้พรีวิวซ่อนท้ายเว็บนี้ได้ โดยไม่โดน "ท้ายเว็บสด" ที่พรีวิวเรนเดอร์เอง (บทเรียนเดียวกับหัวเว็บ)
   */
  readonly layoutFooter?: boolean;
};

export function SiteFooter({ locale, messages, footer = null, layoutFooter = false }: SiteFooterProps) {
  const columns = buildFooterColumns(locale);
  const { contact: siteContact, social } = SITE;
  const year = new Date().getFullYear();

  const view = resolveFooterView(footer, locale, messages, {
    columns: columns.map((column) => ({
      id: column.id,
      title: messages.footer[column.titleKey],
      links: column.links.map((link) => ({ id: `${column.id}-${link.labelKey}`, label: messages.footer.links[link.labelKey], href: link.href })),
    })),
    socials: social.map((item) => ({ id: item.id, label: item.label, href: item.href })),
    contact: { address: siteContact.address, phone: siteContact.phone, email: siteContact.email },
  });

  const contact = view.contact;

  return (
    <footer
      className={view.footerClass}
      data-site-footer=""
      data-layout-footer={layoutFooter ? "" : undefined}
    >
      {/* ขอบบนโค้งนุ่มแทนเส้นตรง — เนินของแถบนี้ยื่นขึ้นไปในพื้นที่ว่างของ section ด้านบน */}
      <SectionCurve tone="bg-subtle" edge="top" />

      <div className="container-site grid gap-10 py-14 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)] lg:gap-16">
        <div>
          {view.logo === null ? (
            <BrandMark locale={locale} label={messages.meta.siteName} />
          ) : (
            <Link href={localePath(locale, "/")} className="inline-flex items-center">
              {/* โลโก้ท้ายเว็บที่อัปโหลดจากหลังบ้าน */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={view.logo.path}
                alt={locale === "th" ? view.logo.altTh : view.logo.altEn.trim() === "" ? view.logo.altTh : view.logo.altEn}
                /* กันล้นมือถือ: โลโก้ท้ายเว็บอยู่แถวของตัวเอง แต่ยังกันไฟล์ที่กว้างผิดปกติ (46% ของจอ) */
                className="h-9 w-auto max-w-[46vw] object-contain object-left sm:h-10"
              />
            </Link>
          )}
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-fg-muted">
            {view.about}
          </p>

          {/* แสดงเฉพาะช่องที่มีข้อมูลจริง — ไม่ใส่ข้อมูลติดต่อสมมติ */}
          {contact.address || contact.phone || contact.email ? (
            <dl className="mt-6 space-y-2 text-sm text-fg-muted">
              {contact.address ? (
                <div>
                  <dt className="font-semibold text-fg">{view.labels.address}</dt>
                  <dd className="mt-0.5 whitespace-pre-line">{contact.address}</dd>
                </div>
              ) : null}
              {contact.phone ? (
                <div>
                  <dt className="font-semibold text-fg">{view.labels.phone}</dt>
                  <dd className="mt-0.5">{contact.phone}</dd>
                </div>
              ) : null}
              {contact.email ? (
                <div>
                  <dt className="font-semibold text-fg">{view.labels.email}</dt>
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
          {view.groups.map((column) => (
            <nav key={column.id} aria-label={column.title}>
              <h2 className="font-display text-sm font-bold tracking-wide text-fg">
                {column.title}
              </h2>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={`${column.id}-${link.id}`}>
                    <Link
                      href={link.href}
                      className={
                        link.icon === "none"
                          ? "text-sm text-fg-muted transition-colors hover:text-accent"
                          : "inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-accent"
                      }
                    >
                      {link.icon === "none" ? null : <NavIcon name={link.icon} />}
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>

      {view.socials.length > 0 ? (
        <div className="container-site border-t border-line py-6">
          <h2 className="font-display text-sm font-bold text-fg">{view.labels.follow}</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {view.socials.map((item) => (
              <li key={item.id}>
                <a
                  href={item.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="rounded-full border border-line-strong px-4 py-1.5 text-sm font-medium text-fg transition-colors hover:bg-surface"
                >
                  {item.icon === "none" ? null : (
                    <span className="inline-flex items-center gap-1.5">
                      <NavIcon name={item.icon} />
                      {item.label}
                    </span>
                  )}
                  {item.icon === "none" ? item.label : null}
                  <span className="sr-only"> {view.labels.newWindow}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="border-t border-line">
        <div className="container-site flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-fg-muted">
            © {year} {messages.meta.siteName}. {view.rights}
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <Link
              href={view.privacyHref}
              className="text-xs text-fg-muted transition-colors hover:text-accent"
            >
              {view.labels.privacy}
            </Link>
            <LangSwitch current={locale} variant="footer" />
          </div>
        </div>
      </div>
    </footer>
  );
}
