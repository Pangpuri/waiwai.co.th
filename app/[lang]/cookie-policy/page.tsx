import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumb } from "@/features/shell/ui/breadcrumb";
import { CookieSettingsButton } from "@/features/shell/ui/cookie-settings-button";
import { COOKIE_POLICY_ITEMS } from "@/lib/cookie-policy";
import { buildAlternates, isLocale, localePath } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/dictionaries";

/**
 * หน้า /cookie-policy (นโยบายคุกกี้) — ฉบับใช้งานจริง TH/EN
 *
 * แหล่งความจริงของรายการที่แสดง:
 * - ชื่อคุกกี้/localStorage มาจาก `lib/cookie-policy.ts` (คีย์จริงในโค้ด)
 * - คำอธิบาย/ระยะเวลาเก็บมาจากพจนานุกรม (TH/EN)
 * ⇒ เพิ่มคุกกี้ใหม่แล้วลืมอัปเดต รายการหรือคำแปล = typecheck/เทสต์จับได้
 *
 * หน้านี้ไม่แตะฐานข้อมูล จึงเป็น static ล้วน (ไม่ตั้ง `revalidate`)
 */
export async function generateMetadata({ params }: PageProps<"/[lang]/cookie-policy">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};

  const messages = await getMessages(lang);
  const m = messages.cookiePolicyPage;

  return {
    title: m.meta.title,
    description: m.meta.description,
    alternates: buildAlternates(lang, "/cookie-policy"),
    openGraph: { title: m.meta.title, description: m.meta.description },
  };
}

export default async function CookiePolicyPage({ params }: PageProps<"/[lang]/cookie-policy">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const messages = await getMessages(lang);
  const m = messages.cookiePolicyPage;

  const items = COOKIE_POLICY_ITEMS.map((item) => ({
    ...item,
    purpose: m.items[item.id].purpose,
    duration: m.items[item.id].duration,
  }));

  return (
    <>
      <section className="border-b border-line bg-bg-subtle">
        <div className="container-site py-12 lg:py-16">
          <Breadcrumb
            ariaLabel={messages.a11y.breadcrumb}
            items={[
              { label: messages.nav.home, href: localePath(lang, "/") },
              { label: m.title },
            ]}
          />

          <p className="mt-8 inline-flex items-center gap-2 text-xs font-bold tracking-[0.18em] text-accent uppercase">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-red" />
            {m.eyebrow}
          </p>

          <h1 className="mt-4 max-w-3xl font-display text-4xl leading-[1.12] font-extrabold tracking-tight text-fg sm:text-5xl">
            {m.title}
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-relaxed text-fg-muted sm:text-lg">{m.intro}</p>
        </div>
      </section>

      <div className="container-site flex max-w-3xl flex-col gap-10 py-16 lg:py-24">
        {/* สรุปสั้น ๆ — ให้ผู้ใช้เห็นภาพก่อนลงรายละเอียด */}
        <section className="flex flex-col gap-2 rounded-2xl border border-line bg-surface-raised p-5 sm:p-6">
          <h2 className="font-display text-xl font-bold text-fg">{m.summaryTitle}</h2>
          <p className="text-base leading-relaxed text-fg-muted">{m.summaryBody}</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-2xl font-bold text-fg">{m.whatTitle}</h2>
          <p className="text-base leading-relaxed text-fg-muted">{m.whatBody}</p>
        </section>

        {/* รายการคุกกี้/localStorage — ชื่อมาจากค่าคงที่จริงในโค้ด */}
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-2xl font-bold text-fg">{m.itemsTitle}</h2>
          <p className="text-base leading-relaxed text-fg-muted">{m.itemsIntro}</p>

          {/* จอเล็ก: การ์ดต่อรายการ — ตาราง 4 คอลัมน์บนมือถือจะถูกบีบจนอ่านไม่ได้ */}
          <div className="flex flex-col gap-3 md:hidden">
            {items.map((item) => (
              <div key={item.id} className="rounded-2xl border border-line bg-surface p-4">
                <code className="font-mono text-xs font-semibold break-all">{item.name}</code>
                <span className="mt-1 block text-xs text-fg-muted">{m.kindLabels[item.kind]}</span>
                <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
                  <dt className="text-fg-muted font-medium">{m.tablePurpose}</dt>
                  <dd className="text-fg leading-relaxed">{item.purpose}</dd>
                  <dt className="text-fg-muted font-medium">{m.tableDuration}</dt>
                  <dd className="text-fg leading-relaxed">{item.duration}</dd>
                  <dt className="text-fg-muted font-medium">{m.tableScope}</dt>
                  <dd className="text-fg leading-relaxed">{m.scopeLabels[item.scope]}</dd>
                </dl>
              </div>
            ))}
          </div>

          {/* จอ md ขึ้นไป: ตารางเต็ม — min-width + overflow-x-auto กันคอลัมน์ถูกบีบ */}
          <div className="hidden overflow-x-auto rounded-2xl border border-line md:block">
            <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
              <thead className="bg-surface-raised">
                <tr>
                  <th scope="col" className="text-fg px-4 py-3 font-semibold">
                    {m.tableName}
                  </th>
                  <th scope="col" className="text-fg px-4 py-3 font-semibold">
                    {m.tablePurpose}
                  </th>
                  <th scope="col" className="text-fg px-4 py-3 font-semibold whitespace-nowrap">
                    {m.tableDuration}
                  </th>
                  <th scope="col" className="text-fg px-4 py-3 font-semibold whitespace-nowrap">
                    {m.tableScope}
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-line align-top">
                    <td className="text-fg px-4 py-3 align-top">
                      <code className="font-mono text-xs font-semibold break-all">{item.name}</code>
                      <span className="mt-1 block text-xs text-fg-muted">{m.kindLabels[item.kind]}</span>
                    </td>
                    <td className="text-fg-muted px-4 py-3 align-top leading-relaxed">{item.purpose}</td>
                    <td className="text-fg-muted px-4 py-3 align-top leading-relaxed">{item.duration}</td>
                    <td className="text-fg-muted px-4 py-3 align-top leading-relaxed whitespace-nowrap">
                      {m.scopeLabels[item.scope]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-2xl font-bold text-fg">{m.notUsedTitle}</h2>
          <p className="text-base leading-relaxed text-fg-muted">{m.notUsedBody}</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-2xl font-bold text-fg">{m.thirdPartyTitle}</h2>
          <p className="text-base leading-relaxed text-fg-muted">{m.thirdPartyBody}</p>
          <p className="text-base leading-relaxed text-fg-muted">{m.thirdPartyYouTube}</p>
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noreferrer noopener"
            className="text-link focus-visible:ring-ring w-fit text-sm font-semibold underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
          >
            {m.thirdPartyYouTubeLink}
          </a>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-2xl font-bold text-fg">{m.choicesTitle}</h2>
          <p className="text-base leading-relaxed text-fg-muted">{m.choicesBody}</p>
          <ul className="flex flex-col gap-2">
            {[m.choicesAll, m.choicesEssential].map((choice) => (
              <li key={choice} className="flex gap-3 text-sm leading-relaxed text-fg">
                <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-red" />
                {choice}
              </li>
            ))}
          </ul>
          <p className="text-fg-muted text-sm leading-relaxed">{m.choicesSame}</p>
          <p className="text-fg-muted text-sm leading-relaxed">{m.choicesChange}</p>
          <CookieSettingsButton label={m.consentButton} statusLabel={m.consentStatus} />
          <p className="text-fg-muted text-sm leading-relaxed">{m.choicesBrowser}</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-2xl font-bold text-fg">{m.noConsentTitle}</h2>
          <p className="text-base leading-relaxed text-fg-muted">{m.noConsentBody}</p>
        </section>

        <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <h2 className="font-display text-2xl font-bold text-fg">{m.privacyTitle}</h2>
          <p className="text-base leading-relaxed text-fg-muted">{m.privacyBody}</p>
          <Link
            href={localePath(lang, "/privacy")}
            className="text-link focus-visible:ring-ring w-fit text-sm font-semibold underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
          >
            {m.privacyLink}
          </Link>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-2xl font-bold text-fg">{m.contactTitle}</h2>
          <p className="text-base leading-relaxed text-fg-muted">{m.contactBody}</p>
          <Link
            href={localePath(lang, "/contact")}
            className="text-link focus-visible:ring-ring w-fit text-sm font-semibold underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
          >
            {m.contactLink}
          </Link>
        </section>

        <section className="flex flex-col gap-2 rounded-2xl border border-line bg-surface-raised p-5 sm:p-6">
          <h2 className="text-fg text-sm font-semibold">{m.updatedTitle}</h2>
          <p className="text-fg-muted text-sm leading-relaxed">{m.updatedBody}</p>
          <Link
            href={localePath(lang, "/")}
            className="text-link focus-visible:ring-ring w-fit text-sm font-semibold underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
          >
            {m.backHome}
          </Link>
        </section>
      </div>
    </>
  );
}
