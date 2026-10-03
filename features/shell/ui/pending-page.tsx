import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { buildAlternates, isLocale, localePath } from "@/lib/i18n/config";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import { PENDING_PAGE_FALLBACK_PATHS, pendingPagePath, type PendingPageId } from "@/lib/pages/pending";

/**
 * หน้า "กำลังจัดทำ" ที่ใช้ร่วมกัน (ปิดหนี้ลิงก์ 404 — รอบที่ 81)
 *
 * ทำไมต้องมี
 * - ท้ายเว็บลิงก์ไป 4 หน้าที่ไม่เคยมีปลายทาง (`/sustainability` · `/where-to-buy` · `/cookie-policy` · `/terms`)
 *   ⇒ ผู้ใช้กดแล้วเจอ 404 · ผู้ใช้สั่งให้เมนูตรง IA ⇒ ทางที่ถูกคือ **มีหน้าปลายทางจริง**
 * - หน้านี้ **ไม่แต่งเนื้อหาจริง** (ตามข้อตกลง placeholder) — บอกตรง ๆ ว่ารอข้อมูลที่ยืนยันแล้ว
 *
 * ⚠️ ยังไม่ขึ้น sitemap และ `noindex` — พอได้ข้อความจริงให้เปลี่ยนเป็นเนื้อหาจริงแล้วถอดออกจาก
 *    `PENDING_PAGE_IDS` (มีเทสต์คุมว่าไม่มีหน้าที่ "กำลังจัดทำ" หลุดเข้า sitemap)
 */

/** หน้าที่ใช้ component นี้ + ข้อมูล metadata ของตัวเอง */
export async function pendingPageMetadata(locale: string, id: PendingPageId): Promise<Metadata> {
  if (!isLocale(locale)) return {};

  const messages = await getMessagesFor(locale);
  const item = messages.pendingPages.items[id];

  return {
    title: item.title,
    description: item.description,
    /* ยังไม่มีเนื้อหาจริง ⇒ ห้ามเครื่องค้นหาจัดทำดัชนี */
    robots: { index: false, follow: false },
    alternates: buildAlternates(locale, pendingPagePath(id)),
  };
}

export async function PendingPage({ locale, id }: { readonly locale: string; readonly id: PendingPageId }) {
  if (!isLocale(locale)) notFound();

  const messages = await getMessagesFor(locale);
  const item = messages.pendingPages.items[id];

  return (
    <section className="border-line bg-bg-subtle border-b">
      <div className="container-site flex min-h-[60vh] max-w-3xl flex-col justify-center py-16 lg:py-24">
        <p className="text-accent inline-flex items-center gap-2 text-xs font-bold tracking-[0.18em] uppercase">
          <span aria-hidden="true" className="bg-brand-red h-1.5 w-1.5 rounded-full" />
          {messages.pendingPages.eyebrow}
        </p>

        <h1 className="text-fg font-display mt-4 text-4xl leading-[1.12] font-extrabold tracking-tight sm:text-5xl">
          {item.title}
        </h1>

        <p className="text-fg-muted mt-5 max-w-2xl text-base leading-relaxed sm:text-lg">{item.description}</p>
        <p className="text-fg-muted mt-3 max-w-2xl text-sm leading-relaxed">{messages.pendingPages.body}</p>

        <div className="border-line bg-surface mt-10 rounded-2xl border p-5 sm:p-6">
          <h2 className="text-fg font-display text-lg font-bold">{messages.pendingPages.whatNextTitle}</h2>
          <ul className="mt-3 flex flex-col gap-2">
            <li>
              <Link
                href={localePath(locale, PENDING_PAGE_FALLBACK_PATHS.home)}
                className="text-link focus-visible:ring-ring text-sm font-semibold underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
              >
                {messages.pendingPages.whatNextHome}
              </Link>
            </li>
            <li>
              <Link
                href={localePath(locale, PENDING_PAGE_FALLBACK_PATHS.contact)}
                className="text-link focus-visible:ring-ring text-sm font-semibold underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
              >
                {messages.pendingPages.whatNextContact}
              </Link>
            </li>
          </ul>
        </div>

        <p className="text-fg-muted mt-8 text-xs">{messages.pendingPages.notFoundNote}</p>
      </div>
    </section>
  );
}
