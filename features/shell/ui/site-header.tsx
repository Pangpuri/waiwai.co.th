import Link from "next/link";

import { localePath, type Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages/th";

import { buildHeaderCta, buildPrimaryNav } from "../nav";
import { BrandMark } from "./brand-mark";
import { DesktopNav } from "./desktop-nav";
import { LangSwitch } from "./lang-switch";
import { MobileNav } from "./mobile-nav";
import { SectionCurve } from "./section-curve";
import { ThemeToggle } from "./theme-toggle";

type SiteHeaderProps = {
  readonly locale: Locale;
  readonly messages: Messages;
};

/**
 * Header ของเว็บ — Server Component
 * ทำหน้าที่ประกอบข้อมูลแล้วส่ง "plain object" ลง Client Component (กฎข้อ 3)
 */
export function SiteHeader({ locale, messages }: SiteHeaderProps) {
  const links = buildPrimaryNav(locale);
  const cta = buildHeaderCta(locale);

  // สร้างป้ายชื่อเมนูที่แปลแล้วเป็น plain object ก่อนส่งลง client
  const navLabels: Record<string, string> = {};
  for (const link of [...links, cta]) {
    navLabels[link.id] = messages.nav[link.labelKey];
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur-md">
      <div className="relative bg-brand-yellow text-accent-on-yellow">
        <div className="container-site flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 py-2 text-center text-xs font-medium sm:text-[0.8125rem]">
          <span>{messages.topbar.announcement}</span>
          <Link
            href={localePath(locale, "/news")}
            className="font-bold underline underline-offset-4 decoration-2 hover:opacity-75"
          >
            {messages.topbar.announcementLink}
          </Link>
        </div>

        {/* ขอบล่างของแถบประกาศเป็นโค้งนุ่ม — เนินสีของแถบเมนูที่อยู่ถัดลงมา (พื้นที่จำกัดจึงใช้เนินเล็ก) */}
        <SectionCurve tone="surface" edge="bottom" size="sm" />
      </div>

      {/* แถว 1: โลโก้ · เครื่องมือ · ปุ่ม CTA · ปุ่มเมนู (จอเล็ก) */}
      <div className="relative">
        <div className="container-site flex h-16 items-center justify-between gap-3 lg:h-[4.5rem]">
          <BrandMark locale={locale} label={messages.meta.siteName} />

          <div className="flex items-center gap-2">
            <div className="hidden md:block">
              <LangSwitch current={locale} />
            </div>

            <ThemeToggle
              labels={{
                label: messages.theme.label,
                light: messages.theme.light,
                dark: messages.theme.dark,
                system: messages.theme.system,
              }}
            />

            <Link
              href={cta.href}
              className="hidden rounded-full bg-brand-red px-5 py-2.5 text-sm font-semibold text-on-brand transition-opacity hover:opacity-90 lg:inline-flex"
            >
              {messages.nav[cta.labelKey]}
            </Link>

            <MobileNav
              links={links}
              cta={cta}
              labels={navLabels}
              toggleLabel={{
                open: messages.a11y.openMenu,
                close: messages.a11y.closeMenu,
              }}
            />
          </div>
        </div>
      </div>

      {/*
        แถว 2: เมนูหลัก (จอใหญ่ตั้งแต่ lg ขึ้นไป)
        เมนูตามเว็บเดิมมี 9 รายการ — ไม่พอดีกับแถวของโลโก้+ปุ่ม จึงแยกเป็นแถวของตัวเอง
        (ภายใน DesktopNav ใช้ flex-wrap ต่ออีกชั้น เพื่อไม่ให้ล้นแนวนอนบนจอแคบ)
      */}
      <div className="hidden border-t border-line lg:block">
        <div className="container-site py-2">
          <DesktopNav
            links={links}
            labels={navLabels}
            ariaLabel={messages.a11y.mainNavigation}
          />
        </div>
      </div>
    </header>
  );
}
