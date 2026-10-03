import { localePath, type Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages/th";
import type { NavIconKey, NavbarConfig, NavbarHeight, NavbarBackground, NavbarButtonTone } from "@/lib/chrome/navbar";
import type { NavLink } from "@/features/shell/nav";

/**
 * แปลง "ค่าตั้งแถบเมนู" → สิ่งที่ตัวเรนเดอร์ใช้จริง (pure — ทดสอบได้)
 *
 * ⚠️ หัวใจสำคัญ: `config = null` (ยังไม่ตั้งค่า/อ่านไม่ได้) ต้องให้ผล **เหมือนเว็บเดิมเป๊ะ**
 *    ⇒ หน้าเว็บไม่มีทางพังเพราะฐานข้อมูลว่าง และ diff ตอนรีวิวจะเห็นชัดว่าอะไรถูกเพิ่ม
 */

export type NavbarButtonView = {
  readonly id: string;
  readonly label: string;
  readonly href: string;
  readonly icon: NavIconKey;
  readonly tone: NavbarButtonTone;
  readonly className: string;
};

export type NavbarView = {
  /** คลาสของ `<header>` */
  readonly headerClass: string;
  /** ชั้นในสุดของแถว 1 (ความสูง) */
  readonly rowClass: string;
  /** ใช้สีตัวอักษรบนพื้นเข้มหรือไม่ (พื้นแดง/ดำ) */
  readonly onDark: boolean;
  /** คลาสของแถบเมนูหลัก */
  readonly navBarClass: string;
  readonly logo: NavbarConfig["logo"];
  readonly logoHeightClass: string;
  readonly links: readonly NavLink[];
  readonly labels: Readonly<Record<string, string>>;
  readonly buttonsLeft: readonly NavbarButtonView[];
  readonly buttonsRight: readonly NavbarButtonView[];
  /** ปุ่มแรกที่ใช้แทน CTA เดิม (ใช้ในเมนูมือถือ) */
  readonly mobileButtons: readonly NavbarButtonView[];
};

const LOGO_HEIGHTS: Readonly<Record<NavbarConfig["logoSize"], string>> = {
  sm: "h-7 sm:h-8",
  md: "h-9 sm:h-10",
  lg: "h-11 sm:h-12",
};

const ROW_HEIGHTS: Readonly<Record<NavbarHeight, string>> = {
  compact: "h-14 lg:h-16",
  normal: "h-16 lg:h-[4.5rem]",
  tall: "h-20 lg:h-24",
};

/** พื้นหลัง = token เท่านั้น + บอกว่าต้องใช้สีตัวอักษรแบบ "บนพื้นเข้ม" หรือไม่ */
const BACKGROUNDS: Readonly<Record<NavbarBackground, { readonly header: string; readonly nav: string; readonly onDark: boolean }>> = {
  surface: {
    header: "sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur-md",
    nav: "hidden border-t border-line lg:block",
    onDark: false,
  },
  cream: {
    header: "sticky top-0 z-40 border-b border-line bg-bg-subtle/95 backdrop-blur-md",
    nav: "hidden border-t border-line lg:block",
    onDark: false,
  },
  transparent: {
    header: "sticky top-0 z-40 bg-transparent",
    nav: "hidden lg:block",
    onDark: false,
  },
  brand: {
    header: "sticky top-0 z-40 border-b border-line bg-brand-red",
    nav: "hidden border-t border-brand-red/40 lg:block",
    onDark: true,
  },
  ink: {
    header: "sticky top-0 z-40 border-b border-line bg-fg",
    nav: "hidden border-t border-line lg:block",
    onDark: true,
  },
};

const BUTTON_TONES: Readonly<Record<NavbarButtonTone, string>> = {
  brand: "rounded-full bg-brand-red px-5 py-2.5 text-sm font-semibold text-on-brand transition-opacity hover:opacity-90",
  contrast: "rounded-full bg-fg px-5 py-2.5 text-sm font-semibold text-bg transition-opacity hover:opacity-90",
  outline: "rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-fg transition-colors hover:bg-bg-subtle",
};

/** แปลงปลายทาง: ลิงก์ในเว็บต้องเติม prefix ภาษา · ลิงก์นอก/mailto/tel/anchor คงเดิม */
export function resolveHref(locale: Locale, href: string): string {
  if (!href.startsWith("/")) return href;
  const [path, hash] = href.split("#");
  const base = localePath(locale, path === undefined || path === "" ? "/" : path);
  return hash === undefined || hash === "" ? base : `${base}#${hash}`;
}

export function resolveNavbarView(
  config: NavbarConfig | null,
  locale: Locale,
  messages: Messages,
  fallbackLinks: readonly NavLink[],
  fallbackCta: { readonly href: string; readonly label: string },
): NavbarView {
  /* ── ยังไม่ตั้งค่า: ของเดิมทั้งดุ้น (ห้ามเปลี่ยน) ── */
  if (config === null) {
    const labels: Record<string, string> = {};
    for (const link of fallbackLinks) labels[link.id] = messages.nav[link.labelKey];

    return {
      headerClass: BACKGROUNDS.surface.header,
      rowClass: ROW_HEIGHTS.normal,
      onDark: false,
      navBarClass: BACKGROUNDS.surface.nav,
      logo: null,
      logoHeightClass: LOGO_HEIGHTS.md,
      links: fallbackLinks,
      labels,
      buttonsLeft: [],
      buttonsRight: [
        {
          id: "cta",
          label: fallbackCta.label,
          href: fallbackCta.href,
          icon: "none",
          tone: "brand",
          className: BUTTON_TONES.brand,
        },
      ],
      mobileButtons: [
        {
          id: "cta",
          label: fallbackCta.label,
          href: fallbackCta.href,
          icon: "none",
          tone: "brand",
          className: BUTTON_TONES.brand,
        },
      ],
    };
  }

  const background = BACKGROUNDS[config.background];
  const labels: Record<string, string> = {};

  const links: NavLink[] = config.items.map((item) => {
    const label = item.label[locale].trim() === "" ? item.label.th : item.label[locale];
    labels[item.id] = label;
    return {
      id: item.id,
      /* ใช้ labelKey ของตัวเองเป็น "fallback" เท่านั้น — ข้อความจริงมาจาก `labels` */
      labelKey: "home",
      href: resolveHref(locale, item.href),
      exact: item.href === "/" || item.href === "",
      icon: item.icon,
    };
  });

  const toButton = (button: NavbarConfig["buttons"][number]): NavbarButtonView => ({
    id: button.id,
    label: button.label[locale].trim() === "" ? button.label.th : button.label[locale],
    href: resolveHref(locale, button.href),
    icon: button.icon,
    tone: button.tone,
    className: BUTTON_TONES[button.tone],
  });

  const all = config.buttons.map(toButton);

  return {
    headerClass: background.header,
    rowClass: ROW_HEIGHTS[config.height],
    onDark: background.onDark,
    navBarClass: background.nav,
    logo: config.logo,
    logoHeightClass: LOGO_HEIGHTS[config.logoSize],
    links,
    labels,
    buttonsLeft: all.filter((_entry, index) => config.buttons[index]?.position === "left"),
    buttonsRight: all.filter((_entry, index) => config.buttons[index]?.position === "right"),
    mobileButtons: all,
  };
}
