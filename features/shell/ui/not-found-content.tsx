"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { DEFAULT_LOCALE, isLocale, localePath, type Locale } from "@/lib/i18n/config";

export type NotFoundCopy = {
  readonly title: string;
  readonly body: string;
  readonly cta: string;
};

/**
 * เนื้อหาหน้า 404
 *
 * `not-found.tsx` ไม่ได้รับ params จึงหาภาษาจาก pathname แทน
 * ทั้งสองภาษาถูกส่งเข้ามาเป็น plain object ชุดเล็ก ๆ (ไม่กี่สตริง)
 */
export function NotFoundContent({
  copy,
}: {
  readonly copy: Record<Locale, NotFoundCopy>;
}) {
  const pathname = usePathname();
  const first = pathname.split("/").filter(Boolean)[0];
  const locale = isLocale(first) ? first : DEFAULT_LOCALE;
  const text = copy[locale];

  return (
    <section className="container-site flex flex-col items-center py-24 text-center lg:py-32">
      <p className="font-display text-6xl leading-none font-extrabold text-brand-yellow sm:text-8xl">
        404
      </p>

      <h1 className="mt-6 font-display text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">
        {text.title}
      </h1>

      <p className="mt-4 max-w-md text-base leading-relaxed text-fg-muted">{text.body}</p>

      <Link
        href={localePath(locale, "/")}
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-brand-red px-6 py-3.5 text-sm font-bold text-on-brand transition-opacity hover:opacity-90"
      >
        {text.cta}
        <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
