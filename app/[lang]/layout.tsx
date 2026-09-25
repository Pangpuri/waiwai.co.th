import type { Metadata } from "next";
import { Anuphan, IBM_Plex_Sans_Thai } from "next/font/google";

import "../globals.css";

import { CookieBanner } from "@/features/shell/ui/cookie-banner";
import { InlineScript } from "@/features/shell/ui/inline-script";
import { ScrollReveal } from "@/features/shell/ui/scroll-reveal";
import { SiteFooter } from "@/features/shell/ui/site-footer";
import { SiteHeader } from "@/features/shell/ui/site-header";
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_HTML_LANG,
  isLocale,
  localePath,
} from "@/lib/i18n/config";
import { COOKIE_CONSENT_INIT_SCRIPT } from "@/lib/cookie-consent";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import { REVEAL_INIT_SCRIPT } from "@/lib/scroll-reveal";
import { SITE } from "@/lib/site";
import { THEME_INIT_SCRIPT } from "@/lib/theme/theme";

/* ฟอนต์ต้องโหลดผ่าน next/font เท่านั้น (กฎข้อ 7) */
const headingFont = Anuphan({
  subsets: ["thai", "latin"],
  weight: ["400", "600", "700"],
  variable: "--font-heading",
  display: "swap",
});

const bodyFont = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};

  const messages = await getMessagesFor(lang);

  return {
    metadataBase: new URL(SITE.url),
    title: {
      default: messages.meta.defaultTitle,
      template: `%s | ${messages.meta.siteName}`,
    },
    description: messages.meta.defaultDescription,
    // ไม่ตั้ง `alternates` ที่นี่ — canonical/hreflang ต้องเป็นของแต่ละหน้า
    // (ถ้าตั้งที่ layout ทุกหน้าจะประกาศตัวเองเป็นหน้าแรก) ใช้ buildAlternates() ใน page แทน
    openGraph: {
      type: "website",
      siteName: messages.meta.siteName,
      locale: LOCALE_HTML_LANG[lang],
      title: messages.meta.defaultTitle,
      description: messages.meta.defaultDescription,
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[lang]">) {
  const { lang } = await params;

  /*
    ภาษาที่ไม่รองรับ (เช่น /de) ไม่ควรทำให้ทั้งหน้าพัง — proxy จะ redirect มาก่อนแล้ว
    ถ้าหลุดมาถึงตรงนี้ ให้ใช้ภาษาหลักเรนเดอร์โครงเว็บ แล้วให้ page เป็นคนตอบ 404
  */
  const chromeLocale = isLocale(lang) ? lang : DEFAULT_LOCALE;
  const messages = isLocale(lang) ? await getMessagesFor(lang) : await getMessagesFor(DEFAULT_LOCALE);

  return (
    <html
      lang={LOCALE_HTML_LANG[chromeLocale]}
      className={`${headingFont.variable} ${bodyFont.variable}`}
      // สคริปต์ด้านล่างแก้คลาสบน <html> ก่อน hydrate จึงต้องปิดคำเตือนนี้
      suppressHydrationWarning
    >
      <head>
        {/* สคริปต์ก่อน paint — ตั้งธีม สถานะคุกกี้ และสวิตช์จางเนื้อหา เพื่อกันจอวาบ
            (รายละเอียดใน features/shell/ui/inline-script.tsx) */}
        <InlineScript html={THEME_INIT_SCRIPT} />
        <InlineScript html={COOKIE_CONSENT_INIT_SCRIPT} />
        <InlineScript html={REVEAL_INIT_SCRIPT} />
      </head>

      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-surface focus:px-5 focus:py-3 focus:text-sm focus:font-bold focus:text-fg focus:shadow-lg"
        >
          {messages.a11y.skipToContent}
        </a>

        <SiteHeader locale={chromeLocale} messages={messages} />

        <main id="main" className="flex-1">
          {children}
        </main>

        <SiteFooter locale={chromeLocale} messages={messages} />

        <CookieBanner
          policyHref={localePath(chromeLocale, "/cookie-policy")}
          labels={{
            title: messages.cookie.title,
            body: messages.cookie.body,
            accept: messages.cookie.accept,
            essentialOnly: messages.cookie.essentialOnly,
            policyLink: messages.cookie.policyLink,
          }}
        />

        {/* ผูก IntersectionObserver ให้เนื้อหาจางเข้าตอนเลื่อน (สคริปต์ใน <head> เป็นคนเปิดสวิตช์) */}
        <ScrollReveal />
      </body>
    </html>
  );
}


