"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { createJobAction, saveJobAction } from "@/app/admin/careers/actions";
import { INITIAL_JOB_FORM_STATE } from "@/features/admin/careers-state";
import { JobBoard } from "@/features/careers/ui/job-board";
import type { Board, BoardLabels } from "@/features/careers/board";
import type { Messages } from "@/lib/i18n/messages/th";
import { JOB_GENDERS, MAX_JOB_TEXT_LENGTH } from "@/lib/careers/model";

/**
 * ฟอร์มเพิ่ม/แก้ "ประกาศรับสมัครงาน" (รอบที่ 265 · มติ D26)
 *
 * หลักการเดียวกับจออื่นของโปรเจกต์
 * - **พรีวิว = ตัวเรนเดอร์จริง** (`JobBoard` ตัวเดียวกับหน้า /careers) — พิมพ์ปุ๊บเห็นปั๊บ
 * - ส่งเฉพาะ **ป้ายข้อความที่ใช้จริง** (`BoardLabels` + ชื่อปุ่ม "ทั้งหมด" + ป้ายเพศ 3 คำ) ไม่ส่งพจนานุกรมทั้งก้อน
 * - **ไม่มี `<form>` ซ้อน** — ฟอร์มเดียวต่อหน้า
 * - ชื่อไทยบังคับ (มติ D3) · เพศ/อายุ **ไม่บังคับ** (มติ D26 ข้อ 4) ⇒ บรรทัดที่ไม่กรอกจะไม่ขึ้นบนการ์ด
 */

export type JobFormValues = {
  readonly id: string;
  readonly titleTh: string;
  readonly titleEn: string;
  readonly departmentTh: string;
  readonly departmentEn: string;
  readonly openings: number;
  readonly gender: string;
  readonly ageTh: string;
  readonly ageEn: string;
  readonly qualificationsTh: string;
  readonly qualificationsEn: string;
  readonly experienceTh: string;
  readonly experienceEn: string;
  readonly sortOrder: number;
  readonly status: string;
};

export type JobFormProps = {
  readonly mode: "create" | "edit";
  readonly values: JobFormValues;
  readonly strings: Messages["adminCareers"];
  /** ป้ายของกระดานจริง (ส่งเฉพาะข้อความ ไม่ใช่พจนานุกรมทั้งก้อน) */
  readonly boardLabels: BoardLabels;
  readonly filterAll: string;
  /** ป้ายเพศจากพจนานุกรม (`male`/`female`/`any`) — ใช้ทั้งในตัวเลือกและพรีวิว */
  readonly genderLabels: Readonly<Record<string, string>>;
  /** อยู่ในถังขยะ = ห้ามแก้ (ต้องกู้คืนก่อน) */
  readonly trashed: boolean;
};

const INPUT_CLASS =
  "border-line bg-surface text-fg focus-visible:ring-ring w-full rounded-lg border px-2.5 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none";
const LABEL_CLASS = "text-fg-muted mb-1 block text-xs font-semibold";
const PRIMARY_CLASS =
  "bg-accent text-accent-fg hover:bg-accent-strong focus-visible:ring-ring inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-offset-2";

export function JobForm(props: JobFormProps) {
  const m = props.strings;
  const [state, formAction, pending] = useActionState(
    props.mode === "create" ? createJobAction : saveJobAction,
    INITIAL_JOB_FORM_STATE,
  );

  const [values, setValues] = useState<JobFormValues>(props.values);
  function set<K extends keyof JobFormValues>(key: K, value: JobFormValues[K]): void {
    setValues((current) => ({ ...current, [key]: value }));
  }

  const statusMessage =
    state.status === "saved"
      ? props.mode === "create"
        ? state.createdId === ""
          ? m.saved
          : `${m.created} · ${state.createdId}`
        : m.saved
      : state.status === "error"
        ? state.reason === "database"
          ? m.noDatabase
          : state.reason === "missing"
            ? m.missing
            : state.reason === "duplicate"
              ? m.duplicate
              : m.invalid
        : "";

  /* พรีวิว: สร้างกระดาน 1 ใบจากค่าที่กรอกค้างในฟอร์ม แล้วเรนเดอร์ด้วย JobBoard ตัวจริง */
  const genderLabel = values.gender === "" ? "" : (props.genderLabels[values.gender] ?? "");
  const previewBoard: Board = {
    cards: [
      {
        id: values.id === "" ? "preview" : values.id,
        departmentId: values.departmentTh,
        departmentLabel: values.departmentTh,
        title: values.titleTh,
        openings: values.openings,
        genderLabel,
        ageLabel: values.ageTh,
        qualificationsLabel: values.qualificationsTh,
        experienceLabel: values.experienceTh.trim() === "" ? m.notSpecifiedPreview : values.experienceTh,
      },
    ],
    filters: [{ id: "all", label: props.filterAll, count: 1 }],
    labels: props.boardLabels,
  };

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="border-line bg-surface rounded-2xl border p-4">
        {props.mode === "edit" ? <input type="hidden" name="id" value={values.id} /> : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <label className="block">
            <span className={LABEL_CLASS}>{m.fieldTitleTh}</span>
            <input
              type="text"
              name="titleTh"
              value={values.titleTh}
              onChange={(event) => set("titleTh", event.target.value)}
              className={INPUT_CLASS}
            />
          </label>
          <label className="block">
            <span className={LABEL_CLASS}>{m.fieldTitleEn}</span>
            <input
              type="text"
              name="titleEn"
              value={values.titleEn}
              onChange={(event) => set("titleEn", event.target.value)}
              className={INPUT_CLASS}
            />
          </label>
          <label className="block">
            <span className={LABEL_CLASS}>{m.fieldDepartmentTh}</span>
            <input
              type="text"
              name="departmentTh"
              value={values.departmentTh}
              onChange={(event) => set("departmentTh", event.target.value)}
              className={INPUT_CLASS}
            />
            <span className="text-fg-muted mt-1 block text-[11px]">{m.fieldDepartmentHint}</span>
          </label>
          <label className="block">
            <span className={LABEL_CLASS}>{m.fieldDepartmentEn}</span>
            <input
              type="text"
              name="departmentEn"
              value={values.departmentEn}
              onChange={(event) => set("departmentEn", event.target.value)}
              className={INPUT_CLASS}
            />
          </label>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-4">
          <label className="block">
            <span className={LABEL_CLASS}>{m.fieldOpenings}</span>
            <input
              type="number"
              name="openings"
              min={0}
              max={999}
              value={values.openings}
              onChange={(event) => set("openings", Number.parseInt(event.target.value, 10) || 0)}
              className={INPUT_CLASS}
            />
          </label>
          <label className="block">
            <span className={LABEL_CLASS}>{m.fieldGender}</span>
            <select
              name="gender"
              value={values.gender}
              onChange={(event) => set("gender", event.target.value)}
              className={INPUT_CLASS}
            >
              {JOB_GENDERS.map((key) => (
                <option key={key === "" ? "none" : key} value={key}>
                  {key === "" ? m.genderUnset : (props.genderLabels[key] ?? key)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={LABEL_CLASS}>{m.fieldAgeTh}</span>
            <input
              type="text"
              name="ageTh"
              value={values.ageTh}
              onChange={(event) => set("ageTh", event.target.value)}
              className={INPUT_CLASS}
            />
          </label>
          <label className="block">
            <span className={LABEL_CLASS}>{m.fieldAgeEn}</span>
            <input
              type="text"
              name="ageEn"
              value={values.ageEn}
              onChange={(event) => set("ageEn", event.target.value)}
              className={INPUT_CLASS}
            />
          </label>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <label className="block">
            <span className={LABEL_CLASS}>{m.fieldQualificationsTh}</span>
            <textarea
              name="qualificationsTh"
              rows={3}
              maxLength={MAX_JOB_TEXT_LENGTH}
              value={values.qualificationsTh}
              onChange={(event) => set("qualificationsTh", event.target.value)}
              className={INPUT_CLASS}
            />
          </label>
          <label className="block">
            <span className={LABEL_CLASS}>{m.fieldQualificationsEn}</span>
            <textarea
              name="qualificationsEn"
              rows={3}
              maxLength={MAX_JOB_TEXT_LENGTH}
              value={values.qualificationsEn}
              onChange={(event) => set("qualificationsEn", event.target.value)}
              className={INPUT_CLASS}
            />
          </label>
          <label className="block">
            <span className={LABEL_CLASS}>{m.fieldExperienceTh}</span>
            <textarea
              name="experienceTh"
              rows={2}
              maxLength={MAX_JOB_TEXT_LENGTH}
              value={values.experienceTh}
              onChange={(event) => set("experienceTh", event.target.value)}
              className={INPUT_CLASS}
            />
          </label>
          <label className="block">
            <span className={LABEL_CLASS}>{m.fieldExperienceEn}</span>
            <textarea
              name="experienceEn"
              rows={2}
              maxLength={MAX_JOB_TEXT_LENGTH}
              value={values.experienceEn}
              onChange={(event) => set("experienceEn", event.target.value)}
              className={INPUT_CLASS}
            />
          </label>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <label className="block">
            <span className={LABEL_CLASS}>{m.fieldSortOrder}</span>
            <input
              type="number"
              name="sortOrder"
              min={0}
              value={values.sortOrder}
              onChange={(event) => set("sortOrder", Number.parseInt(event.target.value, 10) || 0)}
              className={INPUT_CLASS}
            />
          </label>
          {props.mode === "edit" ? (
            <label className="block">
              <span className={LABEL_CLASS}>{m.fieldStatus}</span>
              <select
                name="status"
                value={values.status}
                onChange={(event) => set("status", event.target.value)}
                className={INPUT_CLASS}
              >
                <option value="draft">{m.statusDraft}</option>
                <option value="published">{m.statusPublished}</option>
              </select>
              <span className="text-fg-muted mt-1 block text-[11px]">{m.fieldStatusHint}</span>
            </label>
          ) : (
            /* ประกาศใหม่เป็น "ฉบับร่าง" เสมอ (มติ D26 ข้อ 5) — ใช้ช่องซ่อนให้ค่าตรงกับฝั่งเซิร์ฟเวอร์ */
            <input type="hidden" name="status" value="draft" />
          )}
        </div>

        {statusMessage === "" ? null : (
          <p
            role="status"
            className={`border-line bg-bg-subtle mt-4 rounded-xl border px-3 py-2 text-sm ${
              state.status === "error" ? "text-danger" : "text-fg"
            }`}
          >
            {statusMessage}
          </p>
        )}

        {state.status === "saved" && props.mode === "create" && state.createdId !== "" ? (
          <p className="mt-2">
            <Link href={`/admin/careers/${state.createdId}`} className="text-link text-sm underline underline-offset-4">
              {m.goToNew}
            </Link>
          </p>
        ) : null}

        <div className="mt-4">
          {props.trashed ? (
            <p className="text-fg-muted text-sm">{m.trashedHint}</p>
          ) : (
            <button type="submit" disabled={pending} className={PRIMARY_CLASS}>
              {props.mode === "create" ? m.create : m.save}
            </button>
          )}
        </div>
      </form>

      <section className="border-line bg-bg-subtle rounded-2xl border p-4">
        <h2 className="text-fg text-base font-semibold">{m.previewHeading}</h2>
        <p className="text-fg-muted mt-1 text-sm">{m.previewHint}</p>
        <div className="mt-4">
          <JobBoard board={previewBoard} />
        </div>
      </section>
    </div>
  );
}
