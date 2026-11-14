"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { saveFormMailRoutingAction } from "@/app/admin/inbox/actions";
import { AdminToast } from "@/features/admin/ui/admin-toast";
import { INITIAL_FORM_MAIL_ROUTING_STATE } from "@/features/admin/form-mail-state";
import type { ContactTopicId } from "@/features/contact/content";
import type { FormMailRouting } from "@/lib/forms/mail-routing";

const FIELD_CLASS =
  "border-line bg-surface text-fg focus-visible:ring-ring w-full rounded-lg border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none";

function SaveButton({ label }: { readonly label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-brand-red text-on-brand focus-visible:ring-ring rounded-lg px-3 py-2 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
    >
      {label}
    </button>
  );
}

export function FormMailRoutingForm({
  initial,
  topics,
  strings,
}: {
  readonly initial: FormMailRouting;
  readonly topics: readonly { readonly id: ContactTopicId; readonly label: string }[];
  readonly strings: {
    readonly title: string;
    readonly hint: string;
    readonly toLabel: string;
    readonly ccLabel: string;
    readonly addressHint: string;
    readonly careers: string;
    readonly save: string;
    readonly saved: string;
    readonly invalid: string;
    readonly failed: string;
  };
}) {
  const [state, formAction] = useActionState(saveFormMailRoutingAction, INITIAL_FORM_MAIL_ROUTING_STATE);
  const statusText =
    state.status === "saved"
      ? strings.saved
      : state.status === "invalid"
        ? strings.invalid
        : state.status === "failed"
          ? strings.failed
          : "";

  return (
    <section className="border-line bg-surface flex flex-col gap-3 rounded-2xl border p-4 sm:p-5">
      <header className="flex flex-col gap-1">
        <h2 className="text-fg text-base font-semibold">{strings.title}</h2>
        <p className="text-fg-muted text-xs leading-relaxed">{strings.hint}</p>
        <p className="text-fg-muted text-[11px]">{strings.addressHint}</p>
      </header>

      <form action={formAction} className="flex flex-col gap-4">
        <div className="grid gap-3">
          {topics.map((topic) => {
            const route = initial.contact[topic.id];
            return (
              <fieldset key={topic.id} className="border-line grid gap-2 rounded-xl border p-3 md:grid-cols-2">
                <legend className="text-fg px-1 text-xs font-semibold">{topic.label}</legend>
                <label className="flex flex-col gap-1">
                  <span className="text-fg-muted text-xs">{strings.toLabel}</span>
                  <input
                    type="text"
                    name={`contact.${topic.id}.to`}
                    defaultValue={route.to}
                    autoComplete="email"
                    required
                    className={FIELD_CLASS}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-fg-muted text-xs">{strings.ccLabel}</span>
                  <input
                    type="text"
                    name={`contact.${topic.id}.cc`}
                    defaultValue={route.cc}
                    autoComplete="email"
                    className={FIELD_CLASS}
                  />
                </label>
              </fieldset>
            );
          })}
        </div>

        <fieldset className="border-line grid gap-2 rounded-xl border p-3 md:grid-cols-2">
          <legend className="text-fg px-1 text-xs font-semibold">{strings.careers}</legend>
          <label className="flex flex-col gap-1">
            <span className="text-fg-muted text-xs">{strings.toLabel}</span>
            <input
              type="text"
              name="careers.to"
              defaultValue={initial.careers.to}
              autoComplete="email"
              required
              className={FIELD_CLASS}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-fg-muted text-xs">{strings.ccLabel}</span>
            <input type="text" name="careers.cc" defaultValue={initial.careers.cc} autoComplete="email" className={FIELD_CLASS} />
          </label>
        </fieldset>

        <div className="flex flex-wrap items-center gap-2">
          <SaveButton label={strings.save} />
          {statusText === "" ? null : (
            <AdminToast
              message={statusText}
              tone={state.status === "invalid" || state.status === "failed" ? "error" : "success"}
              trigger={state}
            />
          )}
        </div>
      </form>

      <span className="sr-only" aria-live="polite">
        {statusText}
      </span>
    </section>
  );
}
