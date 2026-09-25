import Link from "next/link";

import { formatDate } from "@/lib/format";
import { localePath, type Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages/th";

import { NEWS_ENTRIES } from "../content";
import { SectionHeading } from "./section-heading";

type NewsListProps = {
  readonly locale: Locale;
  readonly messages: Messages;
};

export function NewsList({ locale, messages }: NewsListProps) {
  const m = messages.news;

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
        {NEWS_ENTRIES.map((entry) => {
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
                    <time
                      dateTime={entry.date}
                      className="text-xs font-medium text-fg-muted"
                    >
                      {published}
                    </time>
                  ) : null}
                </div>

                <h3 className="mt-4 font-display text-lg leading-snug font-bold text-fg">
                  <Link href={localePath(locale, "/news")} className="hover:text-accent">
                    {item.title}
                  </Link>
                </h3>

                <p className="mt-3 flex-1 text-sm leading-relaxed text-fg-muted">
                  {item.excerpt}
                </p>

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
