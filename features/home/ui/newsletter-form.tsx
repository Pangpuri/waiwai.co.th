"use client";

import { useActionState, useId, useRef } from "react";
import { useFormStatus } from "react-dom";

import { submitPublicFormAction } from "@/app/forms/actions";
import { INITIAL_PUBLIC_FORM_STATE } from "@/features/forms/state";

export type NewsletterFormLabels = {
  readonly emailLabel: string;
  readonly emailPlaceholder: string;
  readonly invalidEmail: string;
  readonly consent: string;
  readonly submit: string;
  readonly note: string;
  /* เพิ่ม รอบที่ 66 (X1.9): ฟอร์มนี้ส่งเข้าฐานข้อมูลจริงแล้ว */
  readonly submitting: string;
  readonly sent: string;
  readonly rateLimited: string;
  readonly unavailable: string;
  readonly consentRequired: string;
};

/**
 * ฟอร์มรับข่าวสาร (X1.9)
 *
 * ✅ เปลี่ยนจาก "ตัวอย่างที่ยังไม่มีปลายทาง" → **ส่งเข้าฐานข้อมูลของบริษัทจริง**
 *    ผ่าน Server Action กลาง (`submitPublicFormAction`) ที่ตรวจค่า/กันสแปม/จำกัดความถี่ให้แล้ว
 *    · ตรวจรูปแบบอีเมลฝั่งจอยังอยู่ (feedback เร็ว) แต่ของจริงตัดสินที่เซิร์ฟเวอร์เสมอ
 *    · กับดักบอต (`website`) ถูกเพิ่มโดยตัว action กลาง — ที่นี่ไม่ต้องรู้จัก
 */
export function NewsletterForm({ labels }: { readonly labels: NewsletterFormLabels }) {
  const [state, formAction] = useActionState(submitPublicFormAction, INITIAL_PUBLIC_FORM_STATE);
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const inputRef = useRef<HTMLInputElement | null>(null);

  const invalidEmail = state.status === "invalid" && state.fields.includes("email");
  const showError = invalidEmail || state.status === "unavailable" || state.status === "rate-limited";

  const message =
    state.status === "ok"
      ? labels.sent
      : invalidEmail
        ? labels.invalidEmail
        : state.status === "invalid"
          ? labels.consentRequired
          : state.status === "rate-limited"
            ? labels.rateLimited
            : state.status === "unavailable"
              ? labels.unavailable
              : "";

  return (
    <form action={formAction} noValidate>
      <input type="hidden" name="form" value="newsletter" />

      {/* กับดักบอต — มนุษย์มองไม่เห็น */}
      <div aria-hidden="true" className="absolute h-0 w-0 overflow-hidden opacity-0">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <label htmlFor={fieldId} className="text-fg block text-sm font-semibold">
        {labels.emailLabel}
      </label>

      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          ref={inputRef}
          id={fieldId}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          dir="ltr"
          placeholder={labels.emailPlaceholder}
          aria-invalid={showError || undefined}
          aria-describedby={showError ? errorId : undefined}
          className={[
            "bg-surface text-fg w-full rounded-full border-2 px-5 py-3.5 text-sm outline-none",
            "placeholder:text-fg-muted/70",
            showError ? "border-brand-red" : "border-line-strong focus:border-brand-red",
          ].join(" ")}
        />

        <NewsletterSubmit label={labels.submit} pendingLabel={labels.submitting} />
      </div>

      {message === "" ? null : (
        <p id={errorId} role={state.status === "ok" ? "status" : "alert"} className="text-accent mt-2 text-sm font-medium">
          {message}
        </p>
      )}

      <label className="text-fg-muted mt-4 flex items-start gap-2.5 text-xs leading-relaxed">
        <input
          type="checkbox"
          name="consent"
          value="1"
          defaultChecked={state.consent}
          className="accent-brand-red mt-0.5 h-4 w-4 shrink-0"
        />
        <span>{labels.consent}</span>
      </label>

      <p aria-live="polite" className="text-fg-muted mt-4 text-xs leading-relaxed">
        {labels.note}
      </p>
    </form>
  );
}

function NewsletterSubmit({ label, pendingLabel }: { readonly label: string; readonly pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-brand-red text-on-brand shrink-0 rounded-full px-6 py-3.5 text-sm font-bold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
