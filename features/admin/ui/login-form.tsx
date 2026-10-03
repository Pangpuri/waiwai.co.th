"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { loginAction } from "@/app/admin/actions";
import { fillTemplate } from "@/lib/i18n/template";
import { INITIAL_LOGIN_STATE, type LockedInfo, type LoginErrorKey } from "@/features/admin/login-state";
import type { Messages } from "@/lib/i18n/messages/th";

/**
 * ฟอร์มล็อกอิน (Client Component — ต้องมีเพราะใช้ state ของฟอร์ม)
 *
 * ⚠️ ข้อความทุกคำมาจาก prop `strings` (พจนานุกรม) — **ห้ามเขียนข้อความไทยในไฟล์นี้**
 *    (ด่าน `check:i18n` ตรวจ `.tsx` ทั้งโปรเจกต์)
 */

type Props = {
  readonly strings: Messages["admin"];
  readonly defaultEmail: string;
};

function errorText(key: LoginErrorKey, strings: Messages["admin"], locked: LockedInfo | null | undefined): string {
  if (key === "required") return strings.errorRequired;
  if (key === "invalid") return strings.errorInvalid;
  if (key === "notConfigured") return strings.errorNotConfigured;
  /* ล็อกเพราะพยายามผิดหลายครั้ง — บอกจำนวนนาทีที่ต้องรอ (ไม่บอกว่าอีเมลนี้มีบัญชีหรือไม่) */
  if (key === "locked") return fillTemplate(strings.loginLocked, { n: locked?.minutes ?? 1 });
  return strings.errorServer;
}

/** ปุ่มส่ง — แยกออกมาเพื่อใช้ `useFormStatus` (ต้องอยู่ข้างใน <form>) */
function SubmitButton({ label, pendingLabel }: { readonly label: string; readonly pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-brand-red text-on-brand focus-visible:ring-ring w-full rounded-xl px-4 py-2.5 font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

export function LoginForm({ strings, defaultEmail }: Props) {
  const [state, formAction] = useActionState(loginAction, INITIAL_LOGIN_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="admin-email" className="text-fg text-sm font-medium">
          {strings.emailLabel}
        </label>
        <input
          id="admin-email"
          name="email"
          type="email"
          autoComplete="username"
          defaultValue={defaultEmail}
          placeholder={strings.emailPlaceholder}
          className="border-line bg-surface text-fg placeholder:text-fg-muted focus-visible:ring-ring rounded-xl border px-3 py-2 focus-visible:ring-2 focus-visible:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="admin-password" className="text-fg text-sm font-medium">
          {strings.passwordLabel}
        </label>
        <input
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder={strings.passwordPlaceholder}
          className="border-line bg-surface text-fg placeholder:text-fg-muted focus-visible:ring-ring rounded-xl border px-3 py-2 focus-visible:ring-2 focus-visible:outline-none"
        />
      </div>

      {state.error === null ? null : (
        <p role="alert" className="border-line bg-surface-raised rounded-xl border px-3 py-2 text-sm">
          {errorText(state.error, strings, state.locked)}
        </p>
      )}

      <SubmitButton label={strings.submit} pendingLabel={strings.submitting} />
    </form>
  );
}
