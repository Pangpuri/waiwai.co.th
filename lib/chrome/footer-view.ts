import { localePath, type Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages/th";
import type { FooterBackground, FooterConfig } from "@/lib/chrome/footer";
import type { NavIconKey } from "@/lib/chrome/navbar";

/**
 * แปลงค่าตั้ง "ท้ายเว็บ" → สิ่งที่ตัวเรนเดอร์ใช้จริง (pure — ทดสอบได้)
 *
 * ⚠️ `config = null` (ยังไม่ตั้งค่า/อ่านไม่ได้) ต้องให้ผล **เหมือนเว็บเดิมเป๊ะ**
 *    ค่าเริ่มต้นในฟังก์ชันนี้จึงต้องตรงกับ `SiteFooter` เดิมทุกคลาส
 */

export type FooterViewLink = {
  readonly id: string;
  readonly label: string;
  readonly href: string;
  readonly icon: NavIconKey;
  readonly external: boolean;
};

export type FooterViewGroup = {
  readonly id: string;
  readonly title: string;
  readonly links: readonly FooterViewLink[];
};

export type FooterViewSocial = {
  readonly id: string;
  readonly label: string;
  readonly href: string;
  readonly icon: NavIconKey;
};

export type FooterView = {
  readonly footerClass: string;
  readonly onDark: boolean;
  readonly logo: FooterConfig["logo"];
  readonly about: string;
  readonly contact: { readonly address: string; readonly phone: string; readonly email: string };
  readonly groups: readonly FooterViewGroup[];
  readonly socials: readonly FooterViewSocial[];
  readonly rights: string;
  /* ป้ายกำกับหัวข้อ (มาจากพจนานุกรม — ผู้ใช้แก้ไม่ได้ใน W3) */
  readonly labels: {
    readonly address: string;
    readonly phone: string;
    readonly email: string;
    readonly follow: string;
    readonly newWindow: string;
    readonly privacy: string;
    readonly cookies: string;
  };
  readonly privacyHref: string;
  readonly cookiesHref: string;
};

const BACKGROUNDS: Readonly<Record<FooterBackground, { readonly className: string; readonly onDark: boolean }>> = {
  cream: { className: "relative bg-bg-subtle", onDark: false },
  surface: { className: "relative bg-surface", onDark: false },
  ink: { className: "relative bg-fg text-bg", onDark: true },
  brand: { className: "relative bg-brand-red text-on-brand", onDark: true },
};

/** ลิงก์ในเว็บต้องเติม prefix ภาษา · ลิงก์นอก/mailto/tel คงเดิม */
export function resolveFooterHref(locale: Locale, href: string): string {
  if (href === "" || !href.startsWith("/")) return href;
  const [path, hash] = href.split("#");
  const base = localePath(locale, path === undefined || path === "" ? "/" : path);
  return hash === undefined || hash === "" ? base : `${base}#${hash}`;
}

export function resolveFooterView(
  config: FooterConfig | null,
  locale: Locale,
  messages: Messages,
  fallback: {
    readonly columns: readonly {
      readonly id: string;
      readonly title: string;
      readonly links: readonly { readonly id: string; readonly label: string; readonly href: string }[];
    }[];
    readonly socials: readonly { readonly id: string; readonly label: string; readonly href: string }[];
    /** ข้อมูลติดต่อเดิม (จาก lib/site.ts) — ใช้เมื่อยังไม่ตั้งค่าในหลังบ้าน */
    readonly contact: { readonly address: string; readonly phone: string; readonly email: string };
  },
): FooterView {
  const labels = {
    address: messages.footer.contactAddress,
    phone: messages.footer.contactPhone,
    email: messages.footer.contactEmail,
    follow: messages.footer.followColumn,
    newWindow: messages.a11y.newWindow,
    privacy: messages.footer.links.privacy,
    cookies: messages.footer.links.cookies,
  };

  /* ── ยังไม่ตั้งค่า: ของเดิมทั้งดุ้น ── */
  if (config === null) {
    return {
      footerClass: BACKGROUNDS.cream.className,
      onDark: false,
      logo: null,
      about: messages.footer.about,
      contact: fallback.contact,
      groups: fallback.columns.map((column) => ({
        id: column.id,
        title: column.title,
        links: column.links.map((link) => ({
          id: link.id,
          label: link.label,
          href: link.href,
          icon: "none",
          external: false,
        })),
      })),
      socials: fallback.socials.map((item) => ({ id: item.id, label: item.label, href: item.href, icon: "none" })),
      rights: messages.footer.rights,
      labels,
      privacyHref: localePath(locale, "/privacy"),
      cookiesHref: localePath(locale, "/cookie-policy"),
    };
  }

  const background = BACKGROUNDS[config.background];
  const pick = (value: { readonly th: string; readonly en: string }): string =>
    locale === "en" && value.en.trim() !== "" ? value.en : value.th;

  return {
    footerClass: background.className,
    onDark: background.onDark,
    logo: config.logo,
    about: pick(config.about),
    contact: {
      address: pick(config.contact.address),
      phone: config.contact.phone,
      email: config.contact.email,
    },
    groups: config.groups.map((group) => ({
      id: group.id,
      title: pick(group.title),
      links: group.links.map((link) => ({
        id: link.id,
        label: pick(link.label),
        href: resolveFooterHref(locale, link.href),
        icon: link.icon,
        external: /^https?:/i.test(link.href),
      })),
    })),
    socials: config.socials.map((item) => ({
      id: item.id,
      label: pick(item.label),
      href: item.href,
      icon: item.icon,
    })),
    rights: pick(config.rights),
    labels,
    privacyHref: localePath(locale, "/privacy"),
    cookiesHref: localePath(locale, "/cookie-policy"),
  };
}
