"use client";

import type { DiffEntry, DiffEntryKind, DocumentDiff } from "@/lib/blocks/diff";
import { BLOCK_CATALOG, isBlockType } from "@/lib/blocks/types";
import { fillTemplate } from "@/lib/i18n/template";
import type { Messages } from "@/lib/i18n/messages/th";

/**
 * แสดง "ความต่างของสองรุ่นเอกสาร" (X1.5)
 *
 * ใช้ทั้งตอนเทียบรุ่นก่อนกู้คืน · ตัวนับงานที่ยังไม่บันทึก (หน้าจอหลักโชว์แค่ตัวเลข)
 * ⇒ ที่นี่ทำหน้าที่แค่ "อ่านง่าย" ไม่มีตรรกะเทียบ (ตรรกะอยู่ที่ `lib/blocks/diff.ts` ซึ่งมีเทสต์)
 *
 * กติกาโปรเจกต์ที่เกี่ยวข้อง: ห้ามข้อความไทยใน `.tsx` (ทุกป้ายมาจากพจนานุกรม) และห้ามคลาสสีดิบ
 * (ใช้ token เท่านั้น — ด่าน `check:dark`)
 */

/** ตัดค่าที่ยาวเกินให้อ่านได้ในบรรทัดเดียว */
const VALUE_PREVIEW_LENGTH = 80;

function previewValue(value: string): string {
  const flat = value.replace(/\s+/g, " ").trim();
  if (flat === "") return "·";
  return flat.length > VALUE_PREVIEW_LENGTH ? `${flat.slice(0, VALUE_PREVIEW_LENGTH)}…` : flat;
}

function kindLabel(strings: Messages["admin"], kind: DiffEntryKind): string {
  switch (kind) {
    case "added":
      return strings.draftKindAdded;
    case "removed":
      return strings.draftKindRemoved;
    case "changed":
      return strings.draftKindChanged;
    case "moved":
      return strings.draftKindMoved;
  }
}

function typeLabel(type: string): string {
  return isBlockType(type) ? (BLOCK_CATALOG.find((entry) => entry.type === type)?.label ?? type) : type;
}

function EntryView({ entry, strings }: { readonly entry: DiffEntry; readonly strings: Messages["admin"] }) {
  return (
    <li className="border-line flex flex-col gap-1 rounded-lg border p-2">
      <p className="text-fg text-xs font-semibold">
        {kindLabel(strings, entry.kind)} · {typeLabel(entry.blockType)}{" "}
        <span className="text-fg-muted font-normal">
          #{entry.index + 1}
          {entry.columnIndex === null ? "" : ` · ${fillTemplate(strings.draftInColumn, { n: entry.columnIndex + 1 })}`}
        </span>
      </p>

      {entry.fields.length === 0 ? null : (
        <ul className="flex flex-col gap-0.5">
          {entry.fields.map((field) => (
            <li key={`${entry.blockId}-${field.path}`} className="text-fg-muted text-[11px] break-words">
              <span className="font-mono">{field.path}</span>: <span className="line-through">{previewValue(field.before)}</span>{" "}
              <span aria-hidden="true">→</span> <span className="text-fg font-medium">{previewValue(field.after)}</span>
            </li>
          ))}
        </ul>
      )}

      {entry.truncated ? <p className="text-fg-muted text-[11px]">{strings.draftCompareFieldTruncated}</p> : null}
    </li>
  );
}

export function DocumentDiffView({
  diff,
  strings,
}: {
  readonly diff: DocumentDiff;
  readonly strings: Messages["admin"];
}) {
  if (diff.identical) {
    return <p className="text-fg-muted text-xs">{strings.draftCompareIdentical}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-fg text-xs font-semibold">
        {fillTemplate(strings.draftCompareSummary, {
          added: diff.summary.added,
          removed: diff.summary.removed,
          changed: diff.summary.changed,
          moved: diff.summary.moved,
        })}
        {diff.orderChanged ? ` · ${strings.draftCompareOrderChanged}` : ""}
      </p>

      <ul className="flex max-h-96 flex-col gap-1 overflow-auto">
        {diff.entries.map((entry) => (
          <EntryView key={`${entry.kind}-${entry.blockId}`} entry={entry} strings={strings} />
        ))}
      </ul>

      {diff.truncated ? <p className="text-fg-muted text-[11px]">{strings.draftCompareTruncated}</p> : null}
    </div>
  );
}

/** ตัวเลขสรุปสั้น ๆ สำหรับแถบสถานะ (ไม่ต้องเรนเดอร์ทั้งรายการ) */
export function diffSummaryLine(diff: DocumentDiff, strings: Messages["admin"]): string {
  return fillTemplate(strings.draftCompareSummary, {
    added: diff.summary.added,
    removed: diff.summary.removed,
    changed: diff.summary.changed,
    moved: diff.summary.moved,
  });
}
