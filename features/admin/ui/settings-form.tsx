"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { publishSettingsAction, saveSettingsAction } from "@/app/admin/settings/actions";
import { INITIAL_SETTINGS_STATE } from "@/features/admin/settings-state";
import { MAX_SOCIALS, type SiteSettings } from "@/lib/site-settings/model";
import type { Messages } from "@/lib/i18n/messages/th";

/**
 * ฟอร์ม "ตั้งค่าเว็บ" + การ์ดพรีวิว SEO (X1.3 + X1.4)
 *
 * - ปุ่มบันทึกฉบับร่าง/เผยแพร่เหมือนส่วนอื่น
 * - **การ์ดพรีวิว**: จำลองผลลัพธ์บน Google และตอนแชร์ — คำนวณจากค่าที่กรอกในฟอร์มทันที (ไม่ยิงออกเน็ต)
 * - ข้อความทั้งหมดมาจากพจนานุกรม (กฎโปรเจกต์)
 */

const FIELD_CLASS =
  "border-line bg-surface text-fg focus-visible:ring-ring w-full rounded-lg border px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none";
const LABEL_CLASS = "text-fg-muted text-xs";
const BUTTON_CLASS =
  "border-line text-fg hover:bg-surface-raised focus-visible:ring-ring rounded-lg border px-3 py-1.5 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40";

function SaveButton({ label, primary = false }: { readonly label: string; readonly primary?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        primary
          ? "bg-brand-red text-on-brand focus-visible:ring-ring rounded-lg px-3 py-1.5 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
          : BUTTON_CLASS
      }
    >
      {label}
    </button>
  );
}

export function SettingsForm({
  initial,
  messages,
  exampleTitle,
  exampleDescription,
}: {
  readonly initial: SiteSettings;
  readonly messages: Messages;
  /** ตัวอย่างหัวข้อ/คำอธิบายสำหรับการ์ดพรีวิว (จากหน้าแรก) */
  readonly exampleTitle: string;
  readonly exampleDescription: string;
}) {
  const strings = messages.admin;
  const [saveState, saveAction] = useActionState(saveSettingsAction, INITIAL_SETTINGS_STATE);
  const [publishState, publishAction] = useActionState(publishSettingsAction, INITIAL_SETTINGS_STATE);

  const state = publishState.status === "idle" ? saveState : publishState;
  const statusText =
    state.status === "saved"
      ? strings.settingsSaved
      : state.status === "published"
        ? strings.settingsPublished
        : state.status === "invalid"
          ? strings.settingsInvalid
          : state.status === "failed"
            ? strings.settingsFailed
            : "";

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <p className="text-fg-muted text-xs">{strings.settingsHint}</p>

      <form action={saveAction} className="flex flex-col gap-3">
        <div className="grid gap-2 md:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>{strings.settingsNameTh}</span>
            <input type="text" name="nameTh" defaultValue={initial.name.th} maxLength={60} className={FIELD_CLASS} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>{strings.settingsNameEn}</span>
            <input type="text" name="nameEn" defaultValue={initial.name.en} maxLength={60} className={FIELD_CLASS} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>{strings.settingsFavicon}</span>
            <input type="text" name="favicon" defaultValue={initial.favicon} placeholder="/media/…" className={FIELD_CLASS} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>{strings.settingsDefaultOg}</span>
            <input type="text" name="defaultOgImage" defaultValue={initial.defaultOgImage} placeholder="/media/…" className={FIELD_CLASS} />
          </label>
        </div>

        <fieldset className="border-line flex flex-col gap-2 rounded-xl border p-3">
          <legend className="text-fg px-1 text-xs font-semibold">{strings.settingsOrgTitle}</legend>
          <div className="grid gap-2 md:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className={LABEL_CLASS}>{strings.settingsLegalNameTh}</span>
              <input type="text" name="legalNameTh" defaultValue={initial.organization.legalName.th} maxLength={60} className={FIELD_CLASS} />
            </label>
            <label className="flex flex-col gap-1">
              <span className={LABEL_CLASS}>{strings.settingsLegalNameEn}</span>
              <input type="text" name="legalNameEn" defaultValue={initial.organization.legalName.en} maxLength={60} className={FIELD_CLASS} />
            </label>
            <label className="flex flex-col gap-1">
              <span className={LABEL_CLASS}>{strings.settingsPhone}</span>
              <input type="text" name="phone" defaultValue={initial.organization.phone} maxLength={40} className={FIELD_CLASS} />
            </label>
            <label className="flex flex-col gap-1">
              <span className={LABEL_CLASS}>{strings.settingsEmail}</span>
              <input type="text" name="email" defaultValue={initial.organization.email} maxLength={80} className={FIELD_CLASS} />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>{strings.settingsAddressTh}</span>
            <textarea name="addressTh" defaultValue={initial.organization.address.th} rows={2} className={FIELD_CLASS} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>{strings.settingsAddressEn}</span>
            <textarea name="addressEn" defaultValue={initial.organization.address.en} rows={2} className={FIELD_CLASS} />
          </label>

          <div className="grid gap-2 md:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className={LABEL_CLASS}>{strings.settingsHoursTh}</span>
              <input type="text" name="hoursTh" defaultValue={initial.organization.hours.th} maxLength={200} className={FIELD_CLASS} />
            </label>
            <label className="flex flex-col gap-1">
              <span className={LABEL_CLASS}>{strings.settingsHoursEn}</span>
              <input type="text" name="hoursEn" defaultValue={initial.organization.hours.en} maxLength={200} className={FIELD_CLASS} />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>{strings.settingsMapUrl}</span>
            <input type="text" name="mapUrl" defaultValue={initial.organization.mapUrl} placeholder="https://maps.google.com/…" className={FIELD_CLASS} />
          </label>

          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>
              {strings.settingsSocials} ({MAX_SOCIALS})
            </span>
            <textarea name="socials" defaultValue={initial.socials.join("\n")} rows={3} className={FIELD_CLASS} />
          </label>
        </fieldset>

        <div className="flex flex-wrap items-center gap-2">
          <SaveButton label={strings.settingsSave} />
          <button
            type="submit"
            formAction={publishAction}
            className="bg-brand-red text-on-brand focus-visible:ring-ring rounded-lg px-3 py-1.5 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none"
          >
            {strings.settingsPublish}
          </button>
          {statusText === "" ? null : (
            <p role={state.status === "invalid" || state.status === "failed" ? "alert" : "status"} className="text-fg-muted text-xs">
              {statusText}
            </p>
          )}
        </div>

        {state.problems.length === 0 ? null : (
          <ul className="border-brand-red/60 text-fg-muted list-disc rounded-lg border p-3 pl-6 text-[11px]">
            {state.problems.slice(0, 8).map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        )}
      </form>

      {/* ── การ์ดพรีวิว SEO (X1.4) ── */}
      <section className="border-line bg-surface flex flex-col gap-2 rounded-2xl border p-3">
        <h2 className="text-fg text-sm font-semibold">{strings.settingsPreviewTitle}</h2>
        <p className="text-fg-muted text-[11px]">{strings.settingsPreviewGoogleHint}</p>

        <div className="border-line rounded-xl border p-3">
          <p className="text-fg-muted text-[11px]">www.waiwai.com</p>
          <p className="text-link text-base leading-snug">{exampleTitle}</p>
          <p className="text-fg-muted text-xs leading-relaxed">{exampleDescription}</p>
        </div>

        <div className="border-line bg-surface-raised flex flex-col gap-1 rounded-xl border p-3">
          <p className="text-fg text-xs font-semibold">{initial.name.th}</p>
          <p className="text-fg-muted text-[11px]">{initial.defaultOgImage === "" ? "—" : initial.defaultOgImage}</p>
        </div>
      </section>
    </div>
  );
}
