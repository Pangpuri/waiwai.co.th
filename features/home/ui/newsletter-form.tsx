"use client";

import { useId, useState } from "react";

import { isValidEmail } from "@/lib/validate";

export type NewsletterFormLabels = {
  readonly emailLabel: string;
  readonly emailPlaceholder: string;
  readonly invalidEmail: string;
  readonly consent: string;
  readonly submit: string;
  readonly note: string;
};

type Status = "idle" | "invalid" | "accepted";

/**
 * ฟอร์มรับข่าวสาร
 *
 * ⚠️ เวอร์ชันนี้ยัง "ไม่มีปลายทาง" — ตรวจรูปแบบอีเมลฝั่ง client เท่านั้น
 *    แล้วแจ้งผู้ใช้ว่าช่องทางยังไม่เปิด (ไม่แกล้งทำเป็นสมัครสำเร็จ)
 *    เมื่อมี API ให้ย้ายการส่งไป Server Action ตามกฎข้อ 3
 */
export function NewsletterForm({ labels }: { readonly labels: NewsletterFormLabels }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const fieldId = useId();
  const errorId = `${fieldId}-error`;

  const showError = status === "invalid";

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setStatus(isValidEmail(email) ? "accepted" : "invalid");
      }}
    >
      <label htmlFor={fieldId} className="block text-sm font-semibold text-fg">
        {labels.emailLabel}
      </label>

      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          id={fieldId}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          dir="ltr"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (status !== "idle") setStatus("idle");
          }}
          placeholder={labels.emailPlaceholder}
          aria-invalid={showError || undefined}
          aria-describedby={showError ? errorId : undefined}
          className={[
            "w-full rounded-full border-2 bg-surface px-5 py-3.5 text-sm text-fg outline-none",
            "placeholder:text-fg-muted/70",
            showError ? "border-brand-red" : "border-line-strong focus:border-brand-red",
          ].join(" ")}
        />

        <button
          type="submit"
          className="shrink-0 rounded-full bg-brand-red px-6 py-3.5 text-sm font-bold text-on-brand transition-opacity hover:opacity-90"
        >
          {labels.submit}
        </button>
      </div>

      {showError ? (
        <p id={errorId} role="alert" className="mt-2 text-sm font-medium text-accent">
          {labels.invalidEmail}
        </p>
      ) : null}

      <label className="mt-4 flex items-start gap-2.5 text-xs leading-relaxed text-fg-muted">
        <input
          type="checkbox"
          name="consent"
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--brand-red)]"
        />
        <span>{labels.consent}</span>
      </label>

      <p aria-live="polite" className="mt-4 text-sm font-medium text-accent">
        {status === "accepted" ? labels.note : ""}
      </p>
    </form>
  );
}
