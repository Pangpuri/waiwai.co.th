import type { Metadata } from "next";
import { SubmitForm } from "@/features/forms/ui/submit-form";
import Image from "next/image";
import { notFound } from "next/navigation";

import {
  CONTACT_PHONES,
  CONTACT_PLANTS,
  CONTACT_TOPICS,
  MAP_IMAGE,
} from "@/features/contact/content";
import { Breadcrumb } from "@/features/shell/ui/breadcrumb";
import { SampleNotice } from "@/features/shell/ui/sample-notice";
import { buildAlternates, isLocale, localePath } from "@/lib/i18n/config";
import { getMessages, getMessagesFor } from "@/lib/i18n/dictionaries";
import { loadPageSeo } from "@/lib/pages/repository";
import { withPageSeo } from "@/lib/seo/page-seo";

/*
  ต่ออายุเพจนี้เองทุก 5 นาที (ตาข่ายกันลืม) — กดเผยแพร่จากหลังบ้านจะสั่งให้สร้างใหม่ทันที (X1.7)
  ⚠️ ต้องเป็น **ค่าคงที่ literal** เท่านั้น · Next อ่านค่านี้จากซอร์สตอน build
     (ถ้าเขียน = PAGE_REVALIDATE_SECONDS จะพังด้วย "Invalid segment configuration export detected")
     เทสต์ scripts/test-isr.ts บังคับให้ค่านี้ตรงกับ PAGE_REVALIDATE_SECONDS ใน lib/cache/window.ts
*/
export const revalidate = 300;

/**
 * หน้า /contact (ติดต่อเรา)
 *
 * - ช่องทางติดต่อ + ที่ตั้งโรงงาน (ข้อมูลจริงจากแผนที่/ประกาศของบริษัท)
 * - ฟอร์มติดต่อตาม `contact/formcontact.txt` — **เป็นตัวอย่าง ยังใช้งานไม่ได้**
 *   เพราะยังไม่มีฝั่งรับข้อมูล (ข้อกำหนด: ห้ามโฆษณาปุ่มที่ไม่มีปลายทาง → ปุ่มส่งถูก `disabled`
 *   และมีข้อความอธิบายกำกับ + ช่องทางจริงให้ใช้แทน)
 * - แผนที่ที่ตั้งโรงงาน (ภาพที่บริษัททำเอง — ย่อขนาดด้วย sharp ก่อนใช้)
 */

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/contact">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};

  const messages = await getMessagesFor(lang);

  /* ค่า SEO จากหลังบ้าน (W2) — ไม่ตั้งค่า = ใช้ค่าเดิมจากพจนานุกรมเป๊ะ */
  return withPageSeo(lang, "/contact", {
    title: { absolute: messages.contactPage.meta.title },
    description: messages.contactPage.meta.description,
    alternates: buildAlternates(lang, "/contact"),
    openGraph: {
      title: messages.contactPage.meta.title,
      description: messages.contactPage.meta.description,
    },
  }, () => loadPageSeo("contact"));
}

export default async function ContactPage({ params }: PageProps<"/[lang]/contact">) {
  const { lang } = await params;

  // ภาษาที่ไม่รองรับ → 404 (ไม่ใช่ 500) เหมือนหน้าอื่น
  if (!isLocale(lang)) notFound();
  const messages = await getMessages(lang);

  const m = messages.contactPage;

  const fieldClass =
    "w-full rounded-xl border-2 border-line-strong bg-surface px-4 py-3 text-sm text-fg outline-none placeholder:text-fg-muted/70 focus:border-brand-red";
  const labelClass = "block text-sm font-semibold text-fg";
  const requiredMark = (
    <>
      {" "}
      <span aria-hidden="true" className="text-brand-red">
        *
      </span>
    </>
  );

  return (
    <>
      <section className="border-b border-line bg-bg-subtle">
        <div className="container-site py-12 lg:py-16">
          <Breadcrumb
            ariaLabel={messages.a11y.breadcrumb}
            items={[
              { label: messages.nav.home, href: localePath(lang, "/") },
              { label: messages.nav.contact },
            ]}
          />

          <p className="mt-8 inline-flex items-center gap-2 text-xs font-bold tracking-[0.18em] text-accent uppercase">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-red" />
            {m.eyebrow}
          </p>

          <h1 className="mt-4 max-w-3xl font-display text-4xl leading-[1.12] font-extrabold tracking-tight text-fg sm:text-5xl">
            {m.title}
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-relaxed text-fg-muted sm:text-lg">
            {m.intro}
          </p>
        </div>
      </section>

      <section className="container-site py-16 lg:py-24">
        <h2 className="font-display text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">
          {m.channelsTitle}
        </h2>

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          <div className="rounded-2xl border border-line bg-surface p-5">
            <h3 className="text-xs font-bold tracking-[0.14em] text-fg-muted uppercase">
              {m.phoneLabel}
            </h3>
            <ul className="mt-3 space-y-1.5">
              {CONTACT_PHONES.map((phone) => (
                <li key={phone.tel}>
                  <a
                    href={`tel:${phone.tel}`}
                    className="text-base font-semibold text-link underline-offset-4 hover:underline"
                  >
                    {phone.display}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {CONTACT_PLANTS.map((plant) => (
            <div key={plant.id} className="rounded-2xl border border-line bg-surface p-5">
              <h3 className="text-xs font-bold tracking-[0.14em] text-fg-muted uppercase">
                {m.addressLabel}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-fg">
                <span className="font-semibold">{m[plant.nameKey]}</span>
                <br />
                {m[plant.addressKey]}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-line bg-bg-subtle">
        <div className="container-site py-16 lg:py-24">
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">
            {m.formTitle}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fg-muted">{m.formIntro}</p>

          {/*
            ฟอร์มยังใช้งานไม่ได้ (ไม่มีฝั่งรับข้อมูล) → แจ้งชัดและปิดปุ่มส่ง
            ปุ่มที่ disabled + ไม่มี default button ที่กดได้ = ฟอร์มไม่ถูกส่งแม้กด Enter
          */}
          <SampleNotice text={m.notice} />

          {/* 
            ฟอร์มจริง (X1.9): ส่งเข้าฐานข้อมูลของบริษัท · ตรวจซ้ำฝั่งเซิร์ฟเวอร์ · มีกับดักบอต
            ช่องกรอกยังเรนเดอร์จากฝั่งเซิร์ฟเวอร์ (SEO/ไม่มี JS ก็เห็นครบ) — ตัวครอบเป็น client
          */}
          <SubmitForm
            formKind="contact"
            className="mt-8 max-w-3xl"
            strings={{
              submit: m.submit,
              submitting: m.formSubmitting,
              consent: m.consent,
              sent: m.formSent,
              invalid: m.formInvalid,
              rateLimited: m.formRateLimited,
              unavailable: m.formUnavailable,
              consentRequired: m.formConsentRequired,
            }}
            notice={
              <p className="border-line bg-surface text-fg-muted rounded-2xl border px-4 py-3 text-xs leading-relaxed">{m.note}</p>
            }
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="contact-topic">
                  {m.topicLabel}
                  {requiredMark}
                </label>
                <select
                  id="contact-topic"
                  name="topic"
                  required
                  defaultValue=""
                  className={`mt-2 ${fieldClass}`}
                >
                  <option value="" disabled>
                    {m.topicPlaceholder}
                  </option>
                  {CONTACT_TOPICS.map((topic) => (
                    <option key={topic} value={topic}>
                      {m.topics[topic]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass} htmlFor="contact-name">
                  {m.nameLabel}
                  {requiredMark}
                </label>
                <input
                  id="contact-name"
                  name="name"
                  type="text"
                  required
                  autoComplete="name"
                  placeholder={m.namePlaceholder}
                  className={`mt-2 ${fieldClass}`}
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="contact-email">
                  {m.emailLabel}
                  {requiredMark}
                </label>
                <input
                  id="contact-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder={m.emailPlaceholder}
                  className={`mt-2 ${fieldClass}`}
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="contact-phone">
                  {m.phoneFieldLabel}
                  {requiredMark}
                </label>
                <input
                  id="contact-phone"
                  name="phone"
                  type="tel"
                  required
                  autoComplete="tel"
                  placeholder={m.phonePlaceholder}
                  className={`mt-2 ${fieldClass}`}
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="contact-subject">
                  {m.subjectLabel}
                  {requiredMark}
                </label>
                <input
                  id="contact-subject"
                  name="subject"
                  type="text"
                  required
                  placeholder={m.subjectPlaceholder}
                  className={`mt-2 ${fieldClass}`}
                />
              </div>

              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="contact-details">
                  {m.detailsLabel}
                  {requiredMark}
                </label>
                <textarea
                  id="contact-details"
                  name="details"
                  required
                  rows={6}
                  placeholder={m.detailsPlaceholder}
                  className={`mt-2 ${fieldClass}`}
                />
              </div>
            </div>

            <p className="text-fg-muted mt-4 text-xs">{m.requiredNote}</p>
          </SubmitForm>
        </div>
      </section>

      <section className="container-site py-16 lg:py-24">
        <h2 className="font-display text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">
          {m.mapTitle}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fg-muted">{m.mapCaption}</p>

        <figure className="mt-8">
          <Image
            src={MAP_IMAGE.src}
            alt={m.mapAlt}
            width={MAP_IMAGE.width}
            height={MAP_IMAGE.height}
            sizes="(min-width: 1280px) 1200px, 100vw"
            className="h-auto w-full rounded-2xl border border-line bg-surface"
          />
        </figure>
      </section>
    </>
  );
}
