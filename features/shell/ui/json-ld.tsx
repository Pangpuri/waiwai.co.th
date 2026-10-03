import { SITE } from "@/lib/site";
import type { Locale } from "@/lib/i18n/config";
import type { SiteSettings } from "@/lib/site-settings/model";

/**
 * ข้อมูลโครงสร้าง (JSON-LD) สำหรับเครื่องค้นหา (X1.4)
 *
 * ⚠️ ทำไมไม่ใช้ `InlineScript`
 *    `InlineScript` ออกแบบสำหรับสคริปต์ที่ต้องรัน "ก่อน paint" และสลับ `type` ระหว่าง
 *    `text/javascript` (ตอนส่ง HTML) กับ `text/plain` (ฝั่ง client) — ถ้าใช้กับ JSON-LD
 *    ฝั่ง client จะได้ `type="text/plain"` ซึ่งเครื่องค้นหาอ่านไม่ได้
 *    ที่นี่เป็น **Server Component** ⇒ ไม่มีปัญหา React 19 เตือนเรื่อง `<script>` ที่สร้างบน client
 *    (สคริปต์นี้อยู่ใน HTML ที่เรนเดอร์จากเซิร์ฟเวอร์เท่านั้น)
 *
 * ⚠️ ข้อมูลต้องมาจากค่าที่ตรวจแล้วเท่านั้น — ไม่ใส่ค่าที่ผู้ใช้อิสระกรอกลงไปโดยไม่ผ่าน parse
 *    และต้องไม่ทำให้หน้าเว็บพังถ้าค่าหาย (ประกอบออบเจ็กต์แบบ "มีก็ใส่ ไม่มีก็ไม่ใส่")
 */

type JsonLd = Readonly<Record<string, unknown>>;

function organizationJsonLd(locale: Locale, settings: SiteSettings): JsonLd {
  const pick = (value: { readonly th: string; readonly en: string }): string => (locale === "en" && value.en.trim() !== "" ? value.en : value.th);
  const legalName = pick(settings.organization.legalName);
  const address = pick(settings.organization.address);

  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: settings.name.th,
    ...(legalName === "" ? {} : { legalName }),
    url: SITE.url,
    ...(address === "" ? {} : { address: { "@type": "PostalAddress", streetAddress: address, addressCountry: "TH" } }),
    ...(settings.organization.phone === "" ? {} : { telephone: settings.organization.phone }),
    ...(settings.organization.email === "" ? {} : { email: settings.organization.email }),
    ...(settings.socials.length === 0 ? {} : { sameAs: settings.socials }),
  };
}

function websiteJsonLd(locale: Locale, settings: SiteSettings): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: settings.name.th,
    url: SITE.url,
    inLanguage: locale === "th" ? "th-TH" : "en",
  };
}

export type BreadcrumbItem = {
  readonly name: string;
  readonly path: string;
};

function breadcrumbJsonLd(items: readonly BreadcrumbItem[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${SITE.url}${item.path}`,
    })),
  };
}

/**
 * วาง JSON-LD ลงหน้าเว็บ
 * - `kind="organization"` = องค์กร + เว็บไซต์ (ใช้ที่หน้าแรก)
 * - `kind="breadcrumb"` = เส้นทางหน้า (ใช้ที่หน้าย่อย)
 */
export function JsonLd(
  props:
    | { readonly kind: "organization"; readonly locale: Locale; readonly settings: SiteSettings }
    | { readonly kind: "breadcrumb"; readonly items: readonly BreadcrumbItem[] },
) {
  const payload: JsonLd[] =
    props.kind === "organization"
      ? [organizationJsonLd(props.locale, props.settings), websiteJsonLd(props.locale, props.settings)]
      : [breadcrumbJsonLd(props.items)];

  return (
    <>
      {payload.map((entry, index) => (
        <script
          key={index}
          type="application/ld+json"
          // เนื้อหาสร้างจากออบเจ็กต์ที่เราประกอบเอง (ค่าที่ผู้ใช้กรอกถูก escape ด้วย JSON.stringify)
          dangerouslySetInnerHTML={{ __html: JSON.stringify(entry).replace(/</g, "\u003c") }}
        />
      ))}
    </>
  );
}
