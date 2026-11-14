"use client";

import { useActionState } from "react";

import { publishSelectedJobDraftsAction } from "@/app/admin/careers/actions";
import {
  INITIAL_JOB_BULK_PUBLISH_STATE,
} from "@/features/admin/careers-state";
import { fillTemplate } from "@/lib/i18n/template";
import type { Messages } from "@/lib/i18n/messages/th";

type Strings = Messages["adminCareers"];

export function CareersBulkPublish({ count, strings }: { readonly count: number; readonly strings: Strings }) {
  const [state, action, pending] = useActionState(
    publishSelectedJobDraftsAction,
    INITIAL_JOB_BULK_PUBLISH_STATE,
  );
  const message =
    state.status === "published"
      ? fillTemplate(strings.bulkPublishSuccess, { count: String(state.count) })
      : state.status === "error"
        ? state.reason === "database"
          ? strings.bulkPublishError
          : state.reason === "no-drafts"
            ? strings.bulkPublishNoDrafts
            : state.reason === "no-selection"
              ? strings.bulkPublishNoSelection
              : state.reason === "too-many"
                ? strings.bulkPublishTooMany
                : strings.bulkPublishConfirmationError
        : "";

  return (
    <section className="border-line bg-surface mt-6 rounded-2xl border p-4">
      <h2 className="text-fg text-base font-semibold">{strings.bulkPublishTitle}</h2>
      <p className="text-fg-muted mt-1 text-sm">
        {fillTemplate(strings.bulkPublishHint, { count: String(count) })}
      </p>
      <form id="bulk-publish-form" action={action} className="mt-4 flex flex-wrap items-center gap-3">
        <label className="text-fg-muted flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="publishAll"
            value="yes"
            className="accent-accent mt-0.5 size-4"
          />
          <span>{fillTemplate(strings.bulkPublishSelectAll, { count: String(count) })}</span>
        </label>
        <label className="text-fg-muted flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="confirmPublish"
            value="yes"
            required
            className="accent-accent mt-0.5 size-4"
          />
          <span>{strings.bulkPublishConfirm}</span>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="bg-accent text-accent-fg hover:bg-accent-strong focus-visible:ring-ring rounded-full px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {pending ? strings.bulkPublishPending : strings.bulkPublishButton}
        </button>
      </form>
      {message === "" ? null : (
        <p
          className={`${state.status === "error" ? "text-danger" : "text-fg"} mt-3 text-sm`}
          role={state.status === "error" ? "alert" : "status"}
        >
          {message}
        </p>
      )}
    </section>
  );
}
