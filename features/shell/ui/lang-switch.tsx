"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  LOCALES,
  LOCALE_LABELS,
  LOCALE_SWITCH_LABEL,
  switchLocalePath,
  type Locale,
} from "@/lib/i18n/config";

type LangSwitchProps = {
  readonly current: Locale;
  readonly variant?: "header" | "footer";
  /** true = วางบนพื้นเข้ม/พื้นแดง (ตัวอักษรต้องเป็น on-brand) — รอบที่ 313 */
  readonly onDark?: boolean;
};

/**
 * ปุ่มสลับภาษา — ใช้ usePathname() เพื่อคงเส้นทางเดิมไว้
 * เช่น /th/news/1 → /en/news/1 (ไม่ใช่เด้งกลับหน้าแรก)
 */
export function LangSwitch({ current, variant = "header", onDark = false }: LangSwitchProps) {
  const pathname = usePathname();
  const isFooter = variant === "footer";

  return (
    <nav
      aria-label={LOCALE_SWITCH_LABEL[current]}
      className={[
        "inline-flex items-center gap-0.5 rounded-full p-0.5",
        onDark
          ? "border border-on-brand/40"
          : isFooter
            ? "border border-line-strong"
            : "border border-line bg-surface",
      ].join(" ")}
    >
      {LOCALES.map((locale) => {
        const active = locale === current;
        return (
          <Link
            key={locale}
            href={switchLocalePath(pathname, locale)}
            hrefLang={locale}
            aria-current={active ? "true" : undefined}
            className={[
              "rounded-full px-2.5 py-1 text-xs font-semibold transition-colors",
              active
                ? "bg-brand-yellow text-accent-on-yellow"
                : onDark
                  ? "text-on-brand/85 hover:bg-on-brand/10 hover:text-on-brand"
                  : "text-fg-muted hover:bg-bg-subtle hover:text-fg",
            ].join(" ")}
          >
            {LOCALE_LABELS[locale]}
          </Link>
        );
      })}
    </nav>
  );
}
