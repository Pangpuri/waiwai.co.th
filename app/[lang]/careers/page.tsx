import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { buildBoard } from "@/features/careers/board";
import { CAREERS_CONTACT } from "@/features/careers/contact";
import { countPositions, departmentsInUse, totalOpenings } from "@/features/careers/jobs";
import { JobBoard } from "@/features/careers/ui/job-board";
import { Breadcrumb } from "@/features/shell/ui/breadcrumb";
import { buildAlternates, isLocale, localePath } from "@/lib/i18n/config";
import { getMessages, getMessagesFor } from "@/lib/i18n/dictionaries";

/**
 * หน้า /careers (ร่วมงานกับไวไว)
 *
 * เว็บเดิมแสดงเป็นตารางทึบ ๆ — หน้านี้เปลี่ยนเป็นการ์ด + กรองตามฝ่าย (ผู้ใช้ขอ 2026-09-25)
 * ข้อมูลจริง 20 ตำแหน่งจาก `Work with Wai Wai.txt` (ดู features/careers/jobs.ts)
 *
 * หน้าทั้งหน้ายัง prerender เป็น static: การกรองทำที่ฝั่ง client ไม่ใช้ searchParams
 */

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/careers">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};

  const messages = await getMessagesFor(lang);

  return {
    title: { absolute: messages.careersPage.meta.title },
    description: messages.careersPage.meta.description,
    alternates: buildAlternates(lang, "/careers"),
    openGraph: {
      title: messages.careersPage.meta.title,
      description: messages.careersPage.meta.description,
    },
  };
}

export default async function CareersPage({ params }: PageProps<"/[lang]/careers">) {
  const { lang } = await params;

  // ภาษาที่ไม่รองรับ → 404 (ไม่ใช่ 500) เหมือนหน้าอื่น
  if (!isLocale(lang)) notFound();
  const messages = await getMessages(lang);

  const m = messages.careersPage;
  const board = buildBoard(messages);

  /* ตัวเลขในส่วนหัวคำนวณจากข้อมูลจริง (มีเทสต์กันพลาด) */
  const stats: readonly { readonly value: number; readonly label: string }[] = [
    { value: countPositions(), label: m.stats.positions },
    { value: totalOpenings(), label: m.stats.openings },
    { value: departmentsInUse().length, label: m.stats.departments },
  ];

  return (
    <>
      <section className="border-b border-line bg-bg-subtle">
        <div className="container-site py-12 lg:py-16">
          <Breadcrumb
            ariaLabel={messages.a11y.breadcrumb}
            items={[
              { label: messages.nav.home, href: localePath(lang, "/") },
              { label: messages.nav.careers },
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

          <ul className="mt-9 flex flex-wrap gap-3">
            {stats.map((stat) => (
              <li
                key={stat.label}
                className="rounded-2xl border border-line bg-surface px-5 py-4"
              >
                <span className="block font-display text-3xl leading-none font-extrabold text-fg">
                  {stat.value}
                </span>
                <span className="mt-1.5 block text-xs font-semibold text-fg-muted">
                  {stat.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container-site py-16 lg:py-24">
        <h2 className="font-display text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">
          {m.boardTitle}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fg-muted">{m.boardIntro}</p>

        <div className="mt-8">
          <JobBoard board={board} />
        </div>
      </section>

      <section className="border-t border-line bg-bg-subtle">
        <div className="container-site py-16 lg:py-24">
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">
            {m.applyTitle}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fg-muted">{m.applyIntro}</p>

          <dl className="mt-8 grid gap-5 sm:grid-cols-2">
            <div className="rounded-2xl border border-line bg-surface p-5">
              <dt className="text-xs font-bold tracking-[0.14em] text-fg-muted uppercase">
                {m.applyEmailLabel}
              </dt>
              <dd className="mt-2">
                <a
                  href={`mailto:${CAREERS_CONTACT.email}`}
                  className="text-base font-semibold text-link underline-offset-4 hover:underline"
                >
                  {CAREERS_CONTACT.email}
                </a>
              </dd>
            </div>

            <div className="rounded-2xl border border-line bg-surface p-5">
              <dt className="text-xs font-bold tracking-[0.14em] text-fg-muted uppercase">
                {m.applyPhoneLabel}
              </dt>
              <dd className="mt-2 text-base font-semibold text-fg">
                <a href={`tel:${CAREERS_CONTACT.phone.tel}`} className="text-link hover:underline">
                  {CAREERS_CONTACT.phone.display}
                </a>{" "}
                {m.applyExtLabel} {CAREERS_CONTACT.phone.ext}
                <span className="mx-2 text-fg-muted">·</span>
                <span className="text-xs font-semibold text-fg-muted">{m.applyMobileLabel}</span>{" "}
                <a href={`tel:${CAREERS_CONTACT.mobile.tel}`} className="text-link hover:underline">
                  {CAREERS_CONTACT.mobile.display}
                </a>
              </dd>
            </div>

            <div className="rounded-2xl border border-line bg-surface p-5">
              <dt className="text-xs font-bold tracking-[0.14em] text-fg-muted uppercase">
                {m.applyAddressLabel}
              </dt>
              <dd className="mt-2 text-sm leading-relaxed text-fg">
                {m.companyName}
                <br />
                {m.address}
              </dd>
            </div>

            <div className="rounded-2xl border border-line bg-surface p-5">
              <dt className="text-xs font-bold tracking-[0.14em] text-fg-muted uppercase">
                {m.applyContactLabel}
              </dt>
              <dd className="mt-2 text-base font-semibold text-fg">{m.contactPerson}</dd>
            </div>
          </dl>

          <Link
            href={localePath(lang, "/about")}
            className="mt-8 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-fg transition-colors hover:border-line-strong"
          >
            {m.aboutLink}
            <span aria-hidden="true" className="text-accent">
              →
            </span>
          </Link>

          <p className="mt-8 max-w-3xl rounded-2xl border border-line bg-surface px-5 py-4 text-xs leading-relaxed text-fg-muted">
            {m.note}
          </p>
        </div>
      </section>
    </>
  );
}
