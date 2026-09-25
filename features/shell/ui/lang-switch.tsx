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
};

/**
 * ปุ่มสลับภาษา — ใช้ usePathname() เพื่อคงเส้นทางเดิมไว้
 * เช่น /th/news/1 → /en/news/1 (ไม่ใช่เด้งกลับหน้าแรก)
 */
export function LangSwitch({ current, variant = "header" }: LangSwitchProps) {
  const pathname = usePathname();
  const isFooter = variant === "footer";

  return (
    <nav
      aria-label={LOCALE_SWITCH_LABEL[current]}
      className={[
        "inline-flex items-center gap-0.5 rounded-full p-0.5",
        isFooter ? "border border-line-strong" : "border border-line bg-surface",
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
