"use client";

import { useActionState, useId } from "react";
import { useFormStatus } from "react-dom";

import { submitPublicFormAction } from "@/app/forms/actions";
import { INITIAL_PUBLIC_FORM_STATE, type PublicFormState } from "@/features/forms/state";

/**
 * ตัวครอบฟอร์มหน้าเว็บ (X1.9) — ทำให้ฟอร์ม **ส่งเข้าฐานข้อมูลจริง**
 *
 * เหตุผลของโครงนี้: ให้ "ช่องกรอก" ยังอยู่ในฝั่งเซิร์ฟเวอร์ (JSX เดิมของหน้า ไม่ต้องย้าย/เขียนซ้ำ)
 * แล้วตัวนี้รับผิดชอบเฉพาะส่วนที่ต้องมี JS: ฟอร์ม · ปุ่มส่ง · กับดักบอต · ข้อความสถานะ · ข้อความยินยอม
 *
 * ⚠️ ความปลอดภัย
 * - กับดักบอต (`website`) ซ่อนจากมนุษย์แต่บอตมักกรอก ⇒ เซิร์ฟเวอร์ตอบ "สำเร็จ" แต่บันทึกเป็นสแปม
 * - ทุกอย่างถูกตรวจซ้ำฝั่งเซิร์ฟเวอร์ (`validateSubmission`) — HTML attribute เป็นแค่ความสะดวก
 */

export type SubmitFormStrings = {
  readonly submit: string;
  readonly submitting: string;
  readonly consent: string;
  readonly sent: string;
  readonly invalid: string;
  readonly rateLimited: string;
  readonly unavailable: string;
  readonly consentRequired: string;
  /** ข้อความเมื่อไฟล์แนบผิดชนิด/ใหญ่เกิน (ใช้เฉพาะฟอร์มที่มีไฟล์) */
  readonly fileInvalid?: string;
};

export function SubmitForm({
  formKind,
  strings,
  children,
  className,
  submitClassName,
  notice,
}: {
  readonly formKind: "contact" | "newsletter" | "careers";
  readonly strings: SubmitFormStrings;
  /** ช่องกรอกที่เรนเดอร์จากฝั่งเซิร์ฟเวอร์ */
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly submitClassName?: string;
  /** ข้อความใต้ปุ่ม/หมายเหตุ (จากพจนานุกรม) */
  readonly notice?: React.ReactNode;
}) {
  const [state, formAction] = useActionState(submitPublicFormAction, INITIAL_PUBLIC_FORM_STATE);
  const consentError = state.status === "invalid" && state.fields.includes("consent");

  return (
    /*
      ⚠️ **ห้ามใส่ `encType`/`method` บนฟอร์มที่ `action` เป็นฟังก์ชัน** (แก้รอบที่ 107)
      - React 19 เตือน: "Cannot specify a encType or method for a form that specifies a function as the action.
        React provides those automatically. They will get overridden." (เตือนเฉพาะใน dev)
      - ที่ React ใส่ให้เอง (ยืนยันจากซอร์สที่ติดตั้งจริง `react-server-dom-turbopack`):
        `{ method: "POST", encType: "multipart/form-data", action: "" }` ⇒ **ส่งไฟล์ได้จริงแม้ปิด JS**
        (multipart มาจาก metadata ของ Server Action ไม่ใช่จาก attribute ของเรา)
      - ของเดิมเราใส่ `encType="multipart/form-data"` ไว้เอง ⇒ ซ้ำซ้อน + ทำให้ dev ขึ้น warning ทุกครั้งที่เรนเดอร์
      ⇒ เทสต์ล็อกไว้ที่ `scripts/test-forms.ts` (ทั้งระดับ React และการสแกนซอร์ส)
    */
    <form action={formAction} className={className}>
      <input type="hidden" name="form" value={formKind} />

      {/* กับดักบอต — ไม่แสดงให้มนุษย์เห็น แต่บอตมักกรอก */}
      <div aria-hidden="true" className="absolute h-0 w-0 overflow-hidden opacity-0">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {children}

      <label className="text-fg-muted mt-5 flex items-start gap-2.5 text-xs leading-relaxed">
        <input
          type="checkbox"
          name="consent"
          value="1"
          defaultChecked={state.consent}
          aria-invalid={consentError ? true : undefined}
          className="accent-brand-red mt-0.5 h-4 w-4 shrink-0"
        />
        <span>{strings.consent}</span>
      </label>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <SubmitButton label={strings.submit} pendingLabel={strings.submitting} className={submitClassName} />
        <StatusMessage state={state} strings={strings} />
      </div>

      {notice === undefined ? null : <div className="mt-6">{notice}</div>}
    </form>
  );
}

function SubmitButton({ label, pendingLabel, className }: { readonly label: string; readonly pendingLabel: string; readonly className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        className ??
        "bg-brand-red text-on-brand focus-visible:ring-ring rounded-full px-6 py-3.5 text-sm font-bold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
      }
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

function StatusMessage({
  state,
  strings,
}: {
  readonly state: PublicFormState;
  readonly strings: SubmitFormStrings;
}) {
  const id = useId();
  if (state.status === null) return null;

  const isError = state.status !== "ok";
  const text =
    state.status === "ok"
      ? strings.sent
      : state.status === "rate-limited"
        ? strings.rateLimited
        : state.status === "unavailable"
          ? strings.unavailable
          : state.fields.includes("resume") && strings.fileInvalid !== undefined
            ? strings.fileInvalid
            : state.fields.includes("consent")
              ? strings.consentRequired
              : strings.invalid;

  return (
    <p
      id={id}
      role={isError ? "alert" : "status"}
      className={`text-xs leading-relaxed ${isError ? "text-brand-red font-semibold" : "text-fg-muted"}`}
    >
      {text}
    </p>
  );
}

export { SubmitForm as default };
