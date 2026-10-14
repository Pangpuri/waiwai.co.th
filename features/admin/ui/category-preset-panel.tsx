"use client";

import { useActionState } from "react";

import {
  applyCategoryPresetAction,
  deleteCategoryPresetAction,
  importCategoryPresetAction,
  saveCategoryPresetAction,
} from "@/app/admin/product-categories/actions";
import { INITIAL_CATEGORY_PRESET_STATE } from "@/features/admin/category-state";
import { fillTemplate } from "@/lib/i18n/template";
import type { Messages } from "@/lib/i18n/messages/th";

/**
 * แผง **พรีเซ็ตของหมวดสินค้า** (รอบที่ 264 · มติ D25 ข้อ 5)
 *
 * - บันทึกชุดจากค่าปัจจุบัน · ใช้ชุด (เขียนทับเฉพาะหมวดที่มีอยู่จริง ไม่ลบ/ไม่สร้าง) · ลบชุด
 * - **ส่งออก/นำเข้า JSON** (แบบเดียวกับพรีเซ็ตของส่วนกลาง W3b) — ไฟล์ที่เสียถูกปฏิเสธทั้งไฟล์
 * - เก็บไม่จำกัดจำนวนชุด · ไม่หมดอายุ · **ไม่ขึ้นหน้า `/privacy`** (ไม่ใช่ข้อมูลส่วนบุคคล)
 * - ฟอร์มย่อยแยกกันทั้งหมด (ห้าม `<form>` ซ้อน)
 */

export type CategoryPresetView = {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
  readonly count: number;
};

export type CategoryPresetPanelProps = {
  readonly strings: Messages["adminCategories"];
  readonly presets: readonly CategoryPresetView[];
};

const INPUT_CLASS =
  "border-line bg-surface text-fg focus-visible:ring-ring w-full rounded-lg border px-2.5 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none";
const LABEL_CLASS = "text-fg-muted mb-1 block text-xs font-semibold";
const BUTTON_CLASS =
  "border-line text-fg hover:bg-surface-raised focus-visible:ring-ring rounded-lg border px-2.5 py-1 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none";
const PRIMARY_CLASS =
  "bg-accent text-accent-fg hover:bg-accent-strong focus-visible:ring-ring inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-offset-2";

export function CategoryPresetPanel(props: CategoryPresetPanelProps) {
  const m = props.strings;
  const [saveState, saveAction, saving] = useActionState(saveCategoryPresetAction, INITIAL_CATEGORY_PRESET_STATE);
  const [importState, importAction, importing] = useActionState(importCategoryPresetAction, INITIAL_CATEGORY_PRESET_STATE);

  const saveMessage =
    saveState.status === "saved"
      ? fillTemplate(m.presetSaved, { count: String(saveState.count) })
      : saveState.status === "error"
        ? m.presetSaveFailed
        : "";
  const importMessage =
    importState.status === "imported"
      ? fillTemplate(m.presetImported, { count: String(importState.count) })
      : importState.status === "error"
        ? m.presetImportFailed
        : "";

  return (
    <section className="border-line bg-bg-subtle mt-8 rounded-2xl border p-4">
      <h2 className="text-fg text-base font-semibold">{m.presetsTitle}</h2>
      <p className="text-fg-muted mt-1 text-sm">{m.presetsHint}</p>

      {/* บันทึกชุดจากค่าปัจจุบัน */}
      <form action={saveAction} className="mt-4 flex flex-wrap items-end gap-2">
        <label className="block min-w-56 flex-1">
          <span className={LABEL_CLASS}>{m.presetName}</span>
          <input type="text" name="name" placeholder={m.presetNamePlaceholder} className={INPUT_CLASS} />
        </label>
        <button type="submit" disabled={saving} className={PRIMARY_CLASS}>
          {m.presetSave}
        </button>
        {/* ดาวน์โหลดผ่าน route handler (ตรวจสิทธิ์เอง) — ต้องมี `download` ให้ lint รู้ว่าไม่ใช่การนำทางหน้า */}
        <a href="/admin/product-categories/export" download className={BUTTON_CLASS}>
          {m.presetExport}
        </a>
      </form>
      {saveMessage === "" ? null : (
        <p
          role="status"
          className={`mt-2 text-sm ${saveState.status === "error" ? "text-danger" : "text-fg"}`}
        >
          {saveMessage}
        </p>
      )}

      {/* นำเข้าจากไฟล์ */}
      <form action={importAction} className="mt-4 flex flex-wrap items-end gap-2">
        <label className="block min-w-56 flex-1">
          <span className={LABEL_CLASS}>{m.presetImport}</span>
          <input type="file" name="file" accept="application/json,.json" className={INPUT_CLASS} />
          <span className="text-fg-muted mt-1 block text-[11px]">{m.presetImportHint}</span>
        </label>
        <label className="block min-w-48">
          <span className={LABEL_CLASS}>{m.presetName}</span>
          <input type="text" name="name" placeholder={m.presetNamePlaceholder} className={INPUT_CLASS} />
        </label>
        <button type="submit" disabled={importing} className={BUTTON_CLASS}>
          {m.presetImport}
        </button>
      </form>
      {importMessage === "" ? null : (
        <p role="status" className={`mt-2 text-sm ${importState.status === "error" ? "text-danger" : "text-fg"}`}>
          {importMessage}
        </p>
      )}

      {/* รายการชุดที่บันทึกไว้ */}
      {props.presets.length === 0 ? (
        <p className="text-fg-muted mt-4 text-sm">{m.presetEmpty}</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {props.presets.map((preset) => (
            <li
              key={preset.id}
              className="border-line bg-surface flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2"
            >
              <span className="min-w-0">
                <span className="text-fg block text-sm font-semibold">{preset.name}</span>
                <span className="text-fg-muted block text-xs">
                  {fillTemplate(m.presetCount, { count: String(preset.count) })} · {preset.createdAt.slice(0, 16).replace("T", " ")}
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <form action={applyCategoryPresetAction}>
                  <input type="hidden" name="presetId" value={preset.id} />
                  <button type="submit" className={BUTTON_CLASS}>
                    {m.presetApply}
                  </button>
                </form>
                <form action={deleteCategoryPresetAction}>
                  <input type="hidden" name="presetId" value={preset.id} />
                  <button type="submit" className={BUTTON_CLASS}>
                    {m.presetDelete}
                  </button>
                </form>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-fg-muted mt-2 text-[11px]">{m.presetApplyHint}</p>
    </section>
  );
}
