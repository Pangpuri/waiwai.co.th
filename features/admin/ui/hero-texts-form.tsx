import { saveHeroTextsAction } from "@/app/admin/hero/text-actions";
import type { HeroTextsInput } from "@/lib/content/home-hero";
import type { Messages } from "@/lib/i18n/messages/th";

/**
 * ฟอร์ม **"ข้อความหัวเว็บไซต์"** (hero) — รอบที่ 251
 *
 * มติเจ้าของ: *"รวมทุกอย่างของ hero ไว้ที่ 'สไลด์ & แคมเปญ' + เปลี่ยนชื่อเมนูเป็น
 *   'สไลด์ แคมเปญ ข้อความหัวเว็บไซต์'"* ⇒ ฟอร์มนี้อยู่หน้าจอเดียวกับสไลด์/การ์ด
 *
 * ⚠️ เป็น **Server Component + ฟอร์มธรรมดา (Server Action)** — ไม่มี JS ฝั่งจอเลย ⇒ ใช้ได้แม้ปิด JavaScript
 * ⚠️ ช่องอังกฤษเว้นว่างได้ (มติ D22: EN = ความรับผิดชอบการตลาด) — หน้า EN จะถอยไปใช้ไทย
 * ⚠️ ห้ามพิมพ์ข้อความไทยในไฟล์นี้ — ทุกป้ายมาจากพจนานุกรม (`messages.admin`)
 */
export type HeroTextsFormProps = {
  readonly current: HeroTextsInput;
  readonly strings: Messages["admin"];
  /** ช่องที่ต้องแก้ (มาจาก `?fields=` หลัง Server Action ปฏิเสธ) */
  readonly problemFields?: readonly string[];
};

const INPUT_CLASS =
  "border-line bg-surface text-fg focus-visible:ring-ring w-full rounded-lg border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none";

/** ชื่อฐานของช่อง — หนึ่งแถวมี 2 ช่องจริง (`<ชื่อ>Th` / `<ชื่อ>En`) */
export type HeroTextBaseField = "eyebrow" | "title" | "titleAccent" | "body" | "note" | "ctaLabel";

type RowProps = {
  readonly field: HeroTextBaseField;
  readonly label: string;
  readonly th: string;
  readonly en: string;
  readonly required?: boolean;
  readonly maxLength: number;
  readonly multiline?: boolean;
  readonly badTh?: boolean;
  readonly badEn?: boolean;
  readonly labels: { readonly th: string; readonly en: string };
};

/** แถวหนึ่ง = ป้าย + ช่องไทย + ช่องอังกฤษ (ส่ง `defaultValue` แยกกันช่อง — ห้ามใช้ค่าช่องเดียวกันทั้งคู่) */
function Row({ field, label, th, en, required = false, maxLength, multiline = false, badTh = false, badEn = false, labels }: RowProps) {
  const pairs = [
    { name: `${field}Th`, value: th, language: "th" as const, bad: badTh, must: required },
    { name: `${field}En`, value: en, language: "en" as const, bad: badEn, must: false },
  ];

  return (
    <div className="flex flex-col gap-3 sm:flex-row" data-texts-row={field}>
      <p className="text-fg-muted w-44 shrink-0 text-xs font-semibold">
        {label}
        {required ? <span className="text-brand-red"> *</span> : null}
      </p>
      <div className="grid flex-1 gap-2 sm:grid-cols-2">
        {pairs.map((pair) => (
          <label key={pair.name} className="flex flex-col gap-1">
            <span className="text-fg-muted text-[11px]">{pair.language === "th" ? labels.th : labels.en}</span>
            {multiline ? (
              <textarea
                name={pair.name}
                defaultValue={pair.value}
                required={pair.must}
                maxLength={maxLength}
                rows={2}
                className={`${INPUT_CLASS} ${pair.bad ? "border-brand-red" : ""}`}
                data-texts-field={pair.name}
              />
            ) : (
              <input
                type="text"
                name={pair.name}
                defaultValue={pair.value}
                required={pair.must}
                maxLength={maxLength}
                className={`${INPUT_CLASS} ${pair.bad ? "border-brand-red" : ""}`}
                data-texts-field={pair.name}
              />
            )}
          </label>
        ))}
      </div>
    </div>
  );
}

export function HeroTextsForm({ current, strings, problemFields = [] }: HeroTextsFormProps) {
  const labels = { th: strings.textsLabelTh, en: strings.textsLabelEn };
  const bad = (name: string): boolean => problemFields.includes(name);

  return (
    <section className="border-line bg-surface flex flex-col gap-4 rounded-2xl border p-4" data-hero-texts="">
      <div className="flex flex-col gap-1">
        <h2 className="text-fg text-base font-semibold">{strings.textsTitle}</h2>
        <p className="text-fg-muted text-xs">{strings.textsHint}</p>
      </div>

      {problemFields.length === 0 ? null : (
        <p className="text-brand-red text-xs" data-texts-error="">
          {strings.textsInvalid}
          <span className="mt-1 block">{strings.textsFields.replace("{fields}", problemFields.join(", "))}</span>
        </p>
      )}

      <form action={saveHeroTextsAction} className="flex flex-col gap-5">
        <p className="text-fg-muted text-xs font-semibold uppercase">{strings.textsGroupTexts}</p>
        <Row field="eyebrow" label={strings.textsEyebrow} th={current.eyebrowTh} en={current.eyebrowEn} required maxLength={40} badTh={bad("eyebrowTh")} labels={labels} />
        <Row field="title" label={strings.textsTitleField} th={current.titleTh} en={current.titleEn} required maxLength={70} badTh={bad("titleTh")} labels={labels} />
        <Row
          field="titleAccent"
          label={strings.textsTitleAccent}
          th={current.titleAccentTh}
          en={current.titleAccentEn}
          required
          maxLength={60}
          badTh={bad("titleAccentTh")}
          labels={labels}
        />
        <Row field="body" label={strings.textsBody} th={current.bodyTh} en={current.bodyEn} required maxLength={400} multiline badTh={bad("bodyTh")} labels={labels} />
        <Row field="note" label={strings.textsNote} th={current.noteTh} en={current.noteEn} maxLength={300} multiline labels={labels} />

        <p className="text-fg-muted text-xs font-semibold uppercase">{strings.textsGroupCta}</p>
        <Row field="ctaLabel" label={strings.textsCtaLabel} th={current.ctaLabelTh} en={current.ctaLabelEn} maxLength={40} labels={labels} />
        <label className="flex flex-col gap-1" data-texts-row="ctaHref">
          <span className="text-fg-muted text-xs font-semibold">{strings.textsCtaHref}</span>
          <input
            type="text"
            name="ctaHref"
            defaultValue={current.ctaHref}
            maxLength={300}
            className={`${INPUT_CLASS} ${bad("ctaHref") ? "border-brand-red" : ""}`}
            data-texts-field="ctaHref"
          />
        </label>

        <button
          type="submit"
          className="bg-brand-red text-on-brand focus-visible:ring-ring w-fit rounded-xl px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          data-texts-save=""
        >
          {strings.textsSave}
        </button>
      </form>
    </section>
  );
}
