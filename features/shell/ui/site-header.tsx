import Link from "next/link";

import { SectionAnchor } from "@/features/shell/ui/section-anchor";

import { localePath, type Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages/th";

import type { NavbarConfig } from "@/lib/chrome/navbar";
import { resolveNavbarView } from "@/lib/chrome/navbar-view";
import { buildHeaderCta, buildPrimaryNav } from "../nav";
import { BrandMark } from "./brand-mark";
import { DesktopNav } from "./desktop-nav";
import { LangSwitch } from "./lang-switch";
import { MobileNav } from "./mobile-nav";
import { NavIcon } from "./nav-icon";
import { SectionCurve } from "./section-curve";
import { ThemeToggle } from "./theme-toggle";

type SiteHeaderProps = {
  readonly locale: Locale;
  readonly messages: Messages;
  /**
   * ค่าตั้งแถบเมนูจากหลังบ้าน (ผู้ใช้สั่ง รอบที่ 53)
   * `null` = ยังไม่ตั้งค่า/อ่านไม่ได้ ⇒ ใช้เมนูเดิมในโค้ดเป๊ะ ๆ (ห้ามเปลี่ยนพฤติกรรมเดิม)
   */
  readonly navbar?: NavbarConfig | null;
  /**
   * true = นี่คือหัวเว็บของ layout หลัก (ติดธง `data-layout-header`)
   * ใช้ให้พรีวิวซ่อนหัวเว็บนี้ได้ โดยไม่โดน "หัวเว็บสด" ที่พรีวิวเรนเดอร์เอง (รอบที่ 56)
   */
  readonly layoutHeader?: boolean;
};

/**
 * Header ของเว็บ — Server Component
 * ทำหน้าที่ประกอบข้อมูลแล้วส่ง "plain object" ลง Client Component (กฎข้อ 3)
 */
export function SiteHeader({ locale, messages, navbar = null, layoutHeader = false }: SiteHeaderProps) {
  const fallbackLinks = buildPrimaryNav(locale);
  const fallbackCta = buildHeaderCta(locale);

  /* ประกอบ "สิ่งที่ต้องเรนเดอร์" ทั้งหมดในที่เดียว (ทดสอบได้ · ไม่มี config = ของเดิม) */
  const view = resolveNavbarView(navbar, locale, messages, fallbackLinks, {
    href: fallbackCta.href,
    label: messages.nav[fallbackCta.labelKey],
  });

  const links = view.links;
  const navLabels = view.labels;

  return (
    <header
      className={view.headerClass}
      data-navbar={view.onDark ? "dark" : "light"}
      data-layout-header={layoutHeader ? "" : undefined}
    >
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
        <div className={`container-site flex items-center justify-between gap-3 ${view.rowClass}`}>
          {view.logo === null ? (
            <BrandMark locale={locale} label={messages.meta.siteName} eager />
          ) : (
            <Link href={localePath(locale, "/")} className="flex shrink-0 items-center">
              {/* โลโก้ที่อัปโหลดจากหลังบ้าน — ใช้ <img> เพราะขนาดจริงมาจากไฟล์ (กัน layout shift ด้วยความสูงคงที่) */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={view.logo.path}
                alt={locale === "th" ? view.logo.altTh : view.logo.altEn.trim() === "" ? view.logo.altTh : view.logo.altEn}
                /* กันล้นมือถือเหมือนโลโก้ในโค้ด (BrandMark) — จำกัดความกว้างไม่เกิน 46% ของจอ + ย่อทั้งรูปโดยไม่ยืดสัดส่วน */
                className={`${view.logoHeightClass} w-auto max-w-[46vw] object-contain object-left`}
              />
            </Link>
          )}

          <div className="flex items-center gap-2">
            {/* ปุ่มที่ตั้งให้อยู่ "ซ้ายของเมนู" (จอใหญ่เท่านั้น) */}
            {view.buttonsLeft.map((button) => (
              /* ⚠️ ใช้ SectionAnchor ไม่ใช่ <Link> — ปุ่มอาจชี้ไปส่วนในหน้าเดียวกัน (รอบที่ 248) */
              <SectionAnchor key={button.id} href={button.href} className={`hidden items-center gap-1.5 lg:inline-flex ${button.className}`}>
                <NavIcon name={button.icon} />
                {button.label}
              </SectionAnchor>
            ))}

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

            {/* ปุ่มที่ตั้งให้อยู่ "ขวาของเมนู" — ค่าเริ่มต้นคือปุ่ม CTA เดิม */}
            {view.buttonsRight.map((button) => (
              /* ⚠️ ใช้ SectionAnchor ไม่ใช่ <Link> — ปุ่ม CTA "สั่งซื้อสินค้าออนไลน์" ชี้ #where-to-buy (เคสจริง รอบที่ 248) */
              <SectionAnchor key={button.id} href={button.href} className={`hidden items-center gap-1.5 lg:inline-flex ${button.className}`}>
                <NavIcon name={button.icon} />
                {button.label}
              </SectionAnchor>
            ))}

            <MobileNav
              links={links}
              cta={fallbackCta}
              buttons={view.mobileButtons}
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
      <div className={view.navBarClass}>
        <div className="container-site py-2">
          <DesktopNav
            links={links}
            labels={navLabels}
            ariaLabel={messages.a11y.mainNavigation}
            onDark={view.onDark}
          />
        </div>
      </div>
    </header>
  );
}
