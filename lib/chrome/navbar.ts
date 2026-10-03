import { PRIMARY_NAV, HEADER_CTA } from "@/features/shell/nav";
import { isSafeHref } from "@/lib/blocks/types";
import type { LocalizedValue } from "@/lib/content/types";
import type { Messages } from "@/lib/i18n/messages/th";

/**
 * ตั้งค่า "แถบเมนู (navbar)" — ส่วนกลางของเว็บ แก้ได้จากหลังบ้าน (ผู้ใช้สั่ง รอบที่ 53)
 *
 * ผู้ใช้สั่ง: *"ปรับตั้งอัพโหลดไฟล์โลโก้บน navbar สไตล์ของ navbar ตำแหน่งปุ่มของ navbar
 *             เพิ่มปุ่ม เลือกสี มีไอคอนพื้นฐานให้ใช้ในปุ่มได้ — อันนี้ส่วน navbar ก่อน"*
 *
 * ⚠️ ข้อจำกัดที่ยึดตามมติของโปรเจกต์
 * - **สีเลือกได้เฉพาะ "ชุดสีแบรนด์"** (ผู้ใช้ยืนยัน รอบที่ 53) — ไม่รับสีอิสระ/hex
 *   ⇒ โหมดมืด/คอนทราสต์/ด่าน check:dark ยังคุมได้ และตัวเรนเดอร์เลือกสีตัวอักษรบนพื้นให้เอง
 * - **ไอคอน = ชุดที่เขียนเอง** (`features/shell/ui/nav-icon.tsx`) ไม่เพิ่มไลบรารี
 * - ค่าเริ่มต้น = เมนูปัจจุบันในโค้ด ⇒ ถ้าฐานข้อมูลว่าง/ข้อมูลเสีย หน้าเว็บเหมือนเดิมเป๊ะ
 */

export const NAVBAR_PAGE_KEY = "chrome-navbar";
export const MAX_NAV_ITEMS = 10;
export const MAX_NAV_BUTTONS = 3;
export const MAX_NAV_LABEL_LENGTH = 40;

/* ── ชุดสีแบรนด์ (token เท่านั้น) ─────────────────────────────────────────── */

export type NavbarBackground = "transparent" | "surface" | "cream" | "brand" | "ink";

export const NAVBAR_BACKGROUNDS: readonly { readonly value: NavbarBackground; readonly label: string }[] = [
  { value: "surface", label: "ขาว" },
  { value: "cream", label: "ครีม" },
  { value: "brand", label: "แดงแบรนด์" },
  { value: "ink", label: "ดำ" },
  { value: "transparent", label: "โปร่งใส (เห็นภาพด้านหลัง)" },
];

export type NavbarHeight = "compact" | "normal" | "tall";

export const NAVBAR_HEIGHTS: readonly { readonly value: NavbarHeight; readonly label: string }[] = [
  { value: "compact", label: "กะทัดรัด" },
  { value: "normal", label: "ปกติ" },
  { value: "tall", label: "สูง" },
];

/** โทนปุ่มบนแถบเมนู — เลือกจากชุดสีแบรนด์เท่านั้น */
export type NavbarButtonTone = "brand" | "outline" | "contrast";

export const NAVBAR_BUTTON_TONES: readonly { readonly value: NavbarButtonTone; readonly label: string }[] = [
  { value: "brand", label: "แดงแบรนด์ (เด่น)" },
  { value: "contrast", label: "ดำ" },
  { value: "outline", label: "เส้นขอบ" },
];

export type NavbarButtonPosition = "left" | "right";

export const NAVBAR_BUTTON_POSITIONS: readonly { readonly value: NavbarButtonPosition; readonly label: string }[] = [
  { value: "left", label: "ซ้ายของเมนู" },
  { value: "right", label: "ขวาของเมนู" },
];

/* ── ไอคอนพื้นฐาน (คีย์เท่านั้น — ตัว SVG อยู่ที่ features/shell/ui/nav-icon.tsx) ── */

export type NavIconKey =
  | "none"
  | "cart"
  | "phone"
  | "mail"
  | "pin"
  | "user"
  | "search"
  | "tag"
  | "star"
  | "arrow"
  | "line"
  | "facebook"
  | "youtube"
  | "shopee"
  | "lazada";

export const NAV_ICON_KEYS: readonly { readonly value: NavIconKey; readonly label: string }[] = [
  { value: "none", label: "ไม่มีไอคอน" },
  { value: "cart", label: "รถเข็น (สั่งซื้อ)" },
  { value: "phone", label: "โทรศัพท์" },
  { value: "mail", label: "อีเมล" },
  { value: "pin", label: "แผนที่/ที่อยู่" },
  { value: "user", label: "ผู้ใช้" },
  { value: "search", label: "ค้นหา" },
  { value: "tag", label: "ป้ายราคา/โปรโมชัน" },
  { value: "star", label: "ดาว/รางวัล" },
  { value: "arrow", label: "ลูกศร" },
  { value: "line", label: "LINE" },
  { value: "facebook", label: "Facebook" },
  { value: "youtube", label: "YouTube" },
  { value: "shopee", label: "Shopee" },
  { value: "lazada", label: "Lazada" },
];

export function isNavIconKey(value: unknown): value is NavIconKey {
  return typeof value === "string" && NAV_ICON_KEYS.some((entry) => entry.value === value);
}

/* ── โครงข้อมูล ───────────────────────────────────────────────────────────── */

export type NavbarLogo = {
  /** พาธในโปรเจกต์ (`/media/<id>`) — มติ D9 ห้ามเก็บ URL เต็ม */
  readonly path: string;
  readonly altTh: string;
  readonly altEn: string;
};

export type NavbarItem = {
  readonly id: string;
  readonly label: LocalizedValue;
  readonly href: string;
  readonly icon: NavIconKey;
};

export type NavbarButton = {
  readonly id: string;
  readonly label: LocalizedValue;
  readonly href: string;
  readonly icon: NavIconKey;
  readonly tone: NavbarButtonTone;
  readonly position: NavbarButtonPosition;
};

export type NavbarConfig = {
  readonly logo: NavbarLogo | null;
  readonly logoSize: "sm" | "md" | "lg";
  readonly background: NavbarBackground;
  readonly height: NavbarHeight;
  readonly items: readonly NavbarItem[];
  readonly buttons: readonly NavbarButton[];
};

/* ── ค่าเริ่มต้น = เมนูปัจจุบันในโค้ด (ห้ามเปลี่ยนพฤติกรรมเดิม) ──────────────── */

export function defaultNavbarConfig(messages: Messages): NavbarConfig {
  const items: NavbarItem[] = PRIMARY_NAV.map((item) => ({
    id: item.id,
    label: { th: messages.nav[item.labelKey], en: messages.nav[item.labelKey] },
    href: item.anchor === undefined ? item.path : `${item.path}#${item.anchor}`,
    icon: "none",
  }));

  const buttons: NavbarButton[] = [
    {
      id: HEADER_CTA.id,
      label: { th: messages.nav[HEADER_CTA.labelKey], en: messages.nav[HEADER_CTA.labelKey] },
      href: HEADER_CTA.anchor === undefined ? HEADER_CTA.path : `${HEADER_CTA.path}#${HEADER_CTA.anchor}`,
      icon: "cart",
      tone: "brand",
      position: "right",
    },
  ];

  return {
    logo: null,
    logoSize: "md",
    background: "surface",
    height: "normal",
    items,
    buttons,
  };
}

/* ── อ่านข้อมูลจากหลังบ้าน (ไม่เชื่อข้อมูลที่ส่งมา) ─────────────────────────── */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toText(value: unknown, fallback: LocalizedValue): LocalizedValue {
  if (!isRecord(value)) return fallback;
  const th = typeof value["th"] === "string" ? value["th"].slice(0, MAX_NAV_LABEL_LENGTH) : fallback.th;
  const en = typeof value["en"] === "string" ? value["en"].slice(0, MAX_NAV_LABEL_LENGTH) : fallback.en;
  return { th, en };
}

function toChoice<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/**
 * ข้อมูล "หน้า" ที่เกี่ยวข้องกับเมนู (W1 — ผู้ใช้สั่ง รอบที่ 61: "เมนูก็คงเอาไว้ตามหน้า")
 * • `labels` = ชื่อเมนูที่มาจากตาราง `page` (คีย์ = id ของเมนู/หน้า)
 * • `hidden` = หน้าที่ถูกตั้ง "ไม่แสดงในเมนู"
 */
export type PageMenuInfo = {
  readonly labels: Readonly<Record<string, { readonly th: string; readonly en: string }>>;
  readonly hidden: readonly string[];
};

/**
 * ใช้ "ชื่อหน้า" ทับป้ายเมนูของ navbar + ซ่อนเมนูที่หน้าถูกปิดไว้
 *
 * ⚠️ กฎความปลอดภัย: ถ้าการซ่อนจะทำให้ **เมนูไม่เหลืออะไรเลย** ⇒ คืนค่าเดิม (ไม่ทำเมนูหายทั้งแถบ)
 * ⚠️ ไม่แตะรายการที่ไม่มีหน้าคู่กัน (เช่นปุ่มที่เพิ่มเอง) — ชื่อที่ตั้งในหน้าจอ navbar ยังมีผลตามเดิม
 */
export function applyPageMenu(config: NavbarConfig, info: PageMenuInfo): NavbarConfig {
  const hidden = new Set(info.hidden);
  const kept = config.items.filter((item) => !hidden.has(item.id));
  const items = kept.length === 0 ? config.items : kept;

  return {
    ...config,
    items: items.map((item) => {
      const label = info.labels[item.id];
      if (label === undefined) return item;
      return { ...item, label: { th: label.th, en: label.en } };
    }),
  };
}

export type NavbarParseResult =
  | { readonly ok: true; readonly config: NavbarConfig }
  | { readonly ok: false; readonly problems: readonly string[] };

export function parseNavbarConfig(raw: unknown, messages: Messages): NavbarParseResult {
  const fallback = defaultNavbarConfig(messages);
  if (!isRecord(raw)) return { ok: false, problems: ["ข้อมูลที่ส่งมาไม่ใช่ออบเจ็กต์"] };

  const problems: string[] = [];

  /* โลโก้: ไม่มี = ใช้ wordmark เดิม · มี = ต้องมีพาธ + คำอธิบายภาพไทย */
  let logo: NavbarLogo | null = null;
  const rawLogo = raw["logo"];
  if (rawLogo !== null && rawLogo !== undefined) {
    if (!isRecord(rawLogo)) {
      problems.push("logo: ต้องเป็นออบเจ็กต์หรือ null");
    } else {
      const path = typeof rawLogo["path"] === "string" ? rawLogo["path"].trim() : "";
      if (path === "") {
        logo = null;
      } else {
        logo = {
          path,
          altTh: typeof rawLogo["altTh"] === "string" ? rawLogo["altTh"] : "",
          altEn: typeof rawLogo["altEn"] === "string" ? rawLogo["altEn"] : "",
        };
      }
    }
  }

  const rawItems = raw["items"];
  if (rawItems !== undefined && !Array.isArray(rawItems)) problems.push("items: ต้องเป็นรายการ (array)");
  const itemList = Array.isArray(rawItems) ? rawItems.slice(0, MAX_NAV_ITEMS) : fallback.items;

  const items: NavbarItem[] = [];
  itemList.forEach((entry, index) => {
    if (!isRecord(entry)) {
      problems.push(`items[${index}]: ต้องเป็นออบเจ็กต์`);
      return;
    }
    const href = typeof entry["href"] === "string" ? entry["href"].trim() : "";
    items.push({
      id: typeof entry["id"] === "string" && entry["id"] !== "" ? entry["id"] : `item-${index + 1}`,
      label: toText(entry["label"], { th: "", en: "" }),
      href,
      icon: isNavIconKey(entry["icon"]) ? entry["icon"] : "none",
    });
  });

  const rawButtons = raw["buttons"];
  if (rawButtons !== undefined && !Array.isArray(rawButtons)) problems.push("buttons: ต้องเป็นรายการ (array)");
  const buttonList = Array.isArray(rawButtons) ? rawButtons.slice(0, MAX_NAV_BUTTONS) : fallback.buttons;

  const buttons: NavbarButton[] = [];
  buttonList.forEach((entry, index) => {
    if (!isRecord(entry)) {
      problems.push(`buttons[${index}]: ต้องเป็นออบเจ็กต์`);
      return;
    }
    buttons.push({
      id: typeof entry["id"] === "string" && entry["id"] !== "" ? entry["id"] : `button-${index + 1}`,
      label: toText(entry["label"], { th: "", en: "" }),
      href: typeof entry["href"] === "string" ? entry["href"].trim() : "",
      icon: isNavIconKey(entry["icon"]) ? entry["icon"] : "none",
      tone: toChoice(entry["tone"], ["brand", "contrast", "outline"] as const, "brand"),
      position: toChoice(entry["position"], ["left", "right"] as const, "right"),
    });
  });

  const config: NavbarConfig = {
    logo,
    logoSize: toChoice(raw["logoSize"], ["sm", "md", "lg"] as const, fallback.logoSize),
    background: toChoice(
      raw["background"],
      ["transparent", "surface", "cream", "brand", "ink"] as const,
      fallback.background,
    ),
    height: toChoice(raw["height"], ["compact", "normal", "tall"] as const, fallback.height),
    items,
    buttons,
  };

  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, config };
}

/* ── ตรวจความถูกต้อง (ใช้ทั้งหน้าจอหลังบ้านและตอนโหลดไปใช้) ─────────────────── */

export type NavbarIssue = {
  readonly severity: "error" | "warning";
  readonly code: string;
  readonly path: string;
  readonly detail: string | null;
};

export function validateNavbarConfig(config: NavbarConfig): readonly NavbarIssue[] {
  const issues: NavbarIssue[] = [];

  if (config.items.length === 0) {
    issues.push({ severity: "error", code: "no-items", path: "items", detail: "ต้องมีเมนูอย่างน้อย 1 รายการ" });
  }

  const seen = new Set<string>();
  config.items.forEach((item, index) => {
    const path = `items[${index}]`;
    if (item.label.th.trim() === "") {
      issues.push({ severity: "error", code: "empty-th", path: `${path}.label.th`, detail: null });
    }
    if (item.href === "") {
      issues.push({ severity: "error", code: "empty-href", path: `${path}.href`, detail: null });
    } else if (!isSafeHref(item.href)) {
      issues.push({ severity: "error", code: "bad-href", path: `${path}.href`, detail: null });
    }
    if (seen.has(item.id)) {
      issues.push({ severity: "error", code: "duplicate-id", path: `${path}.id`, detail: null });
    }
    seen.add(item.id);
  });

  config.buttons.forEach((button, index) => {
    const path = `buttons[${index}]`;
    if (button.label.th.trim() === "") {
      issues.push({ severity: "error", code: "empty-th", path: `${path}.label.th`, detail: null });
    }
    if (button.href === "") {
      issues.push({ severity: "error", code: "empty-href", path: `${path}.href`, detail: null });
    } else if (!isSafeHref(button.href)) {
      issues.push({ severity: "error", code: "bad-href", path: `${path}.href`, detail: null });
    }
  });

  if (config.logo !== null) {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(config.logo.path) || config.logo.path.startsWith("//")) {
      issues.push({ severity: "error", code: "media-path-is-url", path: "logo.path", detail: "ต้องเก็บเป็นพาธ (มติ D9)" });
    } else if (!config.logo.path.startsWith("/")) {
      issues.push({ severity: "error", code: "bad-path", path: "logo.path", detail: "พาธต้องขึ้นต้นด้วย /" });
    }
    if (config.logo.altTh.trim() === "") {
      issues.push({ severity: "error", code: "missing-alt", path: "logo.altTh", detail: "โลโก้ต้องมีคำอธิบายภาพ" });
    }
  }

  return issues;
}

export function navbarErrorsOf(issues: readonly NavbarIssue[]): readonly NavbarIssue[] {
  return issues.filter((entry) => entry.severity === "error");
}
