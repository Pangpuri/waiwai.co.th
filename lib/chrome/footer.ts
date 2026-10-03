import { buildFooterColumns } from "@/features/shell/nav";
import { isSafeHref } from "@/lib/blocks/types";
import type { NavIconKey } from "@/lib/chrome/navbar";
import { isNavIconKey } from "@/lib/chrome/navbar";
import type { LocalizedValue } from "@/lib/content/types";
import type { Messages } from "@/lib/i18n/messages/th";
import { SITE } from "@/lib/site";

/**
 * ตั้งค่า "ท้ายเว็บ (footer)" — ส่วนกลางของเว็บ แก้ได้จากหลังบ้าน (W3)
 *
 * ตามแผน WP-model: *"Layout Templates — เค้าโครงหน้าหลัก เช่น Header, Footer … ที่เลือกสลับสไตล์ได้"*
 * ⚠️ ค่าเริ่มต้น = ท้ายเว็บปัจจุบันในโค้ดเป๊ะ ๆ ⇒ **ไม่ตั้งค่า = หน้าเว็บเหมือนเดิมทุกไบต์**
 * ⚠️ สีเลือกจาก "ชุดสีแบรนด์" เท่านั้น (มติ D10) · ไอคอนใช้ชุดที่เขียนเอง (`nav-icon.tsx`)
 */

export const FOOTER_PAGE_KEY = "chrome-footer";
export const MAX_FOOTER_GROUPS = 4;
export const MAX_FOOTER_LINKS = 8;
export const MAX_FOOTER_SOCIALS = 6;
export const MAX_FOOTER_LABEL_LENGTH = 40;

export type FooterBackground = "surface" | "cream" | "ink" | "brand";

export const FOOTER_BACKGROUNDS: readonly { readonly value: FooterBackground; readonly label: string }[] = [
  { value: "cream", label: "ครีม (ค่าเดิม)" },
  { value: "surface", label: "ขาว" },
  { value: "ink", label: "ดำ" },
  { value: "brand", label: "แดงแบรนด์" },
];

export type FooterLink = {
  readonly id: string;
  readonly label: LocalizedValue;
  readonly href: string;
  readonly icon: NavIconKey;
};

export type FooterGroup = {
  readonly id: string;
  readonly title: LocalizedValue;
  readonly links: readonly FooterLink[];
};

export type FooterSocial = {
  readonly id: string;
  readonly label: LocalizedValue;
  readonly href: string;
  readonly icon: NavIconKey;
};

export type FooterLogo = {
  readonly path: string;
  readonly altTh: string;
  readonly altEn: string;
};

export type FooterConfig = {
  readonly logo: FooterLogo | null;
  readonly about: LocalizedValue;
  readonly contact: {
    readonly address: LocalizedValue;
    readonly phone: string;
    readonly email: string;
  };
  readonly groups: readonly FooterGroup[];
  readonly socials: readonly FooterSocial[];
  readonly rights: LocalizedValue;
  readonly background: FooterBackground;
};

/* ── ค่าเริ่มต้น = ท้ายเว็บปัจจุบัน (ห้ามเปลี่ยนพฤติกรรมเดิม) ─────────────────── */

export function defaultFooterConfig(messages: Messages): FooterConfig {
  const columns = buildFooterColumns("th");

  const groups: FooterGroup[] = columns.map((column) => ({
    id: column.id,
    title: { th: messages.footer[column.titleKey], en: messages.footer[column.titleKey] },
    links: column.links.map((link) => ({
      id: `${column.id}-${link.labelKey}`,
      label: { th: messages.footer.links[link.labelKey], en: messages.footer.links[link.labelKey] },
      /* เก็บเป็นพาธ (ไม่รวม prefix ภาษา) — ตัวแปลงเป็น URL จริงอยู่ที่ footer-view */
      href: link.href.replace(/^\/(th|en)(?=\/|$)/, "") || "/",
      icon: "none" as const,
    })),
  }));

  const socials: FooterSocial[] = SITE.social.map((item) => ({
    id: item.id,
    label: { th: item.label, en: item.label },
    href: item.href,
    icon: isNavIconKey(item.id) ? item.id : "none",
  }));

  return {
    logo: null,
    about: { th: messages.footer.about, en: messages.footer.about },
    contact: {
      address: { th: SITE.contact.address, en: SITE.contact.address },
      phone: SITE.contact.phone,
      email: SITE.contact.email,
    },
    groups,
    socials,
    rights: { th: messages.footer.rights, en: messages.footer.rights },
    background: "cream",
  };
}

/* ── อ่านข้อมูลจากหลังบ้าน (ไม่เชื่อข้อมูลที่ส่งมา) ─────────────────────────── */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toText(value: unknown, fallback: LocalizedValue): LocalizedValue {
  if (!isRecord(value)) return fallback;
  const th = typeof value["th"] === "string" ? value["th"].slice(0, MAX_FOOTER_LABEL_LENGTH) : fallback.th;
  const en = typeof value["en"] === "string" ? value["en"].slice(0, MAX_FOOTER_LABEL_LENGTH) : fallback.en;
  return { th, en };
}

export type FooterParseResult =
  | { readonly ok: true; readonly config: FooterConfig }
  | { readonly ok: false; readonly problems: readonly string[] };

export function parseFooterConfig(raw: unknown, messages: Messages): FooterParseResult {
  const fallback = defaultFooterConfig(messages);
  if (!isRecord(raw)) return { ok: false, problems: ["ข้อมูลที่ส่งมาไม่ใช่ออบเจ็กต์"] };

  const problems: string[] = [];

  let logo: FooterLogo | null = null;
  const rawLogo = raw["logo"];
  if (isRecord(rawLogo)) {
    const path = typeof rawLogo["path"] === "string" ? rawLogo["path"].trim() : "";
    if (path !== "") {
      logo = {
        path,
        altTh: typeof rawLogo["altTh"] === "string" ? rawLogo["altTh"] : "",
        altEn: typeof rawLogo["altEn"] === "string" ? rawLogo["altEn"] : "",
      };
    }
  }

  const rawGroups = raw["groups"];
  if (rawGroups !== undefined && !Array.isArray(rawGroups)) problems.push("groups: ต้องเป็นรายการ");
  const groupList = Array.isArray(rawGroups) ? rawGroups.slice(0, MAX_FOOTER_GROUPS) : fallback.groups;

  const groups: FooterGroup[] = [];
  groupList.forEach((entry, index) => {
    if (!isRecord(entry)) {
      problems.push(`groups[${index}]: ต้องเป็นออบเจ็กต์`);
      return;
    }
    const rawLinks = Array.isArray(entry["links"]) ? entry["links"].slice(0, MAX_FOOTER_LINKS) : [];
    const links: FooterLink[] = [];
    rawLinks.forEach((link, linkIndex) => {
      if (!isRecord(link)) {
        problems.push(`groups[${index}].links[${linkIndex}]: ต้องเป็นออบเจ็กต์`);
        return;
      }
      links.push({
        id: typeof link["id"] === "string" && link["id"] !== "" ? link["id"] : `${index}-${linkIndex}`,
        label: toText(link["label"], { th: "", en: "" }),
        href: typeof link["href"] === "string" ? link["href"].trim() : "",
        icon: isNavIconKey(link["icon"]) ? link["icon"] : "none",
      });
    });

    groups.push({
      id: typeof entry["id"] === "string" && entry["id"] !== "" ? entry["id"] : `group-${index + 1}`,
      title: toText(entry["title"], { th: "", en: "" }),
      links,
    });
  });

  const rawSocials = raw["socials"];
  if (rawSocials !== undefined && !Array.isArray(rawSocials)) problems.push("socials: ต้องเป็นรายการ");
  const socialList = Array.isArray(rawSocials) ? rawSocials.slice(0, MAX_FOOTER_SOCIALS) : fallback.socials;

  const socials: FooterSocial[] = [];
  socialList.forEach((entry, index) => {
    if (!isRecord(entry)) {
      problems.push(`socials[${index}]: ต้องเป็นออบเจ็กต์`);
      return;
    }
    socials.push({
      id: typeof entry["id"] === "string" && entry["id"] !== "" ? entry["id"] : `social-${index + 1}`,
      label: toText(entry["label"], { th: "", en: "" }),
      href: typeof entry["href"] === "string" ? entry["href"].trim() : "",
      icon: isNavIconKey(entry["icon"]) ? entry["icon"] : "none",
    });
  });

  const rawContact = isRecord(raw["contact"]) ? raw["contact"] : {};

  const config: FooterConfig = {
    logo,
    about: toText(raw["about"], fallback.about),
    contact: {
      address: toText(rawContact["address"], fallback.contact.address),
      phone: typeof rawContact["phone"] === "string" ? rawContact["phone"].slice(0, 40) : fallback.contact.phone,
      email: typeof rawContact["email"] === "string" ? rawContact["email"].slice(0, 80) : fallback.contact.email,
    },
    groups,
    socials,
    rights: toText(raw["rights"], fallback.rights),
    background: (["surface", "cream", "ink", "brand"] as const).includes(raw["background"] as FooterBackground)
      ? (raw["background"] as FooterBackground)
      : fallback.background,
  };

  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, config };
}

/* ── ตรวจความถูกต้อง ──────────────────────────────────────────────────────── */

export type FooterIssue = {
  readonly severity: "error" | "warning";
  readonly code: string;
  readonly path: string;
  readonly detail: string | null;
};

export function validateFooterConfig(config: FooterConfig): readonly FooterIssue[] {
  const issues: FooterIssue[] = [];

  if (config.groups.length === 0) {
    issues.push({ severity: "error", code: "no-groups", path: "groups", detail: "ต้องมีอย่างน้อย 1 คอลัมน์" });
  }

  const seen = new Set<string>();
  config.groups.forEach((group, index) => {
    const base = `groups[${index}]`;
    if (group.title.th.trim() === "") {
      issues.push({ severity: "error", code: "empty-th", path: `${base}.title.th`, detail: null });
    }
    if (seen.has(group.id)) issues.push({ severity: "error", code: "duplicate-id", path: `${base}.id`, detail: null });
    seen.add(group.id);

    group.links.forEach((link, linkIndex) => {
      const path = `${base}.links[${linkIndex}]`;
      if (link.label.th.trim() === "") issues.push({ severity: "error", code: "empty-th", path: `${path}.label.th`, detail: null });
      if (link.href === "") issues.push({ severity: "error", code: "empty-href", path: `${path}.href`, detail: null });
      else if (!isSafeHref(link.href)) issues.push({ severity: "error", code: "bad-href", path: `${path}.href`, detail: null });
    });
  });

  config.socials.forEach((social, index) => {
    const path = `socials[${index}]`;
    if (social.label.th.trim() === "") issues.push({ severity: "error", code: "empty-th", path: `${path}.label.th`, detail: null });
    if (social.href !== "" && !isSafeHref(social.href)) {
      issues.push({ severity: "error", code: "bad-href", path: `${path}.href`, detail: null });
    }
  });

  if (config.contact.email !== "" && !config.contact.email.includes("@")) {
    issues.push({ severity: "error", code: "bad-email", path: "contact.email", detail: null });
  }

  if (config.logo !== null) {
    if (config.logo.path.includes("://") || config.logo.path.startsWith("//")) {
      issues.push({ severity: "error", code: "media-path-is-url", path: "logo.path", detail: "ต้องเป็นพาธ (มติ D9)" });
    } else if (!config.logo.path.startsWith("/")) {
      issues.push({ severity: "error", code: "bad-path", path: "logo.path", detail: "พาธต้องขึ้นต้นด้วย /" });
    }
    if (config.logo.altTh.trim() === "") {
      issues.push({ severity: "error", code: "missing-alt", path: "logo.altTh", detail: "โลโก้ต้องมีคำอธิบายภาพ" });
    }
  }

  return issues;
}

export function footerErrorsOf(issues: readonly FooterIssue[]): readonly FooterIssue[] {
  return issues.filter((entry) => entry.severity === "error");
}
