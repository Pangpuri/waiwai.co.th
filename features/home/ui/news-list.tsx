import Image from "next/image";
import Link from "next/link";

import { formatDate } from "@/lib/format";
import { localePath, type Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages/th";

import { NEWS_ENTRIES } from "../content";
import type { HomeNewsItem } from "../view-models";
import { SectionHeading } from "./section-heading";

type NewsListProps = {
  readonly locale: Locale;
  readonly messages: Messages;
  /** ข่าวจริงจากฐานข้อมูล — ว่าง = ถอยไปใช้การ์ดตัวอย่าง (เดโมไม่พัง) */
  readonly items: readonly HomeNewsItem[];
};

/**
 * ส่วน "ความเคลื่อนไหวล่าสุด" ของหน้าแรก (รอบที่ 108)
 *
 * ⚠️ จุดที่แก้: การ์ดข่าวของจริง **กดไปหน้าข่าวนั้นได้จริง** (`/news/<id>`)
 *   เดิมการ์ดทุกใบ (ข้อมูลทดสอบ) พาไปที่หน้ารวมข่าวเท่านั้น และวันที่ถูกแต่งขึ้น
 * - มีข่าวจริง ⇒ แสดงภาพปกจริง + วันที่จริง + ชื่อ + คำโปรย + ลิงก์ไปหน้าข่าว
 * - ไม่มีข้อมูล ⇒ การ์ดตัวอย่างเดิมจากพจนานุกรม (ติดป้าย "ทดสอบ") — ไม่แต่งข่าวขึ้นเอง
 */
export function NewsList({ locale, messages, items }: NewsListProps) {
  const m = messages.news;
  const hasReal = items.length > 0;

  return (
    <section className="container-site py-16 lg:py-24">
      <SectionHeading
        eyebrow={m.eyebrow}
        title={m.title}
        body={m.body}
        action={
          <Link
            href={localePath(locale, "/news")}
            className="inline-flex items-center gap-2 rounded-full border-2 border-line-strong px-5 py-3 text-sm font-bold text-fg transition-colors hover:bg-bg-subtle"
          >
            {messages.actions.viewAllNews}
          </Link>
        }
      />

      <ul className="mt-10 grid gap-6 md:grid-cols-3">
        {hasReal
          ? items.map((item) => (
              <li key={item.id}>
                <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-colors hover:border-line-strong">
                  <Link href={item.href} className="group flex h-full flex-col focus-visible:outline-offset-4">
                    {item.image === null ? (
                      <span aria-hidden="true" className="block h-44 bg-bg-subtle" />
                    ) : (
                      <span className="relative block h-44 overflow-hidden bg-bg-subtle">
                        <Image
                          src={item.image.src}
                          alt={item.title}
                          fill
                          sizes="(max-width: 768px) 92vw, (max-width: 1024px) 45vw, 360px"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </span>
                    )}

                    <span className="flex flex-1 flex-col p-6">
                      {item.published === "" ? null : (
                        <time dateTime={item.dateTime} className="text-xs font-medium text-fg-muted">
                          {item.published}
                        </time>
                      )}

                      <h3 className="mt-3 font-display text-lg leading-snug font-bold text-fg group-hover:text-accent">
                        {item.title}
                      </h3>

                      {item.excerpt === "" ? null : (
                        <p className="mt-3 flex-1 text-sm leading-relaxed text-fg-muted">{item.excerpt}</p>
                      )}

                      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
                        {messages.actions.readMore}
                        <span aria-hidden="true">→</span>
                      </span>
                    </span>
                  </Link>
                </article>
              </li>
            ))
          : NEWS_ENTRIES.map((entry) => {
              const item = m.items[entry.id];
              const published = formatDate(entry.date, locale);

              return (
                <li key={entry.id}>
                  <article className="flex h-full flex-col rounded-2xl border border-line bg-surface p-6 transition-colors hover:border-line-strong">
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-bg-cream px-3 py-1 text-xs font-bold text-accent">
                        {item.tag}
                      </span>
                      {published ? (
                        <time dateTime={entry.date} className="text-xs font-medium text-fg-muted">
                          {published}
                        </time>
                      ) : null}
                    </div>

                    <h3 className="mt-4 font-display text-lg leading-snug font-bold text-fg">
                      <Link href={localePath(locale, "/news")} className="hover:text-accent">
                        {item.title}
                      </Link>
                    </h3>

                    <p className="mt-3 flex-1 text-sm leading-relaxed text-fg-muted">{item.excerpt}</p>

                    <Link
                      href={localePath(locale, "/news")}
                      className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
                    >
                      {messages.actions.readMore}
                      <span aria-hidden="true">→</span>
                    </Link>
                  </article>
                </li>
              );
            })}
      </ul>
    </section>
  );
}
