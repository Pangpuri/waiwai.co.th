"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";

import {
  applyCareersSpreadsheetAction,
  previewCareersSpreadsheetAction,
} from "@/app/admin/careers/actions";
import {
  INITIAL_CAREERS_SPREADSHEET_IMPORT_STATE,
  INITIAL_CAREERS_SPREADSHEET_PREVIEW_STATE,
  type CareersSpreadsheetPreviewState,
} from "@/features/admin/careers-state";
import { fillTemplate } from "@/lib/i18n/template";
import type { Messages } from "@/lib/i18n/messages/th";
import type {
  CareersSpreadsheetIssue,
  CareersSpreadsheetRow,
} from "@/lib/careers/xlsx-import";

type Strings = Messages["adminCareers"];

function issueMessage(issue: CareersSpreadsheetIssue, strings: Strings): string {
  const row = String(issue.row ?? "");
  switch (issue.code) {
    case "invalid-file":
      return strings.xlsxImportErrorFile;
    case "file-too-large":
      return strings.xlsxImportErrorSize;
    case "missing-columns":
      return strings.xlsxImportErrorColumns;
    case "no-postings":
      return strings.xlsxImportErrorNoRows;
    case "too-many-rows":
      return strings.xlsxImportErrorTooMany;
    case "invalid-gender":
      return fillTemplate(strings.xlsxImportErrorGender, { row });
    case "invalid-openings":
      return fillTemplate(strings.xlsxImportErrorOpenings, { row });
    case "invalid-preview":
      return strings.xlsxImportErrorPreview;
    case "invalid-row":
      return fillTemplate(strings.xlsxImportErrorRow, { row });
  }
}

function importSummary(rows: readonly CareersSpreadsheetRow[], strings: Strings): string {
  return fillTemplate(strings.xlsxImportSummary, { count: String(rows.length) });
}

export function CareersSpreadsheetImport({ strings }: { readonly strings: Strings }) {
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [dismissedPreview, setDismissedPreview] = useState<CareersSpreadsheetPreviewState | null>(null);
  const [preview, previewAction, previewPending] = useActionState(
    previewCareersSpreadsheetAction,
    INITIAL_CAREERS_SPREADSHEET_PREVIEW_STATE,
  );
  const [result, importAction, importPending] = useActionState(
    applyCareersSpreadsheetAction,
    INITIAL_CAREERS_SPREADSHEET_IMPORT_STATE,
  );

  const resultMessage =
    result.status === "saved"
      ? fillTemplate(strings.xlsxImportSuccess, {
          count: String(result.count),
          created: String(result.created),
          protected: String(result.protected),
        })
      : result.status === "error"
        ? result.reason === "database"
          ? strings.xlsxImportErrorDatabase
          : strings.xlsxImportErrorPreview
        : "";

  return (
    <section className="border-line bg-surface mt-6 rounded-2xl border p-4">
      <h2 className="text-fg text-base font-semibold">{strings.xlsxImportTitle}</h2>
      <p className="text-fg-muted mt-1 text-sm">{strings.xlsxImportHint}</p>

      <form
        action={previewAction}
        className="mt-4 flex flex-wrap items-end gap-3"
      >
        <label className="block min-w-64 flex-1">
          <span className="text-fg-muted mb-1 block text-xs font-semibold">{strings.xlsxImportFile}</span>
          <input
            ref={fileInput}
            type="file"
            name="workbook"
            accept=".xlsx"
            required
            className="border-line bg-surface text-fg focus-visible:ring-ring w-full rounded-lg border px-2.5 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={previewPending}
          className="bg-accent text-accent-fg hover:bg-accent-strong focus-visible:ring-ring rounded-full px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {previewPending ? strings.xlsxImportPreviewing : strings.xlsxImportPreview}
        </button>
      </form>

      {preview.status === "error" && preview.issue !== null ? (
        <p className="text-danger mt-3 text-sm" role="alert">
          {issueMessage(preview.issue, strings)}
        </p>
      ) : null}

      {preview.status === "preview" && preview !== dismissedPreview && !previewPending ? (
        <div className="mt-5">
          <p className="text-fg-muted text-sm">{importSummary(preview.rows, strings)}</p>
          <div className="border-line mt-3 max-h-96 overflow-auto rounded-xl border">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-bg-subtle text-fg-muted sticky top-0 text-left text-xs">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">{strings.colOrder}</th>
                  <th scope="col" className="px-3 py-2 font-semibold">{strings.colTitle}</th>
                  <th scope="col" className="px-3 py-2 font-semibold">{strings.fieldDepartmentTh}</th>
                  <th scope="col" className="px-3 py-2 font-semibold">{strings.fieldOpenings}</th>
                  <th scope="col" className="px-3 py-2 font-semibold">{strings.fieldPostedAt}</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.sourceRow} className="border-line border-t align-top">
                    <td className="text-fg-muted px-3 py-2">{row.sourceRow}</td>
                    <td className="text-fg px-3 py-2">{row.titleTh}</td>
                    <td className="text-fg-muted px-3 py-2">{row.departmentTh}</td>
                    <td className="text-fg-muted px-3 py-2">{row.openings}</td>
                    <td className="text-fg-muted px-3 py-2">{strings.xlsxImportNoDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form action={importAction} className="mt-4">
            <input type="hidden" name="rows" value={JSON.stringify(preview.rows)} />
            <button
              type="submit"
              disabled={importPending}
              className="bg-accent text-accent-fg hover:bg-accent-strong focus-visible:ring-ring rounded-full px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60"
            >
              {importPending ? strings.xlsxImportApplying : strings.xlsxImportApply}
            </button>
          </form>
          <button
            type="button"
            onClick={() => {
              setDismissedPreview(preview);
              if (fileInput.current !== null) fileInput.current.value = "";
            }}
            className="border-line text-fg hover:bg-surface-raised focus-visible:ring-ring mt-3 rounded-lg border px-3 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
          >
            {strings.xlsxImportClear}
          </button>
          <p className="text-fg-muted mt-1 text-xs">{strings.xlsxImportClearHint}</p>
        </div>
      ) : null}

      {resultMessage === "" ? null : (
        <p
          className={`${result.status === "error" ? "text-danger" : "text-fg"} mt-3 text-sm`}
          role={result.status === "error" ? "alert" : "status"}
        >
          {resultMessage}
        </p>
      )}
      {result.status === "saved" ? (
        <Link
          href="/admin/careers?tab=draft"
          className="text-link mt-3 inline-flex text-sm font-semibold underline underline-offset-4"
        >
          {strings.xlsxImportViewDrafts}
        </Link>
      ) : null}
    </section>
  );
}
