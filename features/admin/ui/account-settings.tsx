"use client";

import { useActionState, useState } from "react";

import { changeOwnEmailAction, changeOwnPasswordAction } from "@/app/admin/account/actions";
import { INITIAL_ACCOUNT_ACTION_STATE, type AccountActionCode } from "@/features/admin/account-state";
import { fillTemplate } from "@/lib/i18n/template";
import type { Messages } from "@/lib/i18n/messages/th";

const FIELD_CLASS =
  "border-line bg-surface text-fg focus-visible:ring-ring w-full rounded-lg border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none";
const LABEL_CLASS = "text-fg-muted text-xs";
const BUTTON_CLASS =
  "bg-brand-red text-on-brand focus-visible:ring-ring w-fit rounded-lg px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40";

function PasswordField({
  id,
  name,
  label,
  autoComplete,
  showPasswordLabel,
  hidePasswordLabel,
  minLength,
  describedBy,
}: {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly autoComplete: string;
  readonly showPasswordLabel: string;
  readonly hidePasswordLabel: string;
  readonly minLength?: number;
  readonly describedBy?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          name={name}
          autoComplete={autoComplete}
          minLength={minLength}
          aria-describedby={describedBy}
          required
          className={`${FIELD_CLASS} pr-12`}
        />
        <button
          type="button"
          aria-label={visible ? hidePasswordLabel : showPasswordLabel}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
          className="text-fg-muted hover:text-fg focus-visible:ring-ring absolute top-1/2 right-1 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:outline-none"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="h-5 w-5"
          >
            <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
            {visible ? <path d="m3 3 18 18" /> : null}
          </svg>
        </button>
      </div>
    </div>
  );
}

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
          <PasswordField
            id="account-email-current-password"
            name="currentPassword"
            label={strings.accountCurrentPassword}
            autoComplete="current-password"
            showPasswordLabel={strings.accountShowPassword}
            hidePasswordLabel={strings.accountHidePassword}
          />
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
          <PasswordField
            id="account-password-current-password"
            name="currentPassword"
            label={strings.accountCurrentPassword}
            autoComplete="current-password"
            showPasswordLabel={strings.accountShowPassword}
            hidePasswordLabel={strings.accountHidePassword}
          />
          <p id="account-password-requirements" className="text-fg-muted text-sm">
            {fillTemplate(strings.accountPasswordRequirements, { min: minPasswordLength })}
          </p>
          <PasswordField
            id="account-password-new-password"
            name="nextPassword"
            label={strings.accountNewPassword}
            autoComplete="new-password"
            showPasswordLabel={strings.accountShowPassword}
            hidePasswordLabel={strings.accountHidePassword}
            minLength={minPasswordLength}
            describedBy="account-password-requirements"
          />
          <PasswordField
            id="account-password-confirm-password"
            name="confirmPassword"
            label={strings.accountConfirmPassword}
            autoComplete="new-password"
            showPasswordLabel={strings.accountShowPassword}
            hidePasswordLabel={strings.accountHidePassword}
            minLength={minPasswordLength}
            describedBy="account-password-requirements"
          />
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
