import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumb } from "@/features/shell/ui/breadcrumb";
import { SampleNotice } from "@/features/shell/ui/sample-notice";
import { buildAlternates, isLocale, localePath } from "@/lib/i18n/config";
import { getMessages, getMessagesFor } from "@/lib/i18n/dictionaries";
import type { Messages } from "@/lib/i18n/messages/th";
import { describeRetention } from "@/lib/retention/format";
import { RETENTION_CLASSES, retentionDaysFor, type RetentionClass } from "@/lib/retention/plan";
import { loadSiteSettings } from "@/lib/site-settings/loader";

/*
  ต่ออายุเพจนี้เองทุก 5 นาที — หน้านี้แสดง "ข้อมูลผู้ควบคุม" จากตั้งค่าส่วนกลางในฐานข้อมูล
  ⚠️ ต้องเป็นค่าคงที่ literal เท่านั้น (เทสต์ scripts/test-isr.ts บังคับให้ตรงกับ PAGE_REVALIDATE_SECONDS)
*/
export const revalidate = 300;

/**
 * หน้า /privacy (นโยบายความเป็นส่วนตัว) — X2b
 *
 * ทำไมหน้านี้สำคัญ
 * - ทั้ง nav และ footer ลิงก์มาที่ `/privacy` อยู่แล้ว และ **ข้อความยินยอมของทั้ง 3 ฟอร์มเขียนว่า
 *   "ตามนโยบายความเป็นส่วนตัว"** ⇒ ถ้าไม่มีหน้านี้ ผู้ใช้กดยินยอมแล้วเจอลิงก์ 404
 * - **ระยะเวลาเก็บไม่ได้เขียนมือในหน้านี้** — ดึงจาก `lib/retention/plan.ts` ตัวเดียวกับที่ตัวลบใช้
 *   ⇒ เอกสารสาธารณะกับสิ่งที่ระบบทำจริงหลุดจากกันไม่ได้
 * - ชื่อ/ที่อยู่/ช่องทางติดต่อของผู้ควบคุม ดึงจาก "ตั้งค่าส่วนกลาง" (ฉบับเผยแพร่) — ไม่ hardcode
 *   ⚠️ ถ้าตั้งค่ายังว่าง หน้าจะบอกตรง ๆ ว่า "ยังไม่ได้กรอก" ไม่แต่งข้อมูลขึ้นเอง
 * - หน้านี้ **ไม่ใช่แถวในตาราง `page`** (ตารางนั้นผูกกับเมนูหลัก 9 รายการ) ⇒ ไม่มีช่องแก้ SEO จากหลังบ้าน
 *   และไม่ปรากฏในเมนู — ปรากฏใน sitemap ผ่านรายการ "หน้าในโค้ด" ที่ `lib/pages/paths.ts`
 *
 * ⚠️ เนื้อหาเป็น "ร่าง" รอเจ้าของ/ที่ปรึกษากฎหมายตรวจ (มีกล่องแจ้งบนหน้า)
 */

/** ป้ายชื่อชั้นข้อมูลเป็นภาษาไทย/อังกฤษ — Record ทำให้เพิ่มชั้นข้อมูลใหม่แล้วลืมป้าย = compile error */
function retentionLabels(m: Messages["privacyPage"]): Readonly<Record<RetentionClass, string>> {
  return {
    contact: m.retentionLabelContact,
    newsletter: m.retentionLabelNewsletter,
    careers: m.retentionLabelCareers,
    loginAttempt: m.retentionLabelLoginAttempt,
    auditLog: m.retentionLabelAuditLog,
  };
}

export async function generateMetadata({ params }: PageProps<"/[lang]/privacy">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};

  const messages = await getMessagesFor(lang);
  const m = messages.privacyPage;

  /* ใช้ template ของ layout (`%s | ชื่อเว็บ`) — ไม่ตั้งเป็น absolute */
  return {
    title: m.meta.title,
    description: m.meta.description,
    alternates: buildAlternates(lang, "/privacy"),
    openGraph: { title: m.meta.title, description: m.meta.description },
  };
}

export default async function PrivacyPage({ params }: PageProps<"/[lang]/privacy">) {
  const { lang } = await params;

  if (!isLocale(lang)) notFound();
  const messages = await getMessages(lang);
  const m = messages.privacyPage;

  /* ข้อมูลผู้ควบคุมจากตั้งค่าส่วนกลาง (ฉบับเผยแพร่) — ยังไม่ตั้ง = ค่าเริ่มต้นในโค้ด */
  const settings = await loadSiteSettings(lang);
  const org = settings.organization;

  const labels = retentionLabels(m);

  const collected = [
    { title: m.collectContactTitle, body: m.collectContactBody },
    { title: m.collectNewsletterTitle, body: m.collectNewsletterBody },
    { title: m.collectCareersTitle, body: m.collectCareersBody },
  ];

  const purposes = [m.purposeReply, m.purposeNews, m.purposeRecruit, m.purposeSecurity];

  const rights = [
    { title: m.rightAccessTitle, body: m.rightAccessBody },
    { title: m.rightCorrectTitle, body: m.rightCorrectBody },
    { title: m.rightDeleteTitle, body: m.rightDeleteBody },
    { title: m.rightObjectTitle, body: m.rightObjectBody },
    { title: m.rightWithdrawTitle, body: m.rightWithdrawBody },
    { title: m.rightComplainTitle, body: m.rightComplainBody },
  ];

  const controller = [
    { label: m.controllerNameLabel, value: org.legalName[lang], href: null as string | null },
    { label: m.controllerAddressLabel, value: org.address[lang], href: null },
    { label: m.controllerPhoneLabel, value: org.phone, href: org.phone === "" ? null : `tel:${org.phone}` },
    { label: m.controllerEmailLabel, value: org.email, href: org.email === "" ? null : `mailto:${org.email}` },
  ];

  const sections: readonly { readonly title: string; readonly body: string }[] = [
    { title: m.sharingTitle, body: m.sharingBody },
    { title: m.cookiesTitle, body: m.cookiesBody },
    { title: m.securityTitle, body: m.securityBody },
    { title: m.contactTitle, body: m.contactBody },
  ];

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

          <SampleNotice text={m.draftNotice} />
        </div>
      </section>

      <div className="container-site flex max-w-3xl flex-col gap-10 py-16 lg:py-24">
        {/* ผู้ควบคุมข้อมูล — ค่ามาจากตั้งค่าส่วนกลาง ไม่ได้เขียนไว้ในโค้ด */}
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-2xl font-bold text-fg">{m.controllerTitle}</h2>
          <p className="text-base leading-relaxed text-fg-muted">{m.controllerIntro}</p>
          <dl className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-5 sm:p-6">
            {controller.map((row) => (
              <div key={row.label} className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
                <dt className="text-fg-muted text-sm font-medium sm:w-40 sm:shrink-0">{row.label}</dt>
                <dd className="text-fg text-sm font-semibold">
                  {row.value === "" ? (
                    <span className="text-fg-muted font-normal italic">{m.controllerMissing}</span>
                  ) : row.href === null ? (
                    row.value
                  ) : (
                    <a
                      href={row.href}
                      className="text-link focus-visible:ring-ring underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {row.value}
                    </a>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* เก็บข้อมูลอะไร */}
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-2xl font-bold text-fg">{m.collectTitle}</h2>
          <p className="text-base leading-relaxed text-fg-muted">{m.collectIntro}</p>
          <ul className="flex flex-col gap-3">
            {collected.map((item) => (
              <li key={item.title} className="rounded-2xl border border-line bg-surface p-5">
                <p className="text-fg text-sm font-semibold">{item.title}</p>
                <p className="text-fg-muted mt-1 text-sm leading-relaxed">{item.body}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ใช้ทำอะไร */}
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-2xl font-bold text-fg">{m.purposeTitle}</h2>
          <p className="text-base leading-relaxed text-fg-muted">{m.purposeIntro}</p>
          <ul className="flex flex-col gap-2">
            {purposes.map((item) => (
              <li key={item} className="flex gap-3 text-sm leading-relaxed text-fg">
                <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-red" />
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* ระยะเวลาเก็บ — ดึงจากค่ากลางเดียวกับตัวลบข้อมูล */}
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-2xl font-bold text-fg">{m.retentionTitle}</h2>
          <p className="text-base leading-relaxed text-fg-muted">{m.retentionIntro}</p>
          <div className="overflow-x-auto rounded-2xl border border-line">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-surface-raised">
                <tr>
                  <th scope="col" className="text-fg px-4 py-3 font-semibold">
                    {m.retentionColData}
                  </th>
                  <th scope="col" className="text-fg px-4 py-3 font-semibold whitespace-nowrap">
                    {m.retentionColKeep}
                  </th>
                </tr>
              </thead>
              <tbody>
                {RETENTION_CLASSES.map((cls) => (
                  <tr key={cls} className="border-t border-line">
                    <td className="text-fg px-4 py-3 align-top">{labels[cls]}</td>
                    <td className="text-fg-muted px-4 py-3 align-top whitespace-nowrap">
                      {describeRetention(retentionDaysFor(cls), lang)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-fg-muted text-sm leading-relaxed">{m.retentionNote}</p>
        </section>

        {/* สิทธิ์ของเจ้าของข้อมูล */}
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-2xl font-bold text-fg">{m.rightsTitle}</h2>
          <p className="text-base leading-relaxed text-fg-muted">{m.rightsIntro}</p>
          <ul className="flex flex-col gap-3">
            {rights.map((item) => (
              <li key={item.title} className="rounded-2xl border border-line bg-surface p-5">
                <p className="text-fg text-sm font-semibold">{item.title}</p>
                <p className="text-fg-muted mt-1 text-sm leading-relaxed">{item.body}</p>
              </li>
            ))}
          </ul>
        </section>

        {sections.map((section) => (
          <section key={section.title} className="flex flex-col gap-3">
            <h2 className="font-display text-2xl font-bold text-fg">{section.title}</h2>
            <p className="text-base leading-relaxed text-fg-muted">{section.body}</p>
          </section>
        ))}

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
