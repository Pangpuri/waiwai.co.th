"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { saveHomeAction } from "@/app/admin/content/actions";
import { INITIAL_SAVE_STATE, type SaveState } from "@/features/admin/save-state";
import {
  addItem,
  canAddItem,
  removeItem,
  setItemMedia,
  setItemText,
  setSectionText,
  toContent,
  type Draft,
  type Language,
} from "@/lib/content/draft";
import type { FieldSpec, ItemSpec, PageSpec } from "@/lib/content/types";
import { fillTemplate } from "@/lib/i18n/template";
import type { Messages } from "@/lib/i18n/messages/th";

/**
 * หน้าจอแก้เนื้อหา (Client Component — ต้องมี state ของฟอร์ม)
 *
 * ออกแบบให้ "สร้างจาก spec" ไม่ได้เขียนฟิลด์ทีละตัว:
 * - เพิ่ม/แก้ฟิลด์ใน `lib/content/model.ts` แล้วหน้าจอ/การตรวจ/สคีมา/ด่าน ตามมาอัตโนมัติ
 * - ทุกข้อความมาจากพจนานุกรมหรือ `label` ใน spec (ห้ามข้อความไทยใน `.tsx`)
 * - ปุ่มเพิ่ม/ลบ ต้อง `type="button"` ไม่งั้นจะกลายเป็นปุ่มส่งฟอร์ม
 */

type Props = {
  readonly spec: PageSpec;
  readonly initialDraft: Draft;
  readonly strings: Messages["admin"];
};

function issueLabel(strings: Messages["admin"], code: string): string {
  const labels = strings.issueLabels as Readonly<Record<string, string>>;
  return labels[code] ?? code;
}

function SubmitButton({ strings }: { readonly strings: Messages["admin"] }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-brand-red text-on-brand focus-visible:ring-ring rounded-xl px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? strings.saving : strings.save}
    </button>
  );
}

function ItemButton({
  label,
  onClick,
  disabled = false,
  tone,
}: {
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
  readonly tone: "add" | "remove";
}) {
  const variant =
    tone === "add"
      ? "border-line text-fg hover:bg-surface-raised"
      : "border-line text-fg-muted hover:bg-surface-raised";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${variant} focus-visible:ring-ring rounded-lg border px-3 py-1.5 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {label}
    </button>
  );
}

function TextPair({
  idBase,
  label,
  value,
  strings,
  onChange,
  multiline = false,
}: {
  readonly idBase: string;
  readonly label: string;
  readonly value: { th: string; en: string };
  readonly strings: Messages["admin"];
  readonly onChange: (language: Language, next: string) => void;
  readonly multiline?: boolean;
}) {
  const fieldClass =
    "border-line bg-surface text-fg placeholder:text-fg-muted focus-visible:ring-ring w-full rounded-lg border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none";

  return (
    <div className="flex flex-col gap-2">
      <p className="text-fg text-sm font-medium">{label}</p>
      <div className="grid gap-2 md:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${idBase}-th`} className="text-fg-muted text-xs">
            {strings.fieldTh}
          </label>
          {multiline ? (
            <textarea
              id={`${idBase}-th`}
              rows={3}
              value={value.th}
              onChange={(event) => onChange("th", event.target.value)}
              className={fieldClass}
            />
          ) : (
            <input
              id={`${idBase}-th`}
              type="text"
              value={value.th}
              onChange={(event) => onChange("th", event.target.value)}
              className={fieldClass}
            />
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${idBase}-en`} className="text-fg-muted text-xs">
            {strings.fieldEnOptional}
          </label>
          {multiline ? (
            <textarea
              id={`${idBase}-en`}
              rows={3}
              value={value.en}
              onChange={(event) => onChange("en", event.target.value)}
              className={fieldClass}
            />
          ) : (
            <input
              id={`${idBase}-en`}
              type="text"
              value={value.en}
              onChange={(event) => onChange("en", event.target.value)}
              className={fieldClass}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function MediaField({
  idBase,
  field,
  value,
  strings,
  onChange,
}: {
  readonly idBase: string;
  readonly field: FieldSpec;
  readonly value: { path: string; altTh: string; altEn: string; hasWatermark: boolean } | undefined;
  readonly strings: Messages["admin"];
  readonly onChange: (patch: { path?: string; altTh?: string; altEn?: string; hasWatermark?: boolean }) => void;
}) {
  const current = value ?? { path: "", altTh: "", altEn: "", hasWatermark: false };
  const fieldClass =
    "border-line bg-surface text-fg placeholder:text-fg-muted focus-visible:ring-ring w-full rounded-lg border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none";

  return (
    <div className="flex flex-col gap-2">
      <p className="text-fg text-sm font-medium">{field.label}</p>
      <p className="text-fg-muted text-xs">{strings.imageHint}</p>
      <div className="grid gap-2 md:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${idBase}-path`} className="text-fg-muted text-xs">
            {strings.imagePathLabel}
          </label>
          <input
            id={`${idBase}-path`}
            type="text"
            value={current.path}
            placeholder="/products/example.jpg"
            onChange={(event) => onChange({ path: event.target.value })}
            className={fieldClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${idBase}-alt-th`} className="text-fg-muted text-xs">
            {strings.imageAltThLabel}
          </label>
          <input
            id={`${idBase}-alt-th`}
            type="text"
            value={current.altTh}
            onChange={(event) => onChange({ altTh: event.target.value })}
            className={fieldClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${idBase}-alt-en`} className="text-fg-muted text-xs">
            {strings.imageAltEnLabel}
          </label>
          <input
            id={`${idBase}-alt-en`}
            type="text"
            value={current.altEn}
            onChange={(event) => onChange({ altEn: event.target.value })}
            className={fieldClass}
          />
        </div>
      </div>
      <label className="text-fg-muted flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={current.hasWatermark}
          onChange={(event) => onChange({ hasWatermark: event.target.checked })}
          className="border-line accent-brand-red focus-visible:ring-ring size-4 rounded border focus-visible:ring-2"
        />
        {strings.imageWatermarkLabel}
      </label>
    </div>
  );
}

function StatusPanel({ state, strings }: { readonly state: SaveState; readonly strings: Messages["admin"] }) {
  if (state.status === "idle") return null;

  const saved = state.status === "saved";
  return (
    <section
      role="status"
      className={`flex flex-col gap-2 rounded-2xl border p-4 text-sm ${saved ? "border-line bg-surface-raised" : "border-brand-red bg-surface"}`}
    >
      {saved ? (
        <>
          <p className="text-fg font-semibold">
            {fillTemplate(strings.savedOk, { written: state.written, deleted: state.deleted })}
          </p>
          {state.warnings > 0 ? (
            <p className="text-fg-muted text-xs">
              {fillTemplate(strings.savedWithWarnings, { count: state.warnings })}
            </p>
          ) : null}
        </>
      ) : (
        <>
          <p className="text-fg font-semibold">
            {state.status === "invalid" ? strings.errorTitle : strings.dbMissingTitle}
          </p>
          {state.problems.length > 0 ? (
            <ul className="text-fg-muted flex list-disc flex-col gap-1 pl-5 text-xs">
              {state.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          ) : null}
          {state.errors.length > 0 ? (
            <ul className="text-fg-muted flex list-disc flex-col gap-1 pl-5 text-xs">
              {state.errors.slice(0, 30).map((issue) => (
                <li key={`${issue.code}-${issue.path}`}>
                  {issueLabel(strings, issue.code)} · <span className="font-mono">{issue.path}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {state.warnings > 0 ? (
            <p className="text-fg-muted text-xs">{fillTemplate(strings.warningCount, { count: state.warnings })}</p>
          ) : null}
        </>
      )}
    </section>
  );
}

export function HomeEditor({ spec, initialDraft, strings }: Props) {
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [state, formAction] = useActionState(saveHomeAction, INITIAL_SAVE_STATE);
  const payload = JSON.stringify(toContent(draft));

  function renderGroup(sectionKey: string, group: ItemSpec) {
    const list = draft.sections[sectionKey]?.items[group.key] ?? [];

    return (
      <div className="border-line flex flex-col gap-3 rounded-xl border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col">
            <p className="text-fg text-sm font-semibold">{group.label}</p>
            <p className="text-fg-muted text-xs">{fillTemplate(strings.maxItemsHint, { n: group.maxItems })}</p>
          </div>
          <ItemButton
            tone="add"
            label={strings.addItem}
            disabled={!canAddItem(draft, sectionKey, group)}
            onClick={() => setDraft((current) => addItem(current, sectionKey, group))}
          />
        </div>

        {list.length === 0 ? <p className="text-fg-muted text-xs">—</p> : null}

        {list.map((item, index) => (
          <div key={`${group.key}-${item.order}`} className="border-line bg-surface flex flex-col gap-3 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-fg-muted text-xs font-semibold">
                {fillTemplate(strings.itemNumber, { n: index + 1 })}
              </p>
              <ItemButton
                tone="remove"
                label={strings.removeItem}
                onClick={() => setDraft((current) => removeItem(current, sectionKey, group.key, index))}
              />
            </div>

            {group.fields.map((field) => {
              const idBase = `item-${sectionKey}-${group.key}-${item.order}-${field.key}`;
              if (field.kind === "media") {
                return (
                  <MediaField
                    key={field.key}
                    idBase={idBase}
                    field={field}
                    value={item.media[field.key]}
                    strings={strings}
                    onChange={(patch) =>
                      setDraft((current) => setItemMedia(current, sectionKey, group.key, index, field.key, patch))
                    }
                  />
                );
              }
              return (
                <TextPair
                  key={field.key}
                  idBase={idBase}
                  label={field.label}
                  value={item.fields[field.key] ?? { th: "", en: "" }}
                  strings={strings}
                  multiline={(field.maxLength ?? 0) > 120}
                  onChange={(language, next) =>
                    setDraft((current) => setItemText(current, sectionKey, group.key, index, field.key, language, next))
                  }
                />
              );
            })}
          </div>
        ))}
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="border-line bg-surface sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3">
        <p className="text-fg-muted text-xs">{strings.contentIntro}</p>
        <SubmitButton strings={strings} />
      </div>

      <StatusPanel state={state} strings={strings} />

      {spec.sections.map((section) => (
        <details key={section.key} className="border-line bg-surface rounded-2xl border p-4" open={section.key === "hero"}>
          <summary className="text-fg cursor-pointer text-base font-semibold">{section.label}</summary>

          <div className="flex flex-col gap-4 pt-4">
            {section.fields
              .filter((field) => field.kind !== "media")
              .map((field) => (
                <TextPair
                  key={field.key}
                  idBase={`section-${section.key}-${field.key}`}
                  label={field.label}
                  value={draft.sections[section.key]?.fields[field.key] ?? { th: "", en: "" }}
                  strings={strings}
                  multiline={(field.maxLength ?? 0) > 120}
                  onChange={(language, next) =>
                    setDraft((current) => setSectionText(current, section.key, field.key, language, next))
                  }
                />
              ))}

            {section.items.map((group) => (
              <div key={group.key} className="flex flex-col gap-2">
                <p className="text-fg-muted text-xs font-semibold uppercase">{strings.itemsHeading}</p>
                {renderGroup(section.key, group)}
              </div>
            ))}
          </div>
        </details>
      ))}

      <input type="hidden" name="payload" value={payload} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin"
          className="text-link focus-visible:ring-ring text-sm font-semibold underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
        >
          {strings.backToOverview}
        </Link>
        <SubmitButton strings={strings} />
      </div>
    </form>
  );
}
