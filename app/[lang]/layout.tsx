import type { Metadata } from "next";
import { Anuphan, IBM_Plex_Sans_Thai } from "next/font/google";

import "../globals.css";

import { CookieBanner } from "@/features/shell/ui/cookie-banner";
import { InlineScript } from "@/features/shell/ui/inline-script";
import { MourningNotice } from "@/features/shell/ui/mourning-notice";
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
import { HERO_CARD_INIT_SCRIPT } from "@/lib/hero-card";
import { loadFooterConfig, loadNavbarConfig } from "@/lib/chrome/loader";
import { loadSiteSettings } from "@/lib/site-settings/loader";
import { siteNameFor } from "@/lib/site-settings/model";
import { loadMourningNotice } from "@/lib/mourning/loader";
import { MOURNING_INIT_SCRIPT } from "@/lib/mourning-notice";
import { REVEAL_INIT_SCRIPT } from "@/lib/scroll-reveal";
import { BRAND_APPLE_TOUCH_ICON, BRAND_ICONS, BRAND_OG_IMAGE } from "@/lib/brand/assets";
import { SITE } from "@/lib/site";
import { THEME_INIT_SCRIPT } from "@/lib/theme/theme";

/*
  ต่ออายุเพจนี้เองทุก 5 นาที (ตาข่ายกันลืม) — กดเผยแพร่จากหลังบ้านจะสั่งให้สร้างใหม่ทันที (X1.7)
  ⚠️ ต้องเป็น **ค่าคงที่ literal** เท่านั้น · Next อ่านค่านี้จากซอร์สตอน build
     (ถ้าเขียน = PAGE_REVALIDATE_SECONDS จะพังด้วย "Invalid segment configuration export detected")
     เทสต์ scripts/test-isr.ts บังคับให้ค่านี้ตรงกับ PAGE_REVALIDATE_SECONDS ใน lib/cache/window.ts
*/
export const revalidate = 300;

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
  /* ตั้งค่าส่วนกลางจากหลังบ้าน (X1.3) — ค่าเริ่มต้น = พฤติกรรมเดิมเป๊ะ */
  const settings = await loadSiteSettings(lang);
  const siteName = siteNameFor(settings, lang);

  return {
    metadataBase: new URL(SITE.url),
    /*
      ไอคอนเว็บ (รอบที่ 109) — ค่าเริ่มต้นคือ **โลโก้แบรนด์จริง** ที่เตรียมไว้ใน `public/brand/`
      · หลังบ้าน (ตั้งค่าส่วนกลาง) ยัง **override ได้** ด้วย `settings.favicon` (พฤติกรรมเดิม)
      · `favicon.ico` อยู่ที่ `public/favicon.ico` (เบราว์เซอร์ร้องขอพาธนี้เองโดยไม่ต้องประกาศ)
      · ไอคอน 192/512 มาจาก `logo/icon_web.png` (พื้นขาว) · `apple-touch-icon` = 180 พื้นขาว
    */
    icons:
      settings.favicon !== ""
        ? { icon: settings.favicon }
        : {
            icon: BRAND_ICONS.map((icon) => ({ url: icon.path, type: "image/png", sizes: icon.sizes })),
            apple: [{ url: BRAND_APPLE_TOUCH_ICON.path, sizes: BRAND_APPLE_TOUCH_ICON.sizes }],
          },
    title: {
      default: messages.meta.defaultTitle,
      template: `%s | ${siteName}`,
    },
    description: messages.meta.defaultDescription,
    // ไม่ตั้ง `alternates` ที่นี่ — canonical/hreflang ต้องเป็นของแต่ละหน้า
    // (ถ้าตั้งที่ layout ทุกหน้าจะประกาศตัวเองเป็นหน้าแรก) ใช้ buildAlternates() ใน page แทน
    openGraph: {
      type: "website",
      siteName,
      locale: LOCALE_HTML_LANG[lang],
      title: messages.meta.defaultTitle,
      description: messages.meta.defaultDescription,
      /*
        รูปแชร์เริ่มต้น: หลังบ้านตั้งไว้ = ใช้ของหลังบ้าน · ไม่ตั้ง = ใช้การ์ดแบรนด์ที่เตรียมไว้ (รอบที่ 109)
        (หน้าที่ย่อยตั้ง OG ของตัวเอง — เช่น หน้าข่าว — จะทับค่านี้ตามเดิม)
      */
      images:
        settings.defaultOgImage === ""
          ? [{ url: BRAND_OG_IMAGE.path, width: BRAND_OG_IMAGE.width, height: BRAND_OG_IMAGE.height, alt: siteName }]
          : [settings.defaultOgImage],
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

  /* ค่าป๊อปอัพไว้อาลัย: อ่านจากหลังบ้าน (ฉบับที่เผยแพร่) — ถ้าไม่มีฐานข้อมูล/ข้อมูลเสีย ใช้ค่าเริ่มต้นในโค้ด */
  const mourningNotice = await loadMourningNotice(chromeLocale);
  /* แถบเมนูจากหลังบ้าน — null = ใช้เมนูเดิมในโค้ด (ดู lib/chrome/loader.ts) */
  const navbarConfig = await loadNavbarConfig(chromeLocale);
  /* ท้ายเว็บจากหลังบ้าน — null = ใช้ของเดิมในโค้ด (W3) */
  const footerConfig = await loadFooterConfig(chromeLocale);

  return (
    <html
      lang={LOCALE_HTML_LANG[chromeLocale]}
      className={`${headingFont.variable} ${bodyFont.variable}`}
      // สคริปต์ด้านล่างแก้คลาสบน <html> ก่อน hydrate จึงต้องปิดคำเตือนนี้
      suppressHydrationWarning
    >
      <head>
        {/* สคริปต์ก่อน paint — ตั้งธีม สถานะคุกกี้/ประกาศไว้อาลัย/การ์ดบน hero และสวิตช์จางเนื้อหา เพื่อกันจอวาบ
            (รายละเอียดใน features/shell/ui/inline-script.tsx) */}
        <InlineScript html={THEME_INIT_SCRIPT} />
        <InlineScript html={COOKIE_CONSENT_INIT_SCRIPT} />
        <InlineScript html={MOURNING_INIT_SCRIPT} />
        <InlineScript html={HERO_CARD_INIT_SCRIPT} />
        <InlineScript html={REVEAL_INIT_SCRIPT} />
      </head>

      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-surface focus:px-5 focus:py-3 focus:text-sm focus:font-bold focus:text-fg focus:shadow-lg"
        >
          {messages.a11y.skipToContent}
        </a>

        {/*
          ⚠️ รอบที่ 56: ติดธง `data-layout-header` ที่ตัว <header> เอง (ไม่ห่อ div)
          เพราะการห่อ div ทำให้ `position: sticky` ของหัวเว็บหลุด (มันจะติดอยู่แค่ในกรอบ div นั้น)
        */}
        <SiteHeader locale={chromeLocale} messages={messages} navbar={navbarConfig} layoutHeader />

        <main id="main" className="flex-1">
          {children}
        </main>

        <SiteFooter locale={chromeLocale} messages={messages} footer={footerConfig} layoutFooter />

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

        {/* ประกาศไว้อาลัย — ค่ามาจากหลังบ้าน (แก้ได้เอง) โดยมีค่าเริ่มต้นในโค้ด/พจนานุกรมเป็น fallback
            ⇒ ถ้าฐานข้อมูลว่างหรือยังไม่ตั้งค่า หน้าเว็บทำงานเหมือนเดิมเป๊ะ (ดู lib/mourning/loader.ts) */}
        {mourningNotice.enabled && mourningNotice.images.length > 0 ? (
          <MourningNotice
            images={mourningNotice.images}
            locale={chromeLocale}
            labels={{
              dialogLabel: messages.mourning.dialogLabel,
              caption: mourningNotice.caption,
              close: mourningNotice.closeLabel,
              muteToday: mourningNotice.muteTodayLabel,
              seeNext: mourningNotice.seeNextLabel,
              prev: messages.mourning.prev,
              next: messages.mourning.next,
              gotoSlide: messages.mourning.gotoSlide,
            }}
          />
        ) : null}

        {/* ผูก IntersectionObserver ให้เนื้อหาจางเข้าตอนเลื่อน (สคริปต์ใน <head> เป็นคนเปิดสวิตช์) */}
        <ScrollReveal />
      </body>
    </html>
  );
}


