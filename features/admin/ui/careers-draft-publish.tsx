"use client";

import { useActionState } from "react";

import { publishOneJobDraftAction } from "@/app/admin/careers/actions";
import { INITIAL_JOB_DRAFT_PUBLISH_STATE } from "@/features/admin/careers-state";
import type { Messages } from "@/lib/i18n/messages/th";

type Strings = Messages["adminCareers"];

export function CareersDraftPublish({ id, strings }: { readonly id: string; readonly strings: Strings }) {
  const [state, action, pending] = useActionState(
    publishOneJobDraftAction,
    INITIAL_JOB_DRAFT_PUBLISH_STATE,
  );
  const message =
    state.status === "error"
      ? state.reason === "database"
        ? strings.bulkPublishError
        : strings.bulkPublishNoDrafts
      : state.status === "published"
        ? strings.publishOneSuccess
        : "";

  return (
    <div>
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <button
          type="submit"
          disabled={pending}
          className="border-line text-fg hover:bg-surface-raised focus-visible:ring-ring rounded-lg border px-2.5 py-1 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
        >
          {pending ? strings.publishingOne : strings.publishOne}
        </button>
      </form>
      {message === "" ? null : (
        <p
          className={`${state.status === "error" ? "text-danger" : "text-fg"} mt-1 text-xs`}
          role={state.status === "error" ? "alert" : "status"}
        >
          {message}
        </p>
      )}
    </div>
  );
}
