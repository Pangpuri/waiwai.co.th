"use client";

import { MOURNING_LIVE_EVENT } from "@/features/blocks/ui/preview-frame";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { publishMourningAction, resetMourningToDefaultsAction, saveMourningDraftAction } from "@/app/admin/builder/mourning/actions";
import { INITIAL_BUILDER_STATE, type BuilderState } from "@/features/admin/builder-state";
import { ImageDrop } from "@/features/admin/ui/image-drop";
import { fillTemplate } from "@/lib/i18n/template";
import {
  MAX_MOURNING_IMAGES,
  MOURNING_IMAGE_ASPECT,
  diffMourningConfig,
  type MourningChange,
  type MourningConfig,
  type MourningImageConfig,
} from "@/lib/mourning/config";
import type { Messages } from "@/lib/i18n/messages/th";

/**
 * หน้าจอแก้ "ป๊อปอัพประกาศไว้อาลัย"
 *
 * ผู้ใช้สั่ง (รอบที่ 35): *"ป๊อปอัพไว้อาลัยต้องแก้ไขส่วนนั้นได้ด้วย … ค่าจากเส้นโฟลเดอร์ภาพ rip"*
 * ⇒ ภาพทุกใบ (เดิมมาจากโฟลเดอร์ `/rip/`) อัปโหลด/เปลี่ยนได้จากที่นี่ · ข้อความแก้ได้ · เปิด-ปิดได้
 * ⇒ เห็นภาพจริงทั้งชุดทันที (การ์ดภาพรวม) และกด **เผยแพร่** เพื่อให้หน้าเว็บเปลี่ยน
 */

type Props = {
  readonly initial: MourningConfig;
  readonly draftUpdatedAt: string | null;
  readonly publishedAt: string | null;
  readonly revisions: readonly {
    readonly revision: number;
    readonly createdAt: string;
    readonly blockCount: number;
  }[];
  readonly strings: Messages["admin"];
  /**
   * โหมดย่อ (ใช้บนหน้าสร้างหน้าเว็บ — ผู้ใช้สั่ง รอบที่ 43: "調整ได้จากหน้า home ไปเลย … ย่อเป็นรูปเล็ก ๆ")
   * ⇒ กระเบื้องภาพเล็กลง (96px) ไม่กินพื้นที่ แต่แก้ได้ครบเหมือนกัน
   */
  readonly compact?: boolean;
};

function SubmitButton({
  label,
  pendingLabel,
  tone,
}: {
  readonly label: string;
  readonly pendingLabel: string;
  readonly tone: "brand" | "outline";
}) {
  const { pending } = useFormStatus();
  const className =
    tone === "brand"
      ? "bg-brand-red text-on-brand focus-visible:ring-ring rounded-xl px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60"
      : "border-line text-fg hover:bg-surface-raised focus-visible:ring-ring rounded-xl border px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60";

  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingLabel : label}
    </button>
  );
}

function TinyButton({
  label,
  onClick,
  disabled = false,
}: {
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="border-line text-fg hover:bg-surface-raised focus-visible:ring-ring rounded-lg border px-2 py-1 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
    >
      {label}
    </button>
  );
}

function TextPair({
  idBase,
  label,
  value,
  onChange,
  multiline = false,
}: {
  readonly idBase: string;
  readonly label: string;
  readonly value: { readonly th: string; readonly en: string };
  readonly onChange: (language: "th" | "en", next: string) => void;
  readonly multiline?: boolean;
}) {
  const fieldClass =
    "border-line bg-surface text-fg focus-visible:ring-ring w-full rounded-lg border px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none";

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-fg text-sm font-medium">{label}</p>
      <label htmlFor={`${idBase}-th`} className="text-fg-muted text-xs">
        TH
      </label>
      {multiline ? (
        <textarea id={`${idBase}-th`} rows={2} value={value.th} onChange={(event) => onChange("th", event.target.value)} className={fieldClass} />
      ) : (
        <input id={`${idBase}-th`} type="text" value={value.th} onChange={(event) => onChange("th", event.target.value)} className={fieldClass} />
      )}
      <label htmlFor={`${idBase}-en`} className="text-fg-muted text-xs">
        EN
      </label>
      {multiline ? (
        <textarea id={`${idBase}-en`} rows={2} value={value.en} onChange={(event) => onChange("en", event.target.value)} className={fieldClass} />
      ) : (
        <input id={`${idBase}-en`} type="text" value={value.en} onChange={(event) => onChange("en", event.target.value)} className={fieldClass} />
      )}
    </div>
  );
}

function StatusPanel({ state, strings }: { readonly state: BuilderState; readonly strings: Messages["admin"] }) {
  if (state.status === "idle") return null;

  const failed = state.status === "invalid" || state.status === "failed";
  const message =
    state.status === "draft-saved"
      ? strings.savedDraft
      : state.status === "published"
        ? fillTemplate(strings.publishedOk, { revision: state.revision ?? 1 })
        : state.status === "invalid"
          ? strings.errorTitle
          : strings.dbMissingShort;

  const labels = strings.issueLabels as Readonly<Record<string, string>>;

  return (
    <section
      role="status"
      className={`flex flex-col gap-1 rounded-xl border p-3 text-sm ${failed ? "border-brand-red bg-surface" : "border-line bg-surface-raised"}`}
    >
      <p className="text-fg font-semibold">{message}</p>
      {state.problems.length > 0 ? (
        <ul className="text-fg-muted list-disc pl-5 text-xs">
          {state.problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      ) : null}
      {state.errors.length > 0 ? (
        <ul className="text-fg-muted list-disc pl-5 text-xs">
          {state.errors.map((issue) => (
            <li key={`${issue.code}-${issue.path}`}>
              {labels[issue.code] ?? issue.code} · <span className="font-mono">{issue.path}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function MourningEditor({ initial, draftUpdatedAt, publishedAt, revisions, strings, compact = false }: Props) {
  const [config, setConfig] = useState<MourningConfig>(initial);

  /*
    พรีวิวสด (รอบที่ 161): ส่งค่าที่กำลังแก้ (ยังไม่บันทึก) ออกไปให้ workspace ส่งเข้า iframe
    ⇒ เพิ่ม/ลบภาพแล้วเห็นในพรีวิวทันที ไม่ต้องบันทึกก่อน
  */
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(MOURNING_LIVE_EVENT, { detail: config }));
  }, [config]);
  const [draftState, draftAction] = useActionState(saveMourningDraftAction, INITIAL_BUILDER_STATE);
  const [publishState, publishAction] = useActionState(publishMourningAction, INITIAL_BUILDER_STATE);
  const resetAction = resetMourningToDefaultsAction;

  /**
   * ภาพที่กำลังแก้ (ดัชนีในแถวแกลเลอรี) — ผู้ใช้สั่ง รอบที่ 42:
   * "แกลเลอรีเรียงแถวเดียว + เพิ่มรูปตรงส่วนนั้นได้เลย" ⇒ เห็นภาพทั้งหมดเป็นแถว แล้วเลือกทีละใบมาแก้ด้านล่าง
   */
  const [selectedImage, setSelectedImage] = useState(0);

  /* ช่องภาพที่ยังไม่ได้วางไฟล์ถูกตัดออกตอนบันทึก — กด "+" ทิ้งไว้ก็ไม่ทำให้บันทึกไม่ผ่าน */
  const payload = JSON.stringify({ ...config, images: config.images.filter((image) => image.path.trim() !== "") });
  /**
   * "ค่าที่บันทึกล่าสุด" = ค่าที่เซิร์ฟเวอร์ส่งมา (prop `initial`)
   * ⇒ หลังกดบันทึกสำเร็จ เซิร์ฟเวอร์ `revalidatePath` และหน้าจอ remount ด้วย `key` ใหม่
   *    (ดู app/admin/builder/mourning/page.tsx) ตัวนับการแก้ไขจึงกลับเป็นศูนย์เอง
   *    โดยไม่ต้อง setState ใน useEffect (เลี่ยงกฎ react-hooks/set-state-in-effect)
   */
  const changes = diffMourningConfig(initial, config);

  /** เพิ่มช่องภาพเปล่า + เลือกให้ทันที ⇒ ลากไฟล์วางในกรอบขาวที่อยู่ด้านล่างได้เลย */
  function addImage() {
    setConfig((current) => {
      if (current.images.length >= MAX_MOURNING_IMAGES) return current;
      setSelectedImage(current.images.length);
      return { ...current, images: [...current.images, { path: "", altTh: "", altEn: "", width: null, height: null }] };
    });
  }

  function removeImage(index: number) {
    setConfig((current) => ({ ...current, images: current.images.filter((_entry, position) => position !== index) }));
    setSelectedImage((current) => (current >= index && current > 0 ? current - 1 : current));
  }

  function moveImage(index: number, direction: -1 | 1) {
    setConfig((current) => {
      const target = index + direction;
      const images = [...current.images];
      const a = images[index];
      const b = images[target];
      if (a === undefined || b === undefined) return current;
      images[index] = b;
      images[target] = a;
      return { ...current, images };
    });
    setSelectedImage((current) => (current === index ? index + direction : current));
  }

  function changeLabel(change: MourningChange): string {
    switch (change.kind) {
      case "enabled":
        return strings.mourningChangeEnabled;
      case "caption":
        return strings.mourningChangeCaption;
      case "close":
        return strings.mourningChangeClose;
      case "mute":
        return strings.mourningChangeMute;
      case "seeNext":
        return strings.mourningChangeSeeNext;
      case "image-added":
        return fillTemplate(strings.mourningChangeImageAdd, { n: change.imageNumber ?? 0 });
      case "image-removed":
        return fillTemplate(strings.mourningChangeImageRemove, { n: change.imageNumber ?? 0 });
      case "image-changed":
        return fillTemplate(strings.mourningChangeImage, { n: change.imageNumber ?? 0 });
    }
  }

  function updateImage(index: number, patch: Partial<MourningImageConfig>) {
    setConfig((current) => {
      const images = current.images.map((image, position) => {
        if (position !== index) return image;
        const merged = { ...image, ...patch };
        /* เปลี่ยนไฟล์ภาพ = ไม่รู้ขนาดจริงแล้ว → ล้างค่าเดิม แล้วให้ loader ใช้สัดส่วนมาตรฐาน 3:1 */
        if (patch.path !== undefined && patch.path !== image.path) return { ...merged, width: null, height: null };
        return merged;
      });
      return { ...current, images };
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="border-line bg-surface flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3">
        <div className="flex flex-col">
          <p className="text-fg-muted text-xs">{strings.mourningIntro}</p>
          <p className="text-fg text-xs">
            {publishedAt === null ? strings.notPublishedYet : fillTemplate(strings.publishedStatus, { time: publishedAt.slice(0, 16).replace("T", " ") })}
            {draftUpdatedAt === null ? "" : ` · ${fillTemplate(strings.draftStatus, { time: draftUpdatedAt.slice(0, 16).replace("T", " ") })}`}
          </p>
        </div>
        <Link href="/admin" className="text-link focus-visible:ring-ring text-sm font-semibold underline underline-offset-4">
          {strings.builderBack}
        </Link>
      </div>

      {/* บอกว่าอะไรถูกแก้ และบันทึกหรือยัง (ผู้ใช้สั่ง รอบที่ 38) */}
      <section
        role="status"
        className={`flex flex-col gap-1 rounded-xl border p-3 text-sm ${
          changes.length > 0 ? "border-brand-red bg-surface" : "border-line bg-surface-raised"
        }`}
      >
        <p className="text-fg font-semibold">
          {changes.length > 0 ? fillTemplate(strings.mourningChanges, { n: changes.length }) : strings.mourningNoChanges}
        </p>
        {changes.length > 0 ? (
          <p className="text-fg-muted text-xs">{changes.map((change) => changeLabel(change)).join(" · ")}</p>
        ) : null}
      </section>

      <StatusPanel state={draftState} strings={strings} />
      <StatusPanel state={publishState} strings={strings} />

      {/* ── ภาพประกาศ: แกลเลอรี "แถวเดียว" เต็มความกว้าง (ผู้ใช้สั่ง รอบที่ 42) ─────────────
          เดิมภาพอยู่ในคอลัมน์ขวา เรียงซ้อนลงมาเป็นใบใหญ่ ๆ ⇒ ดูไม่ออกว่ามีกี่ภาพ และปุ่มเพิ่มภาพไม่อยู่ในสายตา
          ใหม่: แถวเดียวเลื่อนแนวนอนได้ · ปุ่ม "+ เพิ่มภาพ" ต่อท้ายแถว · เลือกใบไหนแล้วแก้คำอธิบาย/ไฟล์ด้านล่าง
      */}
      <section className="border-line bg-surface flex flex-col gap-3 rounded-2xl border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-fg text-sm font-semibold">
            {strings.mourningImagesLabel} ({config.images.length}/{MAX_MOURNING_IMAGES})
          </h2>
          <p className="text-fg-muted text-xs">{strings.mourningRecommended}</p>
        </div>

        <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
          {config.images.map((image, index) => {
            const isSelected = index === selectedImage;

            return (
              <div
                key={`mourning-tile-${index}`}
                className={`flex shrink-0 flex-col gap-1 rounded-xl border p-1.5 ${compact ? "w-24" : "w-40"} ${
                  isSelected ? "border-brand-red bg-surface-raised" : "border-line bg-surface"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedImage(index)}
                  className="block w-full"
                  aria-label={fillTemplate(strings.imageNumber, { n: index + 1 })}
                >
                  {image.path === "" ? (
                    <span className="bg-bg border-line text-fg-muted flex h-14 w-full items-center justify-center rounded-lg border px-1 text-center text-[10px]">
                      {strings.mourningDropPrompt}
                    </span>
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={image.path} alt={image.altTh} className="bg-bg-subtle h-14 w-full rounded-lg object-cover" />
                  )}
                </button>

                <div className="flex items-center justify-between gap-1">
                  <span className="text-fg-muted text-xs font-semibold">{index + 1}</span>
                  <div className="flex gap-1">
                    <TinyButton label="‹" disabled={index === 0} onClick={() => moveImage(index, -1)} />
                    <TinyButton label="›" disabled={index === config.images.length - 1} onClick={() => moveImage(index, 1)} />
                    <TinyButton label="✕" onClick={() => removeImage(index)} />
                  </div>
                </div>
              </div>
            );
          })}

          {/* ช่องเพิ่มภาพ — อยู่ในแถวเดียวกับภาพเลย */}
          <button
            type="button"
            onClick={addImage}
            disabled={config.images.length >= MAX_MOURNING_IMAGES}
            className={`border-line text-fg hover:bg-surface-raised focus-visible:ring-ring flex h-[4.75rem] shrink-0 flex-col items-center justify-center gap-1 self-start rounded-xl border-2 border-dashed text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 ${compact ? "w-24" : "w-40"}`}
          >
            <span aria-hidden="true" className="text-lg leading-none">
              +
            </span>
            {strings.addImage}
          </button>
        </div>

        {config.images.length === 0 ? <p className="text-fg-muted text-xs">{strings.noticeCardEmpty}</p> : null}

        {/* แผงแก้ภาพที่เลือก — วางไฟล์/คำอธิบายของ "ใบที่เลือก" เท่านั้น */}
        {config.images.length === 0 ? null : (
          <div className="border-line bg-surface-raised flex flex-col gap-2 rounded-xl border p-3">
            <p className="text-fg text-sm font-semibold">
              {fillTemplate(strings.imageNumber, { n: Math.min(selectedImage, config.images.length - 1) + 1 })}
            </p>
            <ImageDrop
              strings={strings}
              label={strings.mourningImageFileLabel}
              value={(() => {
                const image = config.images[Math.min(selectedImage, config.images.length - 1)];
                return image === undefined ? null : { path: image.path, altTh: image.altTh, altEn: image.altEn, hasWatermark: false };
              })()}
              onChange={(patch) => updateImage(Math.min(selectedImage, config.images.length - 1), patch)}
              /* ผู้ใช้สั่ง รอบที่ 46: "ไม่ต้องรักษาสเกลภาพ" ⇒ ไม่ต้องมีกรอบขาว 3:1 ในแผงแก้
                 (ดูสัดส่วนจริงได้จากพรีวิวหน้าเว็บอยู่แล้ว) — เหลือช่องลากวางกะทัดรัด + คำอธิบายภาพ
                 รอบที่ 168: ครอปกลางภาพเป็น 3:1 ให้อัตโนมัติตอนอัปโหลด (เก็บ = สิ่งที่เห็น) */
              cropAspect={MOURNING_IMAGE_ASPECT}
              dropPrompt={strings.mourningDropPrompt}
              compact
            />
          </div>
        )}

        <p className="text-fg-muted text-xs">{strings.mourningHint}</p>
      </section>

      {/* ── ข้อความบนป้าย + สวิตช์เปิด/ปิด ───────────────────────────────────────────── */}
      <section className={`border-line bg-surface grid gap-3 rounded-2xl border p-4 ${compact ? "grid-cols-1" : "lg:grid-cols-2"}`}>
        <label className="border-line bg-surface-raised flex items-center justify-between gap-2 rounded-lg border p-2">
          <span className="text-fg text-sm font-medium">{strings.mourningEnabledLabel}</span>
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(event) => setConfig((current) => ({ ...current, enabled: event.target.checked }))}
            className="border-line accent-brand-red size-4 rounded border"
          />
        </label>

        <TextPair
          idBase="mourning-caption"
          label={strings.mourningCaptionLabel + " (" + strings.optionalHint + ")"}
          value={config.caption}
          multiline
          onChange={(language, next) => setConfig((current) => ({ ...current, caption: { ...current.caption, [language]: next } }))}
        />
        <TextPair
          idBase="mourning-close"
          label={strings.mourningCloseLabel}
          value={config.closeLabel}
          onChange={(language, next) => setConfig((current) => ({ ...current, closeLabel: { ...current.closeLabel, [language]: next } }))}
        />
        <TextPair
          idBase="mourning-mute"
          label={strings.mourningMuteLabel}
          value={config.muteTodayLabel}
          onChange={(language, next) => setConfig((current) => ({ ...current, muteTodayLabel: { ...current.muteTodayLabel, [language]: next } }))}
        />
        <TextPair
          idBase="mourning-seeNext"
          label={strings.mourningSeeNextLabel}
          value={config.seeNextLabel}
          onChange={(language, next) => setConfig((current) => ({ ...current, seeNextLabel: { ...current.seeNextLabel, [language]: next } }))}
        />
      </section>

      {/* ปุ่มบันทึก/เผยแพร่ */}
      <div className="border-line bg-surface flex flex-wrap items-center gap-3 rounded-2xl border p-3">
        <form action={draftAction}>
          <input type="hidden" name="payload" value={payload} />
          <SubmitButton label={strings.saveDraft} pendingLabel={strings.savingDraft} tone="outline" />
        </form>

        <form action={publishAction}>
          <input type="hidden" name="payload" value={payload} />
          <SubmitButton label={strings.publish} pendingLabel={strings.publishing} tone="brand" />
        </form>

        {/* คืนค่าเริ่มต้นจากโค้ด/พจนานุกรม (เขียนเป็นฉบับร่างก่อน — ต้องกด "เผยแพร่" อีกครั้งจึงมีผลกับหน้าเว็บ) */}
        <form action={resetAction}>
          <button
            type="submit"
            className="border-line text-fg-muted hover:bg-surface-raised focus-visible:ring-ring rounded-xl border px-3 py-2 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none"
          >
            {strings.mourningReset}
          </button>
        </form>

        <a href="/th" target="_blank" rel="noreferrer" className="text-link focus-visible:ring-ring text-xs font-semibold underline underline-offset-4">
          {strings.mourningOpenSite}
        </a>

        {revisions.length > 0 ? (
          <span className="text-fg-muted text-xs">{fillTemplate(strings.mourningRevisionCount, { n: revisions.length })}</span>
        ) : null}
      </div>
    </div>
  );
}
