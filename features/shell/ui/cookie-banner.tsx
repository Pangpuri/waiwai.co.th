"use client";

import Link from "next/link";

import {
  COOKIE_CONSENT_ATTRIBUTE,
  COOKIE_CONSENT_STORAGE_KEY,
  type CookieConsent,
} from "@/lib/cookie-consent";

export type CookieBannerLabels = {
  readonly title: string;
  readonly body: string;
  readonly accept: string;
  readonly essentialOnly: string;
  readonly policyLink: string;
};

/**
 * แถบขอความยินยอมคุกกี้
 *
 * ไม่มี state ภายใน: การซ่อนแถบทำด้วย CSS ที่ผูกกับ attribute บน <html>
 * (ดู lib/cookie-consent.ts และ app/globals.css)
 * จึงทำงานได้แม้ JavaScript ยังโหลดไม่เสร็จในเฟรมแรก
 */
export function CookieBanner({
  labels,
  policyHref,
}: {
  readonly labels: CookieBannerLabels;
  readonly policyHref: string;
}) {
  function decide(consent: CookieConsent) {
    try {
      window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, consent);
    } catch {
      // เบราว์เซอร์โหมดส่วนตัวเขียนไม่ได้ — ยังต้องปิดแถบให้ผู้ใช้ใช้งานต่อได้
    }
    document.documentElement.setAttribute(COOKIE_CONSENT_ATTRIBUTE, consent);
  }

  return (
    <div
      data-cookie-banner=""
      role="region"
      aria-label={labels.title}
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl rounded-2xl border border-line-strong bg-surface-raised p-4 shadow-xl sm:p-5"
    >
      <p className="font-display text-base font-bold text-fg">{labels.title}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{labels.body}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => decide("all")}
          className="rounded-full bg-brand-red px-4 py-2 text-sm font-semibold text-on-brand transition-opacity hover:opacity-90"
        >
          {labels.accept}
        </button>
        <button
          type="button"
          onClick={() => decide("essential")}
          className="rounded-full border border-line-strong px-4 py-2 text-sm font-semibold text-fg transition-colors hover:bg-bg-subtle"
        >
          {labels.essentialOnly}
        </button>
        <Link
          href={policyHref}
          className="px-2 text-sm font-medium text-link underline underline-offset-4"
        >
          {labels.policyLink}
        </Link>
      </div>
    </div>
  );
}
