import type { Messages } from "@/lib/i18n/messages/th";

import { NewsletterForm } from "./newsletter-form";

export function Newsletter({ messages }: { readonly messages: Messages }) {
  const m = messages.newsletter;

  return (
    <section className="container-site pb-20 lg:pb-28">
      <div className="grid gap-10 rounded-3xl border border-line bg-surface-raised p-7 sm:p-10 lg:grid-cols-2 lg:items-center lg:gap-16">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.18em] text-accent uppercase">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-red" />
            {m.eyebrow}
          </p>
          <h2 className="mt-3 font-display text-2xl leading-tight font-extrabold tracking-tight text-fg sm:text-3xl">
            {m.title}
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-fg-muted">{m.body}</p>
        </div>

        <NewsletterForm
          labels={{
            emailLabel: m.emailLabel,
            emailPlaceholder: m.emailPlaceholder,
            invalidEmail: m.invalidEmail,
            consent: m.consent,
            submit: messages.actions.subscribe,
            note: m.note,
          }}
        />
      </div>
    </section>
  );
}
