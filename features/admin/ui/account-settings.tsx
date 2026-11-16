"use client";

import { useActionState } from "react";

import { changeOwnEmailAction, changeOwnPasswordAction } from "@/app/admin/account/actions";
import { INITIAL_ACCOUNT_ACTION_STATE, type AccountActionCode } from "@/features/admin/account-state";
import { fillTemplate } from "@/lib/i18n/template";
import type { Messages } from "@/lib/i18n/messages/th";

const FIELD_CLASS =
  "border-line bg-surface text-fg focus-visible:ring-ring w-full rounded-lg border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none";
const LABEL_CLASS = "text-fg-muted text-xs";
const BUTTON_CLASS =
  "bg-brand-red text-on-brand focus-visible:ring-ring w-fit rounded-lg px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40";

function feedbackOf(
  code: AccountActionCode,
  strings: Messages["admin"],
  minPasswordLength: number,
): { readonly text: string; readonly failed: boolean } | null {
  switch (code) {
    case null:
      return null;
    case "required":
      return { text: strings.accountRequired, failed: true };
    case "bad-email":
      return { text: strings.accountBadEmail, failed: true };
    case "email-mismatch":
      return { text: strings.accountEmailMismatch, failed: true };
    case "duplicate-email":
      return { text: strings.accountEmailDuplicate, failed: true };
    case "same-email":
      return { text: strings.accountEmailSame, failed: true };
    case "bad-password":
      return {
        text: fillTemplate(strings.accountPasswordTooShort, { min: minPasswordLength }),
        failed: true,
      };
    case "password-mismatch":
      return { text: strings.accountPasswordMismatch, failed: true };
    case "wrong-password":
      return { text: strings.accountWrongPassword, failed: true };
    case "email-updated":
      return { text: strings.accountEmailSaved, failed: false };
    case "password-updated":
      return { text: strings.accountPasswordSaved, failed: false };
    case "unavailable":
      return { text: strings.accountUnavailable, failed: true };
    case "failed":
      return { text: strings.accountFailed, failed: true };
  }
}

export function AccountSettings({
  currentEmail,
  minPasswordLength,
  strings,
}: {
  readonly currentEmail: string;
  readonly minPasswordLength: number;
  readonly strings: Messages["admin"];
}) {
  const [emailState, emailAction, emailPending] = useActionState(
    changeOwnEmailAction,
    INITIAL_ACCOUNT_ACTION_STATE,
  );
  const [passwordState, passwordAction, passwordPending] = useActionState(
    changeOwnPasswordAction,
    INITIAL_ACCOUNT_ACTION_STATE,
  );
  const emailFeedback = feedbackOf(emailState.code, strings, minPasswordLength);
  const passwordFeedback = feedbackOf(passwordState.code, strings, minPasswordLength);

  return (
    <div className="flex flex-col gap-5">
      <section className="border-line bg-surface flex flex-col gap-4 rounded-2xl border p-5 sm:p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-fg text-lg font-semibold">{strings.accountEmailTitle}</h2>
          <p className="text-fg-muted text-sm">
            {strings.accountCurrentEmail}: <span className="text-fg break-all">{currentEmail}</span>
          </p>
        </div>
        <form action={emailAction} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>{strings.accountNewEmail}</span>
            <input
              type="email"
              name="nextEmail"
              defaultValue={currentEmail}
              autoComplete="email"
              maxLength={190}
              required
              className={FIELD_CLASS}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>{strings.accountConfirmEmail}</span>
            <input
              type="email"
              name="confirmEmail"
              autoComplete="email"
              maxLength={190}
              required
              className={FIELD_CLASS}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>{strings.accountCurrentPassword}</span>
            <input
              type="password"
              name="currentPassword"
              autoComplete="current-password"
              required
              className={FIELD_CLASS}
            />
          </label>
          {emailFeedback === null ? null : (
            <p className={emailFeedback.failed ? "text-brand-red text-sm" : "text-fg text-sm"} role={emailFeedback.failed ? "alert" : "status"}>
              {emailFeedback.text}
            </p>
          )}
          <button type="submit" disabled={emailPending} className={BUTTON_CLASS}>
            {strings.accountSaveEmail}
          </button>
        </form>
      </section>

      <section className="border-line bg-surface flex flex-col gap-4 rounded-2xl border p-5 sm:p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-fg text-lg font-semibold">{strings.accountPasswordTitle}</h2>
          <p className="text-fg-muted text-sm">{strings.accountPasswordOtherSessions}</p>
        </div>
        <form action={passwordAction} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>{strings.accountCurrentPassword}</span>
            <input
              type="password"
              name="currentPassword"
              autoComplete="current-password"
              required
              className={FIELD_CLASS}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>{strings.accountNewPassword}</span>
            <input
              type="password"
              name="nextPassword"
              autoComplete="new-password"
              minLength={minPasswordLength}
              required
              className={FIELD_CLASS}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>{strings.accountConfirmPassword}</span>
            <input
              type="password"
              name="confirmPassword"
              autoComplete="new-password"
              minLength={minPasswordLength}
              required
              className={FIELD_CLASS}
            />
          </label>
          {passwordFeedback === null ? null : (
            <p
              className={passwordFeedback.failed ? "text-brand-red text-sm" : "text-fg text-sm"}
              role={passwordFeedback.failed ? "alert" : "status"}
            >
              {passwordFeedback.text}
            </p>
          )}
          <button type="submit" disabled={passwordPending} className={BUTTON_CLASS}>
            {strings.accountSavePassword}
          </button>
        </form>
      </section>
    </div>
  );
}
