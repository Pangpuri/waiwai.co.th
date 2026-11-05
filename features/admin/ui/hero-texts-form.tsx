import Link from "next/link";

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
 * ⚠️ **ทุกช่องข้อความเว้นว่างได้ = ซ่อนส่วนนั้นบนเว็บ** (รอบที่ 331 · คำสั่งเจ้าของ 2026-11-05)
 *   · ช่องอังกฤษเว้นว่างได้ (มติ D22: EN = ความรับผิดชอบการตลาด) — หน้า EN จะถอยไปใช้ไทย
 * ⚠️ ห้ามพิมพ์ข้อความไทยในไฟล์นี้ — ทุกป้ายมาจากพจนานุกรม (`messages.admin`)
 */
export type HeroTextsFormProps = {
  readonly current: HeroTextsInput;
  readonly strings: Messages["admin"];
  /** ช่องที่ต้องแก้ (มาจาก `?fields=` หลัง Server Action ปฏิเสธ) */
  readonly problemFields?: readonly string[];
  /**
   * `true` = ฟอร์มกำลังแสดงค่าเริ่มต้นจากระบบ (มาจาก `?defaults=1`)
   * ยังไม่บันทึก — ผู้ใช้ต้องกด "บันทึกข้อความ" เอง (รอบที่ 331)
   */
  readonly showingDefaults?: boolean;
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
  readonly maxLength: number;
  readonly multiline?: boolean;
  readonly badTh?: boolean;
  readonly badEn?: boolean;
  readonly labels: { readonly th: string; readonly en: string };
};

/** แถวหนึ่ง = ป้าย + ช่องไทย + ช่องอังกฤษ (ส่ง `defaultValue` แยกกันช่อง — ห้ามใช้ค่าช่องเดียวกันทั้งคู่) */
function Row({ field, label, th, en, maxLength, multiline = false, badTh = false, badEn = false, labels }: RowProps) {
  const pairs = [
    { name: `${field}Th`, value: th, language: "th" as const, bad: badTh },
    { name: `${field}En`, value: en, language: "en" as const, bad: badEn },
  ];

  return (
    <div className="flex flex-col gap-3 sm:flex-row" data-texts-row={field}>
      <p className="text-fg-muted w-44 shrink-0 text-xs font-semibold">{label}</p>
      <div className="grid flex-1 gap-2 sm:grid-cols-2">
        {pairs.map((pair) => (
          <label key={pair.name} className="flex flex-col gap-1">
            <span className="text-fg-muted text-[11px]">{pair.language === "th" ? labels.th : labels.en}</span>
            {multiline ? (
              <textarea
                name={pair.name}
                defaultValue={pair.value}
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

export function HeroTextsForm({ current, strings, problemFields = [], showingDefaults = false }: HeroTextsFormProps) {
  const labels = { th: strings.textsLabelTh, en: strings.textsLabelEn };
  const bad = (name: string): boolean => problemFields.includes(name);

  return (
    <section
      id="hero-texts"
      className="border-line bg-surface scroll-mt-24 flex flex-col gap-4 rounded-2xl border p-4"
      data-hero-texts=""
    >
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

      {showingDefaults ? (
        <p className="border-line bg-bg-subtle text-fg-muted rounded-lg border px-3 py-2 text-xs" data-texts-defaults="">
          {strings.textsDefaultsNotice}
        </p>
      ) : null}

      {/*
        `key` เปลี่ยนตามโหมด ⇒ React remount ฟอร์มเมื่อสลับ "ค่าเริ่มต้น" ↔ "ค่าที่บันทึกไว้"
        (input เป็น uncontrolled: ถ้าไม่ remount, `defaultValue` ใหม่จะไม่ถูกเติมลงช่อง)
      */}
      <form
        key={showingDefaults ? "hero-texts-defaults" : "hero-texts-saved"}
        action={saveHeroTextsAction}
        className="flex flex-col gap-5"
      >
        <p className="text-fg-muted text-xs font-semibold uppercase">{strings.textsGroupTexts}</p>
        <Row field="eyebrow" label={strings.textsEyebrow} th={current.eyebrowTh} en={current.eyebrowEn} maxLength={40} badTh={bad("eyebrowTh")} labels={labels} />
        <Row field="title" label={strings.textsTitleField} th={current.titleTh} en={current.titleEn} maxLength={70} badTh={bad("titleTh")} labels={labels} />
        <Row
          field="titleAccent"
          label={strings.textsTitleAccent}
          th={current.titleAccentTh}
          en={current.titleAccentEn}
          maxLength={60}
          badTh={bad("titleAccentTh")}
          labels={labels}
        />
        <Row field="body" label={strings.textsBody} th={current.bodyTh} en={current.bodyEn} maxLength={400} multiline badTh={bad("bodyTh")} labels={labels} />
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

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="bg-brand-red text-on-brand focus-visible:ring-ring w-fit rounded-xl px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            data-texts-save=""
          >
            {strings.textsSave}
          </button>

          {/*
            ลิงก์ธรรมดา (GET) — ไม่เขียน DB · สลับระหว่าง "ดูค่าเริ่มต้น" กับ "กลับไปใช้ค่าที่บันทึกไว้"
            ⇒ ปลอดภัยแม้ปิด JS และไม่มีทางล้างข้อมูลโดยไม่กดบันทึก
          */}
          <Link
            href={showingDefaults ? "/admin/hero#hero-texts" : "/admin/hero?defaults=1#hero-texts"}
            className="border-line bg-bg-subtle text-fg hover:bg-surface focus-visible:ring-ring inline-flex w-fit items-center rounded-xl border px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            data-texts-defaults-link={showingDefaults ? "back" : "restore"}
          >
            {showingDefaults ? strings.textsBackToSaved : strings.textsRestoreDefaults}
          </Link>
        </div>
      </form>
    </section>
  );
}
