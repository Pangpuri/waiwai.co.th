/**
 * รายการคุกกี้และพื้นที่จัดเก็บในเบราว์เซอร์ที่เว็บไซต์นี้ใช้จริง
 *
 * ⚠️ แหล่งความจริงเดียวของหน้า `/cookie-policy`
 * - ชื่อคีย์ดึงจากค่าคงที่ของโมดูลเจ้าของ (ไม่พิมพ์ซ้ำในหน้าเว็บ)
 * - ถ้ามีการเพิ่ม/ลบคุกกี้ในโค้ด ต้องอัปเดตรายการนี้พร้อมกัน
 * - `scripts/test-cookie-policy.ts` ตรวจว่าชื่อทุกรายการตรงกับค่าคงที่จริง
 */

import { ADMIN_SIDEBAR_STORAGE_KEY } from "@/lib/admin/ui-storage";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { COOKIE_CONSENT_STORAGE_KEY } from "@/lib/cookie-consent";
import { HERO_CARD_STORAGE_KEY } from "@/lib/hero-card";
import { MAINTENANCE_BYPASS_COOKIE } from "@/lib/maintenance/bypass";
import { MOURNING_STORAGE_KEY } from "@/lib/mourning-notice";
import { THEME_STORAGE_KEY } from "@/lib/theme/theme";

export const COOKIE_POLICY_KINDS = ["cookie", "localStorage"] as const;
export type CookiePolicyKind = (typeof COOKIE_POLICY_KINDS)[number];

export const COOKIE_POLICY_SCOPES = ["public", "staff"] as const;
export type CookiePolicyScope = (typeof COOKIE_POLICY_SCOPES)[number];

export const COOKIE_POLICY_ITEMS = [
  { id: "adminSession", name: SESSION_COOKIE_NAME, kind: "cookie", scope: "staff" },
  { id: "maintenanceBypass", name: MAINTENANCE_BYPASS_COOKIE, kind: "cookie", scope: "staff" },
  { id: "theme", name: THEME_STORAGE_KEY, kind: "localStorage", scope: "public" },
  { id: "cookieConsent", name: COOKIE_CONSENT_STORAGE_KEY, kind: "localStorage", scope: "public" },
  { id: "mourningNotice", name: MOURNING_STORAGE_KEY, kind: "localStorage", scope: "public" },
  { id: "heroCard", name: HERO_CARD_STORAGE_KEY, kind: "localStorage", scope: "public" },
  { id: "adminSidebar", name: ADMIN_SIDEBAR_STORAGE_KEY, kind: "localStorage", scope: "staff" },
] as const satisfies readonly {
  readonly id: string;
  readonly name: string;
  readonly kind: CookiePolicyKind;
  readonly scope: CookiePolicyScope;
}[];

export type CookiePolicyItem = (typeof COOKIE_POLICY_ITEMS)[number];
export type CookiePolicyItemId = CookiePolicyItem["id"];

/** คีย์ทั้งหมดที่หน้าเว็บอ้างถึง — ใช้ทดสอบกับค่าคงที่ของแต่ละโมดูล */
export const COOKIE_POLICY_ITEM_NAMES: Readonly<Record<CookiePolicyItemId, string>> = Object.fromEntries(
  COOKIE_POLICY_ITEMS.map((item) => [item.id, item.name]),
) as Readonly<Record<CookiePolicyItemId, string>>;

/** label ภาษาไทย/อังกฤษของชนิดและขอบเขต — หน้าคุกกี้เลือกใช้ตาม locale */
export type CookiePolicyKindLabels = Readonly<Record<CookiePolicyKind, string>>;
export type CookiePolicyScopeLabels = Readonly<Record<CookiePolicyScope, string>>;
