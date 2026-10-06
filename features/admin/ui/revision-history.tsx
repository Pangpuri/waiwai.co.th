import Link from "next/link";

import type { Messages } from "@/lib/i18n/messages/th";
import type { RevisionFieldChange, RevisionMeta } from "@/lib/revisions/model";

/**
 * แผง "ประวัติการแก้ไข" (B1 ส่วนที่ 2 · รอบที่ 145)
 *
 * ใช้ร่วมกับจอแก้ทั้ง 3 จอ (สินค้า · เมนูอาหาร · ข่าว) — **ไม่ใช้ JS เลย**
 *   · รายการรุ่น = ลิงก์ `?revision=<id>` (เปิดดู/เทียบ)
 *   · เทียบความต่าง = ตาราง "ก่อน/หลัง" ที่คำนวณบนเซิร์ฟเวอร์ (`revisionDiff`)
 *   · ปุ่มกู้คืน = ฟอร์มธรรมดา → Server Action (ตรวจสิทธิ์ + audit ที่ฝั่งเซิร์ฟเวอร์)
 *
 * ⚠️ กติกาที่แสดงให้ผู้ใช้เห็นชัด: **กู้คืน = เขียนรุ่นใหม่** (ไม่ลบประวัติ) ⇒ ย้อนกลับได้เสมอ
 */

export type RevisionPanelStrings = Messages["admin"];

/** ป้ายชื่อช่อง — ชื่อช่องที่ไม่รู้จักจะแสดงเป็นชื่อคีย์ (ไม่แต่งข้อความขึ้นเอง) */
function fieldLabel(strings: RevisionPanelStrings, field: string): string {
  const map: Readonly<Record<string, string>> = {
    titleTh: strings.revisionsFieldTitle,
    nameTh: strings.revisionsFieldTitle,
    titleEn: strings.revisionsFieldTitleEn,
    nameEn: strings.revisionsFieldTitleEn,
    excerptTh: strings.revisionsFieldExcerpt,
    excerptEn: strings.revisionsFieldExcerpt,
    body: strings.revisionsFieldBody,
    detailsTh: strings.revisionsFieldDetails,
    detailsEn: strings.revisionsFieldDetails,
    allergensTh: strings.revisionsFieldAllergens,
    allergensEn: strings.revisionsFieldAllergens,
    netWeightTh: strings.revisionsFieldNetWeight,
    netWeightEn: strings.revisionsFieldNetWeight,
    packagingTh: strings.revisionsFieldPackaging,
    packagingEn: strings.revisionsFieldPackaging,
    groupTh: strings.revisionsFieldGroup,
    groupEn: strings.revisionsFieldGroup,
    categoryId: strings.revisionsFieldCategory,
    imagePath: strings.revisionsFieldImage,
    coverPath: strings.revisionsFieldImage,
    ingredients: strings.revisionsFieldIngredients,
    videoId: strings.revisionsFieldVideo,
    publishedOn: strings.revisionsFieldPublished,
    publishedLocal: strings.revisionsFieldPublished,
    publishedLabel: strings.revisionsFieldPublished,
    status: strings.revisionsFieldStatus,
    sortOrder: strings.revisionsFieldSortOrder,
  };
  return map[field] ?? field;
}

function shorten(value: string, max = 160): string {
  const text = value.trim();
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

export function RevisionHistoryPanel({
  strings,
  revisions,
  selected,
  changes,
  restoreAction,
  entityId,
  basePath,
}: {
  readonly strings: RevisionPanelStrings;
  readonly revisions: readonly RevisionMeta[];
  /** รุ่นที่กำลังดู/เทียบ (null = ยังไม่เลือก) */
  readonly selected: RevisionMeta | null;
  /** ความต่างระหว่างรุ่นที่เลือก (ก่อน) กับค่าปัจจุบัน (หลัง) */
  readonly changes: readonly RevisionFieldChange[];
  readonly restoreAction: (formData: FormData) => Promise<void>;
  readonly entityId: string;
  readonly basePath: string;
}) {
  return (
    <section className="border-line bg-bg-subtle mt-6 rounded-2xl border p-4">
      <h2 className="text-fg text-sm font-semibold">{strings.revisionsTitle}</h2>
      <p className="text-fg-muted mt-1 text-xs">{strings.revisionsHint}</p>

      {revisions.length === 0 ? (
        <p className="text-fg-muted mt-3 text-xs">{strings.revisionsEmpty}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1">
          {revisions.map((revision) => (
            <li key={revision.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <Link
                href={`${basePath}?revision=${revision.id}`}
                className="text-brand-red-deep font-semibold underline"
                aria-current={selected?.id === revision.id ? "true" : undefined}
              >
                #{revision.revision}
              </Link>
              <span className="text-fg-muted">{revision.createdLocal}</span>
              {revision.createdBy === "" ? null : (
                <span className="text-fg-muted">
                  {strings.revisionsBy} {revision.createdBy}
                </span>
              )}
              <span className="text-fg-muted">
                {revision.changeCount === 0
                  ? strings.revisionsNoChange
                  : strings.revisionsChanged.replace("{count}", String(revision.changeCount))}
              </span>
              {revision.note === "" ? null : <span className="text-fg-muted">· {revision.note}</span>}
            </li>
          ))}
        </ul>
      )}

      {selected === null ? null : (
        <div className="border-line mt-4 border-t pt-3">
          <p className="text-fg text-xs font-semibold">
            #{selected.revision} · {strings.revisionsSelectedHint}
          </p>

          {changes.length === 0 ? (
            <p className="text-fg-muted mt-2 text-xs">{strings.revisionsNoChange}</p>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="text-fg-muted">
                    <th scope="col" className="border-line border-b py-1 pr-2 font-semibold">
                      {strings.revisionsField}
                    </th>
                    <th scope="col" className="border-line border-b py-1 pr-2 font-semibold">
                      {strings.revisionsBefore}
                    </th>
                    <th scope="col" className="border-line border-b py-1 font-semibold">
                      {strings.revisionsAfter}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {changes.map((change) => (
                    <tr key={change.field}>
                      <th scope="row" className="border-line text-fg border-b py-1 pr-2 align-top font-semibold">
                        {fieldLabel(strings, change.field)}
                      </th>
                      <td className="border-line text-fg-muted border-b py-1 pr-2 align-top">
                        {change.before === "" ? "—" : shorten(change.before)}
                      </td>
                      <td className="border-line text-fg border-b py-1 align-top">
                        {change.after === "" ? "—" : shorten(change.after)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <form action={restoreAction} className="mt-3 flex flex-wrap items-center gap-3">
            <input type="hidden" name="id" value={entityId} />
            <input type="hidden" name="revisionId" value={selected.id} />
            <button
              type="submit"
              className="bg-brand-red text-on-brand focus-visible:ring-ring rounded-full px-4 py-1.5 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none"
            >
              {strings.revisionsRestore}
            </button>
            <span className="text-fg-muted text-xs">{strings.revisionsRestoreWarning}</span>
          </form>

          <Link href={basePath} className="text-fg-muted mt-2 inline-block text-xs underline">
            {strings.revisionsClose}
          </Link>
        </div>
      )}
    </section>
  );
}
