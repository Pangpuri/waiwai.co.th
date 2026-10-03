import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { buildAlternates, isLocale, localePath, LOCALE_SWITCH_LABEL } from "@/lib/i18n/config";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import { MAINTENANCE_RETRY_AFTER_SECONDS } from "@/lib/maintenance/plan";
import { loadSiteSettings } from "@/lib/site-settings/loader";

/*
  ต่ออายุเพจนี้เองทุก 5 นาที — หน้านี้แสดงชื่อ/ช่องทางติดต่อจากตั้งค่าส่วนกลางในฐานข้อมูล
  ⚠️ ต้องเป็นค่าคงที่ literal เท่านั้น (เทสต์ scripts/test-isr.ts บังคับให้ตรงกับ PAGE_REVALIDATE_SECONDS)
*/
export const revalidate = 300;

/**
 * หน้าแจ้งปิดปรับปรุง (X2.5) — ปลายทางที่ proxy เสิร์ฟเมื่อเปิด `MAINTENANCE_MODE`
 *
 * กติกาของหน้านี้
 * - **เร็วเท่าเดิม**: หน้าอยู่ในเส้นทาง static/ISR ปกติ ⇒ ตอนปิดโหมดไม่มีภาระเพิ่มเลย
 * - **ไม่สัญญาเวลาที่ไม่รู้**: บอกว่าจะกลับมาโดยเร็วที่สุด + ช่องทางติดต่อที่ใช้ได้จริง (จากตั้งค่าส่วนกลาง)
 * - **noindex**: หน้าที่เป็นข้อความชั่วคราวต้องไม่ถูกจัดทำดัชนี (proxy ก็ส่ง `x-robots-tag` ให้ด้วย)
 * - เข้าได้เสมอแม้เปิดโหมด (proxy บายพาส) — ถ้าบล็อกจะกลายเป็นวนซ้ำ
 * - เปลี่ยนภาษาได้จากหน้านี้ (คนไทย/ต่างชาติต้องอ่านออกทั้งคู่ตอนเว็บปิด)
 */
export async function generateMetadata({ params }: PageProps<"/[lang]/maintenance">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};

  const messages = await getMessagesFor(lang);
  const m = messages.maintenancePage;

  return {
    title: m.meta.title,
    description: m.meta.description,
    /* บอกเครื่องมือว่าเป็น 503 ชั่วคราว — สำคัญกว่า canonical ของหน้าปกติ */
    robots: { index: false, follow: false },
    alternates: buildAlternates(lang, "/maintenance"),
  };
}

export default async function MaintenancePage({ params }: PageProps<"/[lang]/maintenance">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const messages = await getMessagesFor(lang);
  const m = messages.maintenancePage;
  const settings = await loadSiteSettings(lang);
  const org = settings.organization;

  const contact: readonly { readonly label: string; readonly value: string; readonly href: string | null }[] = [
    {
      label: m.contactPhoneLabel,
      value: org.phone,
      href: org.phone === "" ? null : `tel:${org.phone}`,
    },
    {
      label: m.contactEmailLabel,
      value: org.email,
      href: org.email === "" ? null : `mailto:${org.email}`,
    },
  ];

  const otherLocale = lang === "th" ? "en" : "th";

  return (
    <section className="border-b border-line bg-bg-subtle">
      <div className="container-site flex min-h-[70vh] max-w-3xl flex-col justify-center py-16 lg:py-24">
        <p className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.18em] text-accent uppercase">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-red" />
          {m.eyebrow}
        </p>

        <h1 className="mt-4 font-display text-4xl leading-[1.12] font-extrabold tracking-tight text-fg sm:text-5xl">
          {m.title}
        </h1>

        <p className="text-fg-muted mt-5 max-w-2xl text-base leading-relaxed sm:text-lg">{m.body}</p>

        {/* ช่องทางติดต่อ — ค่าจริงจากตั้งค่าส่วนกลาง · ว่าง = บอกตรง ๆ ว่า "ยังไม่ได้กรอก" (ไม่แต่งขึ้นเอง) */}
        <div className="mt-10 rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <h2 className="font-display text-lg font-bold text-fg">{m.contactTitle}</h2>
          {org.phone === "" && org.email === "" ? (
            <p className="text-fg-muted mt-2 text-sm italic">{m.contactMissing}</p>
          ) : (
            <dl className="mt-3 flex flex-col gap-2">
              {contact
                .filter((row) => row.value !== "")
                .map((row) => (
                  <div key={row.label} className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
                    <dt className="text-fg-muted text-sm font-medium sm:w-32 sm:shrink-0">{row.label}</dt>
                    <dd className="text-fg text-sm font-semibold">
                      {row.href === null ? (
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
          )}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2">
          {/* เปลี่ยนภาษา: เก็บ path เดิมไว้ (คนละภาษา = คนละ URL ของหน้าเดียวกัน) */}
          <Link
            href={localePath(otherLocale, "/maintenance")}
            className="text-link focus-visible:ring-ring text-sm font-semibold underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
          >
            {m.languageLabel}: {LOCALE_SWITCH_LABEL[otherLocale]}
          </Link>
          <p className="text-fg-muted text-xs">
            {m.retryNote} · {String(Math.round(MAINTENANCE_RETRY_AFTER_SECONDS / 60))} min
          </p>
        </div>
      </div>
    </section>
  );
}
