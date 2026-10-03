"use client";

import Link from "next/link";
import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { compareRevisionAction, publishAction, migrateBlocksAction, restoreRevisionAction, saveDraftAction, setPageLiveAction } from "@/app/admin/builder/actions";
import { deletePresetAction, savePresetAction } from "@/app/admin/builder/preset-actions";
import { uploadImageAction } from "@/app/admin/media/actions";
import { INITIAL_BUILDER_STATE, type BuilderState } from "@/features/admin/builder-state";
import { INITIAL_UPLOAD_STATE } from "@/features/admin/upload-state";
import { DocumentDiffView, diffSummaryLine } from "@/features/admin/ui/document-diff-view";
import { ImageDrop } from "@/features/admin/ui/image-drop";
import { BlockLayerList } from "@/features/admin/ui/block-layer-list";
import { DROP_IMAGE_MESSAGE, NAVBAR_MESSAGE, NAVBAR_SELECT_ID, NOTICE_SELECT_ID, PREVIEW_MESSAGE, SELECT_MESSAGE } from "@/features/blocks/ui/preview-frame";
import { AUTOSAVE_DELAY_MS, decideAutosave, needsLeaveWarning, shortTimeOf } from "@/lib/blocks/autosave";
import { documentDiff } from "@/lib/blocks/diff";
import {
  addCard,
  addColumn,
  addGalleryItem,
  addJobItem,
  addRosterMember,
  addTableColumn,
  addTableRow,
  canAddCard,
  canAddGalleryItem,
  canAddJobItem,
  canAddRosterMember,
  canAddTableColumn,
  canAddTableRow,
  canRemoveColumn,
  canRemoveTableColumn,
  duplicateBlock,
  insertBlockAt,
  insertPresetBlock,
  moveBlock,
  moveBlockToLocation,
  moveCardTo,
  removeBlock,
  removeCard,
  removeColumn,
  removeGalleryItem,
  removeJobItem,
  removeRosterMember,
  removeTableColumn,
  removeTableRow,
  replaceBlockWithPreset,
  setBlockChoice,
  setBlockImage,
  setBlockString,
  setBlockStyle,
  setBlockVisibility,
  setBlockText,
  setCardImage,
  setCardString,
  setCardText,
  setColumnWidth,
  setGalleryItemCaption,
  setGalleryItemImage,
  setJobBoardGrouping,
  setJobItemOpenings,
  setJobItemText,
  setPageLayout,
  setRosterColumns,
  setRosterMemberImage,
  setRosterMemberText,
  setTableCellText,
  setTableColumnText,
  setTableFirstColumnHeader,
} from "@/lib/blocks/edit";
import { LAYOUT_CHOICES, STYLE_CHOICES } from "@/lib/blocks/style";
import type { BlockPreset } from "@/lib/blocks/presets";
import type { StoredVersionSummary } from "@/lib/blocks/migrate";
import {
  BLOCK_CATALOG,
  BLOCK_SCHEMA_VERSION,
  MAX_BLOCKS_PER_COLUMN,
  MAX_CARDS,
  MAX_COLUMNS,
  MAX_GALLERY_ITEMS,
  MAX_JOB_ITEMS,
  MAX_ROSTER_MEMBERS,
  MAX_TABLE_COLUMNS,
  MAX_TABLE_ROWS,
  countBlocks,
  isRowBlock,
  layoutOf,
  walkBlocks,
  type Block,
  type BlockColumnWidth,
  type BlockDocument,
  type BlockLocation,
  type BlockType,
  type PageLayout,
} from "@/lib/blocks/types";
import { documentErrorsOf, documentWarningsOf, missingEnglishCount, validateDocument } from "@/lib/blocks/validate";
import { fillTemplate } from "@/lib/i18n/template";
import { TemplateCoverageNote, type TemplateCoverage } from "@/features/admin/ui/template-coverage-note";
import type { Messages } from "@/lib/i18n/messages/th";

/**
 * หน้าจอสร้างหน้าเว็บ (บล็อกอิสระ) — Client Component
 *
 * 3 คอลัมน์: เลเยอร์ (ซ้าย) · พรีวิว 1:1 (กลาง) · ตั้งค่าบล็อก (ขวา)
 * - พรีวิวใช้ `BlockDocumentView` ตัวเดียวกับหน้าเว็บจริง ⇒ สิ่งที่เห็น = สิ่งที่จะได้ (ไม่ใช่ภาพจำลอง)
 * - ตรวจเนื้อหาแบบสด ๆ ด้วย validator ตัวเดียวกับที่ใช้ตอนบันทึก (error หยุด · warning เตือน)
 * - ทุกปุ่มที่ไม่ใช่ "บันทึก/เผยแพร่" ต้อง `type="button"` ไม่งั้นจะกลายเป็นปุ่มส่งฟอร์ม
 */

type Revision = {
  readonly revision: number;
  readonly note: string | null;
  readonly createdAt: string;
  readonly createdBy: string | null;
  readonly blockCount: number;
};

type PreviewMode = "draft" | "published" | "live";

type Props = {
  readonly page: string;
  /**
   * ที่อยู่ของหน้าเว็บจริงของหน้านี้ (ใช้ในโหมดพรีวิว "หน้าเว็บจริง")
   * S2 (รอบที่ 82): เดิมตรึงเป็น `/th` ⇒ พรีวิวโหมดนี้แสดง "หน้าแรก" เสมอ แม้แก้หน้าอื่นอยู่
   *
   * ⚠️ **ไม่บังคับ** (บทเรียนเดิม: prop บังคับเคยทำให้ build พังเมื่อมีหน้าจอลืมส่ง)
   *    ถ้าไม่ส่ง = ใช้ `/th` (หน้าแรก) เป็นค่าถอย ⇒ หน้าจอใหม่ยังเปิดได้ ไม่ล้มทั้ง build
   *    · หน้าจอที่อยากได้พรีวิวถูกหน้า **ควรส่งค่ามา** (`previewLiveSrc={localePath("th", pathForPage(page))}`)
   */
  readonly previewLiveSrc?: string;
  /**
   * หน้าเว็บสาธารณะกำลังใช้เนื้อหาชุดนี้อยู่หรือไม่ (เซสชัน S1)
   * - **ไม่บังคับ** เพื่อกันกรณีหน้าจอใดลืมส่งค่า (เคยเกิด error ตอน build: "Property 'isLive' is missing")
   * - ถ้าไม่ส่งมา = **ไม่แสดงสวิตช์นี้เลย** (ดีกว่าแสดงผิดว่า "ยังไม่ใช้กับหน้าเว็บจริง" ทั้งที่ใช้อยู่)
   */
  readonly isLive?: boolean;
  /**
   * คำเตือน "ส่วนที่เทมเพลตไม่ครอบคลุม" (S2 รอบที่ 83) — ข้อความแปลแล้วจากฝั่งเซิร์ฟเวอร์
   * ⚠️ **ไม่บังคับ** (prop บังคับเคยทำให้ build พัง) — ไม่ส่ง = ไม่แสดงคำเตือน
   */
  readonly coverage?: TemplateCoverage;
  /** เนื้อหาเพิ่มเติมในแผงขวา (ใช้เสียบ "ป้ายประกาศเข้าเว็บ" ให้แก้ได้จากหน้านี้เลย) */
  /** ตัวแก้ "แถบเมนู (navbar)" — ส่วนกลางของเว็บ (ผู้ใช้สั่ง รอบที่ 53) */
  /** พรีเซ็ตที่บันทึกไว้ (โหลดจากฐานข้อมูลที่หน้าจอ server) */
  readonly presets?: readonly BlockPreset[];
  readonly initialDraft: BlockDocument;
  readonly draftUpdatedAt: string | null;
  readonly publishedAt: string | null;
  readonly revisions: readonly Revision[];
  /**
   * รุ่นรูปทรงของ "ข้อมูลที่เก็บไว้" ในฐานข้อมูล (X1.1)
   * ใช้เตือน + เปิดปุ่ม "ย้ายเป็นรุ่นปัจจุบัน" · ไม่บังคับ เพื่อกันหน้าจออื่นที่ยังไม่ส่งค่า
   */
  readonly storedVersions?: {
    readonly draft: StoredVersionSummary | null;
    readonly published: StoredVersionSummary | null;
  };
  readonly strings: Messages["admin"];
};

/**
 * ขนาดจริงของพรีวิว (พิกเซล) + ย่อด้วย CSS transform ให้พอดีช่อง
 *
 * ⚠️ บทเรียน 2026-10-02: เดิมตั้งความกว้าง iframe เป็น `w-full` ตามช่องในหลังบ้าน (~650px)
 * ⇒ **เว็บจริงเข้าเลย์เอาต์แท็บเล็ต** เพราะ viewport ของ iframe แคบจริง (ไม่ใช่แค่ "ดูเล็ก")
 * ⇒ ต้องเรนเดอร์ iframe ที่ความกว้างจริงของจอ แล้วย่อทั้งภาพด้วย `scale()` (เหมือนซูมออกในเบราว์เซอร์)
 *    ภาพที่ได้จึงเป็น "เลย์เอาต์จอใหญ่จริง" แค่ย่อส่วน · และมีปุ่มเต็มหน้าจอให้ดูขนาด 100%
 */
/**
 * ลากการ์ดในบล็อกการ์ด — ชนิดข้อมูลที่ส่งผ่าน `dataTransfer`
 * ⚠️ บทเรียน: **ต้องเรียก `dataTransfer.setData()` ใน `dragstart`** ไม่งั้น Firefox จะไม่เริ่มลากเลย
 *    และอ่านค่าตอน `drop` จาก `dataTransfer` เอง ⇒ ไม่ต้องใช้ ref (กันลำดับ `dragend` มาก่อน `drop` ด้วย)
 * (ลาก "บล็อก" ย้ายไปอยู่ใน `block-layer-list.tsx` แล้ว เพราะการวางต้องเลือกภาชนะได้ด้วย)
 */
const DRAG_CARD_MIME = "application/x-waiwai-card";

const PREVIEW_SIZES = [
  { key: "wide", width: 1920, height: 1080, labelKey: "widthWide" },
  { key: "desktop", width: 1440, height: 900, labelKey: "widthDesktop" },
  { key: "tablet", width: 834, height: 1112, labelKey: "widthTablet" },
  { key: "mobile", width: 390, height: 844, labelKey: "widthMobile" },
] as const;

type PreviewSizeKey = (typeof PREVIEW_SIZES)[number]["key"];

function issueLabel(strings: Messages["admin"], code: string): string {
  const labels = strings.issueLabels as Readonly<Record<string, string>>;
  return labels[code] ?? code;
}

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
  active = false,
}: {
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
  /** true = ตัวเลือกที่กำลังใช้อยู่ (ตีกรอบแดง) */
  readonly active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`focus-visible:ring-ring rounded-lg border px-2 py-1 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? "border-brand-red bg-surface-raised text-fg" : "border-line text-fg hover:bg-surface-raised"
      }`}
    >
      {label}
    </button>
  );
}

function TextPair({
  label,
  value,
  onChange,
  multiline = false,
  idBase,
  highlight = false,
}: {
  readonly label: string;
  readonly value: { th: string; en: string };
  readonly onChange: (language: "th" | "en", next: string) => void;
  readonly multiline?: boolean;
  readonly idBase: string;
  /** true = เพิ่งถูกคลิกจากพรีวิว → ตีกรอบให้เห็นว่ากำลังแก้ช่องนี้ */
  readonly highlight?: boolean;
}) {
  const fieldClass = `border-line bg-surface text-fg focus-visible:ring-ring w-full rounded-lg border px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none ${
    highlight ? "ring-brand-red ring-2" : ""
  }`;

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-fg text-sm font-medium">{label}</p>
      <div className="grid gap-1.5">
        <label htmlFor={`${idBase}-th`} className="text-fg-muted text-xs">
          TH
        </label>
        {multiline ? (
          <textarea id={`${idBase}-th`} rows={3} value={value.th} onChange={(event) => onChange("th", event.target.value)} className={fieldClass} />
        ) : (
          <input id={`${idBase}-th`} type="text" value={value.th} onChange={(event) => onChange("th", event.target.value)} className={fieldClass} />
        )}
        <label htmlFor={`${idBase}-en`} className="text-fg-muted text-xs">
          EN
        </label>
        {multiline ? (
          <textarea id={`${idBase}-en`} rows={3} value={value.en} onChange={(event) => onChange("en", event.target.value)} className={fieldClass} />
        ) : (
          <input id={`${idBase}-en`} type="text" value={value.en} onChange={(event) => onChange("en", event.target.value)} className={fieldClass} />
        )}
      </div>
    </div>
  );
}

function SingleField({
  label,
  value,
  onChange,
  idBase,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly idBase: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={idBase} className="text-fg-muted text-xs">
        {label}
      </label>
      <input
        id={idBase}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border-line bg-surface text-fg focus-visible:ring-ring w-full rounded-lg border px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  idBase,
}: {
  readonly label: string;
  readonly value: string | number;
  readonly options: readonly { readonly value: string | number; readonly label: string }[];
  readonly onChange: (next: string) => void;
  readonly idBase: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={idBase} className="text-fg-muted text-xs">
        {label}
      </label>
      <select
        id={idBase}
        value={String(value)}
        onChange={(event) => onChange(event.target.value)}
        className="border-line bg-surface text-fg focus-visible:ring-ring w-full rounded-lg border px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
      >
        {options.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function StatusPanel({ state, strings }: { readonly state: BuilderState; readonly strings: Messages["admin"] }) {
  if (state.status === "idle") return null;

  const failed = state.status === "invalid" || state.status === "failed";
  const migratedDraft = state.migrated?.draft ?? 0;
  const migratedPublished = state.migrated?.published ?? 0;
  const message =
    state.status === "draft-saved"
      ? strings.savedDraft
      : state.status === "published"
        ? fillTemplate(strings.publishedOk, { revision: state.revision ?? 1 })
        : state.status === "restored"
          ? strings.restoredOk
          : state.status === "migrated"
            ? migratedDraft + migratedPublished === 0
              ? strings.migratedNone
              : fillTemplate(strings.migratedOk, { draft: migratedDraft, published: migratedPublished })
            : state.status === "invalid"
              ? strings.errorTitle
              : strings.dbMissingShort;

  /* ผลการทำให้หน้าเว็บสดใหม่หลังเผยแพร่ (S1 เดิม + X1.7) — บอกตรง ๆ ว่าเกิดอะไรขึ้นหลังกดเผยแพร่ */
  const rebuildMessage =
    state.rebuild === undefined
      ? null
      : state.rebuild === "isr"
        ? strings.rebuildIsr
        : state.rebuild === "hook-triggered"
          ? strings.rebuildHook
          : state.rebuild === "command-ok"
            ? strings.rebuildCommand
            : state.rebuild === "manual"
              ? strings.rebuildManual
              : `${strings.rebuildFailed}${state.rebuildDetail === null || state.rebuildDetail === undefined ? "" : ` · ${state.rebuildDetail}`}`;

  return (
    <section
      role="status"
      className={`flex flex-col gap-1 rounded-xl border p-3 text-sm ${failed ? "border-brand-red bg-surface" : "border-line bg-surface-raised"}`}
    >
      <p className="text-fg font-semibold">{message}</p>
      {/* กู้คืนแล้วหน้าจอถูกแทนด้วยรุ่นที่กู้คืน (X1.5) — บอกให้ชัดเพื่อไม่ให้สับสนว่า "กดแล้วทำไมไม่เปลี่ยน" */}
      {state.status === "restored" ? <p className="text-fg-muted text-xs">{strings.draftRestoredApplied}</p> : null}
      {rebuildMessage === null ? null : (
        <p className={`text-xs ${state.rebuild === "failed" ? "text-fg font-semibold" : "text-fg-muted"}`}>{rebuildMessage}</p>
      )}
      {state.problems.length > 0 ? (
        <ul className="text-fg-muted list-disc pl-5 text-xs">
          {state.problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      ) : null}
      {state.errors.length > 0 ? (
        <ul className="text-fg-muted list-disc pl-5 text-xs">
          {state.errors.slice(0, 20).map((issue) => (
            <li key={`${issue.code}-${issue.path}`}>
              {issueLabel(strings, issue.code)} · <span className="font-mono">{issue.path}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function BlockBuilder({
  page,
  previewLiveSrc,
  isLive,
  coverage,
  presets = [],
  initialDraft,
  draftUpdatedAt,
  publishedAt,
  revisions,
  storedVersions,
  strings,
}: Props) {
  const [document, setDocument] = useState<BlockDocument>(initialDraft);
  const [selectedId, setSelectedId] = useState<string>(initialDraft.blocks[0]?.id ?? "");
  /** การ์ดที่กำลังแก้ (ลำดับในบล็อก) — null = ดูภาพรวมของบล็อก */
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  /** ช่องที่เพิ่งถูกคลิกจากพรีวิว → โฟกัสให้ทันที (ผู้ใช้ไม่ต้องหาเอง) */
  const [focusTarget, setFocusTarget] = useState<{ readonly id: string; readonly key: number } | null>(null);
  const [previewWidth, setPreviewWidth] = useState<PreviewSizeKey>("desktop");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("draft");
  /** เต็มหน้าจอ = ดูพรีวิวขนาดจริง 100% (ไม่ถูกบีบจากช่องในหลังบ้าน) */
  const [fullscreen, setFullscreen] = useState(false);
  /** ขนาดช่องพรีวิวจริง (วัดจาก DOM) → ใช้คำนวณสเกลย่อ */
  const [paneSize, setPaneSize] = useState<{ readonly width: number; readonly height: number }>({ width: 960, height: 720 });
  const [frameKey, setFrameKey] = useState(0);
  const [newBlockType, setNewBlockType] = useState<BlockType>("richText");
  /** ที่วางของบล็อกใหม่ (X1.1): "root" = ต่อท้ายหน้า · "<rowId>:<columnId>" = ต่อท้ายคอลัมน์นั้น */
  const [addTarget, setAddTarget] = useState<string>("root");
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const paneRef = useRef<HTMLDivElement | null>(null);
  const noticePanelRef = useRef<HTMLDivElement | null>(null);
  /* ลาก-วางสลับตำแหน่ง "การ์ด" ในบล็อกการ์ด (L1) — การลาก "บล็อก" อยู่ใน block-layer-list.tsx */
  const [dragCardIndex, setDragCardIndex] = useState<number | null>(null);
  /**
   * ค่าตั้งแถบเมนูที่กำลังแก้ในแผงขวา (ยังไม่บันทึก) — ส่งต่อเข้า iframe ให้พรีวิวเปลี่ยนทันที
   * `sent = false` = ยังไม่เคยได้ค่าจากหน้าจอแก้ ⇒ ไม่ส่ง (ไม่งั้นจะไปทับหัวเว็บด้วยค่าว่าง)
   */
  const [liveNavbar, setLiveNavbar] = useState<{ readonly sent: boolean; readonly value: unknown }>({ sent: false, value: null });

  const dropTargetRef = useRef<{ readonly blockId: string; readonly cardIndex: number | null } | null>(null);

  /*
    ── บันทึกอัตโนมัติ + งานที่ยังไม่บันทึก (X1.5) ─────────────────────────────
    `savedDocument` = สิ่งที่อยู่ในฐานข้อมูลล่าสุด · เอกสารบนหน้าจอ (`document`) คือสิ่งที่ผู้ใช้เห็น
    ⇒ "ยังไม่บันทึก" = diff ระหว่างสองตัวนี้ (ไม่ใช่ธงที่ตั้งมือ ซึ่งเพี้ยนได้ง่าย)
  */
  const [savedDocument, setSavedDocument] = useState<BlockDocument>(initialDraft);
  const [autosaveEnabled, setAutosaveEnabled] = useState(true);
  const [autosave, setAutosave] = useState<{ readonly status: "idle" | "saving" | "saved" | "failed"; readonly at: string | null }>({
    status: "idle",
    at: null,
  });
  /**
   * ผลการเทียบที่ผู้ใช้ "ปิด" แล้ว — เก็บเป็นค่า ไม่ใช่ธงเปิด/ปิด
   * ⇒ เปิด/ปิดคำนวณจากการเรนเดอร์ (ไม่ต้อง setState ใน effect ซึ่ง lint ห้ามและทำให้เรนเดอร์ซ้อน)
   */
  const [closedCompare, setClosedCompare] = useState<BuilderState | null>(null);
  /** เอกสารที่ "ส่งไปบันทึก" ตอนกดปุ่มเอง — ใช้เป็นค่าที่บันทึกจริงเมื่อ action ตอบกลับ */
  const pendingSaveRef = useRef<BlockDocument | null>(null);
  const savingRef = useRef(false);

  const [draftState, draftAction] = useActionState(saveDraftAction, INITIAL_BUILDER_STATE);
  const [publishState, publishActionState] = useActionState(publishAction, INITIAL_BUILDER_STATE);
  const [restoreState, restoreAction] = useActionState(restoreRevisionAction, INITIAL_BUILDER_STATE);
  const [migrateState, migrateAction] = useActionState(migrateBlocksAction, INITIAL_BUILDER_STATE);
  const [compareState, compareAction] = useActionState(compareRevisionAction, INITIAL_BUILDER_STATE);
  const [uploadState, uploadAction] = useActionState(uploadImageAction, INITIAL_UPLOAD_STATE);

  /* พรีวิวโหลดจาก "เส้นทางฝั่งเว็บจริง" จึงได้หัวเว็บ/ท้ายเว็บ/ฟอนต์/ธีม เหมือนหน้าจริง */
  const previewSrc =
    previewMode === "live" ? (previewLiveSrc ?? "/th") : `/th/preview/${page}?mode=${previewMode}`;

  /** ส่งฉบับร่างที่กำลังแก้เข้าพรีวิวทันที (ยังไม่ต้องบันทึก) */
  const postToFrame = useCallback(() => {
    const target = frameRef.current?.contentWindow;
    if (target === null || target === undefined) return;
    target.postMessage(
      { type: PREVIEW_MESSAGE, document, selectedId },
      window.location.origin,
    );
  }, [document, selectedId]);

  /* หน่วง 250ms กันการส่งถี่เกินไปตอนพิมพ์รัว ๆ */
  useEffect(() => {
    if (previewMode !== "draft") return undefined;
    const timer = window.setTimeout(postToFrame, 250);
    return () => window.clearTimeout(timer);
  }, [postToFrame, previewMode, frameKey]);

  /* คลิกในพรีวิว → เลือก "ส่วน/บล็อก/การ์ด" ที่คลิก และโฟกัสช่องแก้ที่ตรงกันทันที */
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data: unknown = event.data;
      if (typeof data !== "object" || data === null) return;
      const candidate = data as { type?: unknown; blockId?: unknown; field?: unknown; cardIndex?: unknown };
      /* ค่าตั้ง navbar สด ๆ จากแผงขวา (ยังไม่บันทึก) → เก็บไว้ส่งต่อเข้า iframe */
      if (candidate.type === NAVBAR_MESSAGE) {
        setLiveNavbar({ sent: true, value: (data as { config?: unknown }).config ?? null });
        return;
      }

      if (candidate.type !== SELECT_MESSAGE) return;
      if (typeof candidate.blockId !== "string" || candidate.blockId === "") return;

      /* คลิกถูกป้ายประกาศ → โฟกัสเมนูป้ายในแผงขวา (ไม่ใช่การเลือกบล็อก) */
      /* คลิกที่หัวเว็บ/ป้ายประกาศในพรีวิว = ไม่มีอะไรต้องเลือกในหน้านี้ (ย้ายไปหน้าจอ "ส่วนกลางของเว็บ") */
      if (candidate.blockId === NAVBAR_SELECT_ID || candidate.blockId === NOTICE_SELECT_ID) return;

      setSelectedId(candidate.blockId);
      const cardIndex = typeof candidate.cardIndex === "number" ? candidate.cardIndex : null;
      setSelectedCard(cardIndex);

      /* คลิกที่ภาพ → เลื่อนไปที่ช่องภาพ (ไม่มีช่องข้อความให้โฟกัส) */
      if (typeof candidate.field !== "string" || candidate.field === "image") return;

      const id =
        cardIndex === null
          ? `insp-${candidate.blockId}-${candidate.field}-th`
          : `insp-${candidate.blockId}-card-${cardIndex}-${candidate.field}-th`;
      setFocusTarget({ id, key: Date.now() });
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  /* โฟกัส + เลื่อนไปยังช่องที่เพิ่งคลิกในพรีวิว (ให้พิมพ์ต่อได้เลย ไม่ต้องหาเอง) */
  useEffect(() => {
    if (focusTarget === null) return undefined;
    const element = window.document.getElementById(focusTarget.id);
    if (element === null) return undefined;
    element.scrollIntoView({ block: "center", behavior: "smooth" });
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) element.focus();
    const timer = window.setTimeout(() => setFocusTarget(null), 2500);
    return () => window.clearTimeout(timer);
  }, [focusTarget]);

  /* ลากภาพไปวางบนภาพในพรีวิว → อัปโหลด แล้วเปลี่ยนภาพของส่วนนั้นให้เลย */
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data: unknown = event.data;
      if (typeof data !== "object" || data === null) return;
      const candidate = data as { type?: unknown; blockId?: unknown; cardIndex?: unknown; file?: unknown };
      if (candidate.type !== DROP_IMAGE_MESSAGE) return;
      if (typeof candidate.blockId !== "string" || candidate.blockId === "") return;
      if (!(candidate.file instanceof File)) return;

      const target = {
        blockId: candidate.blockId,
        cardIndex: typeof candidate.cardIndex === "number" ? candidate.cardIndex : null,
      };
      dropTargetRef.current = target;
      setSelectedId(target.blockId);
      setSelectedCard(target.cardIndex);

      const body = new FormData();
      body.append("file", candidate.file);
      uploadAction(body);
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [uploadAction]);

  /* อัปโหลดจากการลากวางบนพรีวิวสำเร็จ → ตั้งภาพให้ส่วนที่เป็นเป้า */
  useEffect(() => {
    const target = dropTargetRef.current;
    if (target === null) return;
    if (uploadState.status !== "ok" || uploadState.path === null) return;

    dropTargetRef.current = null;
    const path = uploadState.path;
    const altTh = (uploadState.filename ?? "").replace(/\.[a-z0-9]+$/i, "");

    setDocument((current) =>
      target.cardIndex === null
        ? setBlockImage(current, target.blockId, { path, altTh, altEn: "" })
        : setCardImage(current, target.blockId, target.cardIndex, { path, altTh, altEn: "" }),
    );
  }, [uploadState.status, uploadState.path, uploadState.filename]);

  const payload = JSON.stringify(document);
  const issues = validateDocument(document);
  const errors = documentErrorsOf(issues);
  const warnings = documentWarningsOf(issues);
  const selected = walkBlocks(document.blocks).find((node) => node.block.id === selectedId)?.block ?? null;
  /* สรุป "รุ่นข้อมูลที่เก็บไว้" (X1.1) — นับรวมฉบับร่าง + ฉบับเผยแพร่ */
  const legacyStoredBlocks = (storedVersions?.draft?.legacy ?? 0) + (storedVersions?.published?.legacy ?? 0);
  const storedVersionKeys = new Set([
    ...Object.keys(storedVersions?.draft?.versionCounts ?? {}),
    ...Object.keys(storedVersions?.published?.versionCounts ?? {}),
  ]);
  const legacyVersions = [...storedVersionKeys]
    .map((key) => Number.parseInt(key, 10))
    .filter((version) => Number.isInteger(version) && version < BLOCK_SCHEMA_VERSION);
  const legacyStoredVersion = legacyVersions.length === 0 ? BLOCK_SCHEMA_VERSION : Math.min(...legacyVersions);

  /* ── งานที่ยังไม่บันทึก + นโยบายบันทึกอัตโนมัติ (X1.5) — นับจาก diff จริง ไม่ใช่ธงที่ตั้งมือ ── */
  const unsavedDiff = useMemo(() => documentDiff(savedDocument, document), [savedDocument, document]);
  const unsavedCount = unsavedDiff.summary.total;
  const dirty = unsavedCount > 0;
  const autosaveDecision = decideAutosave({
    enabled: autosaveEnabled,
    dirty,
    errorCount: errors.length,
    saving: autosave.status === "saving",
  });

  /**
   * บันทึกฉบับร่างอัตโนมัติ — เรียก **Server Action ตัวเดียวกับปุ่มบันทึก** (ไม่มีทางพิเศษที่สอง)
   * ⇒ สิ่งที่บันทึกอัตโนมัติผ่านการตรวจสิทธิ์/parse/validate ชุดเดียวกันทุกประการ
   */
  const runAutosave = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setAutosave({ status: "saving", at: null });

    const snapshot = document;
    const body = new FormData();
    body.append("page", page);
    body.append("payload", JSON.stringify(snapshot));

    try {
      const result = await saveDraftAction(INITIAL_BUILDER_STATE, body);
      if (result.status === "draft-saved") {
        setSavedDocument(snapshot);
        setAutosave({ status: "saved", at: new Date().toISOString() });
      } else {
        setAutosave({ status: "failed", at: null });
      }
    } catch {
      setAutosave({ status: "failed", at: null });
    } finally {
      savingRef.current = false;
    }
  }, [document, page]);

  useEffect(() => {
    if (autosaveDecision !== "schedule") return undefined;
    const timer = window.setTimeout(() => {
      void runAutosave();
    }, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [autosaveDecision, runAutosave]);

  /**
   * ซิงก์ "ฉบับที่บันทึกแล้ว" กับสิ่งที่เซิร์ฟเวอร์ทำจริง
   * - บันทึกเอง/เผยแพร่สำเร็จ ⇒ ใช้เอกสารที่ส่งไปตอนนั้น (ผู้ใช้อาจพิมพ์ต่อระหว่างรอ)
   * - กู้คืนสำเร็จ ⇒ เปลี่ยนเอกสารบนหน้าจอเป็นรุ่นที่กู้คืนทันที
   *   ⚠️ ถ้าไม่ทำ บันทึกอัตโนมัติจะเขียนของเก่าทับรุ่นที่เพิ่งกู้คืน (งานหายเงียบ ๆ)
   */
  useEffect(() => {
    if (draftState.status === "draft-saved" || publishState.status === "published") {
      const submitted = pendingSaveRef.current;
      if (submitted !== null) {
        setSavedDocument(submitted);
        pendingSaveRef.current = null;
      }
      return;
    }

    if (restoreState.status !== "restored") return;
    const restored = restoreState.restoredDocument ?? null;
    if (restored === null) return;

    setDocument(restored);
    setSavedDocument(restored);
    setSelectedId(restored.blocks[0]?.id ?? "");
    setSelectedCard(null);
  }, [draftState.status, publishState.status, restoreState.status, restoreState.restoredDocument]);

  /** เตือนก่อนออกจากหน้าเมื่อมีงานที่ยังไม่บันทึก (ปิดแท็บ + คลิกลิงก์ในเว็บ) */
  useEffect(() => {
    if (!needsLeaveWarning(dirty)) return undefined;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest("a");
      if (anchor === null || anchor === undefined) return;
      const href = anchor.getAttribute("href") ?? "";
      if (href === "" || href.startsWith("#") || anchor.getAttribute("target") === "_blank") return;

      if (!window.confirm(fillTemplate(strings.draftWarnLeave, { count: unsavedCount }))) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    window.document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.document.removeEventListener("click", onClick, true);
    };
  }, [dirty, unsavedCount, strings.draftWarnLeave]);
  /* ── คำนวณขนาด/สเกลของพรีวิว (ห้ามให้ iframe แคบกว่าขนาดจริง ไม่งั้นเว็บเข้าสู่เลย์เอาต์มือถือ/แท็บเล็ต) ── */
  const previewSize = PREVIEW_SIZES.find((entry) => entry.key === previewWidth) ?? PREVIEW_SIZES[1];
  const scale = Math.min(1, paneSize.width / previewSize.width);
  const scaledWidth = Math.round(previewSize.width * scale);
  const scaledHeight = Math.round(previewSize.height * scale);
  const scalePercent = Math.round(scale * 100);

  /**
   * วัดขนาดช่องพรีวิวจริง (ใช้คำนวณ "สเกลย่อ" เท่านั้น)
   *
   * ⚠️ บทเรียน รอบที่ 39: ห้ามวัดขนาดแล้วเอาค่าไปตั้งความสูงของ iframe ที่อยู่ในช่องเดียวกัน
   *    (วัด → ตั้ง → วัด วนกันไม่จบ = overflow ลากยาวไม่สิ้นสุด ตามที่ผู้ใช้รายงาน)
   *    ⇒ โหมดเต็มหน้าจอใช้ CSS `100%` และ **ไม่วัดเลย** · โหมดปกติวัดเฉพาะความกว้าง + ข้ามการอัปเดตถ้าค่าไม่เปลี่ยน
   */
  useEffect(() => {
    if (fullscreen) return undefined;

    const pane = paneRef.current;
    if (pane === null) return undefined;

    const update = () =>
      setPaneSize((previous) => {
        const width = pane.clientWidth;
        const height = pane.clientHeight;
        if (previous.width === width && previous.height === height) return previous;
        return { width, height };
      });

    update();

    const observer = new ResizeObserver(update);
    observer.observe(pane);
    return () => observer.disconnect();
  }, [fullscreen]);

  /* ส่งค่าตั้ง navbar ที่กำลังแก้เข้า iframe → พรีวิวเปลี่ยนทันที (hot reload) */
  useEffect(() => {
    if (!liveNavbar.sent) return;
    const target = frameRef.current?.contentWindow;
    if (target === null || target === undefined) return;
    target.postMessage({ type: NAVBAR_MESSAGE, config: liveNavbar.value }, window.location.origin);
  }, [liveNavbar, frameKey, previewMode]);

  /* คลิกถูกป้ายประกาศในพรีวิว → เลื่อนแผงขวาไปที่เมนูป้ายให้เห็นทันที */
  useEffect(() => {
    noticePanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  /* กด Esc ออกจากโหมดเต็มหน้าจอ */
  useEffect(() => {
    if (!fullscreen) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  function update(next: BlockDocument) {
    setDocument(next);
  }

  function renderInspector(block: Block) {
    const base = `insp-${block.id}`;

    /*
      แสดง/ซ่อนตามขนาดจอ (X1.6) — 3 ปุ่มสวิตช์
      ⚠️ ไม่ให้ปิดครบทั้ง 3 (จะทำให้บล็อกหายทั้งหมด) — สวิตช์สุดท้ายที่เหลือจะกดไม่ได้
    */
    const visibility = block.visibility ?? { desktop: true, tablet: true, mobile: true };
    const visibleCount = [visibility.desktop, visibility.tablet, visibility.mobile].filter(Boolean).length;
    const visibilitySection = (
      <fieldset className="border-line flex flex-col gap-1.5 rounded-lg border p-2">
        <legend className="text-fg-muted px-1 text-xs font-semibold">{strings.showOnTitle}</legend>
        <div className="flex flex-wrap gap-1.5">
          {([
            { key: "desktop" as const, label: strings.showOnDesktop },
            { key: "tablet" as const, label: strings.showOnTablet },
            { key: "mobile" as const, label: strings.showOnMobile },
          ]).map((entry) => {
            const on = visibility[entry.key];
            return (
              <button
                key={entry.key}
                type="button"
                aria-pressed={on}
                disabled={on && visibleCount === 1}
                onClick={() => update(setBlockVisibility(document, block.id, { [entry.key]: !on }))}
                className={
                  on
                    ? "bg-brand-red text-on-brand rounded-lg px-2 py-1 text-xs font-semibold disabled:opacity-60"
                    : "border-line text-fg hover:bg-surface-raised rounded-lg border px-2 py-1 text-xs font-semibold"
                }
              >
                {entry.label}
              </button>
            );
          })}
        </div>
        <p className="text-fg-muted text-[11px]">{strings.showOnHint}</p>
      </fieldset>
    );

    const styleSection = (
      <div className="grid grid-cols-2 gap-2">
        <SelectField
          idBase={`${base}-align`}
          label={strings.styleLabels.align}
          value={block.style.align}
          options={STYLE_CHOICES.align}
          onChange={(next) => update(setBlockStyle(document, block.id, { align: next as "left" | "center" }))}
        />
        <SelectField
          idBase={`${base}-width`}
          label={strings.styleLabels.width}
          value={block.style.width}
          options={STYLE_CHOICES.width}
          onChange={(next) => update(setBlockStyle(document, block.id, { width: next as "narrow" | "normal" | "wide" | "full" }))}
        />
        <SelectField
          idBase={`${base}-spacing`}
          label={strings.styleLabels.spacing}
          value={block.style.spacing}
          options={STYLE_CHOICES.spacing}
          onChange={(next) => update(setBlockStyle(document, block.id, { spacing: next as "none" | "sm" | "md" | "lg" }))}
        />
        <SelectField
          idBase={`${base}-background`}
          label={strings.styleLabels.background}
          value={block.style.background}
          options={STYLE_CHOICES.background}
          onChange={(next) => update(setBlockStyle(document, block.id, { background: next as "none" | "cream" | "subtle" | "brand" }))}
        />
        <SelectField
          idBase={`${base}-size`}
          label={strings.styleLabels.size}
          value={block.style.size}
          options={STYLE_CHOICES.size}
          onChange={(next) => update(setBlockStyle(document, block.id, { size: next as "sm" | "md" | "lg" }))}
        />
      </div>
    );

    const content = (() => {
      switch (block.type) {
        case "hero":
          return (
            <>
              <TextPair idBase={`${base}-title`} label="title" value={block.title} onChange={(language, next) => update(setBlockText(document, block.id, "title", language, next))} />
              <TextPair idBase={`${base}-subtitle`} label="subtitle" value={block.subtitle} onChange={(language, next) => update(setBlockText(document, block.id, "subtitle", language, next))} multiline />
              <TextPair idBase={`${base}-note`} label={`note (${strings.optionalHint})`} value={block.note} onChange={(language, next) => update(setBlockText(document, block.id, "note", language, next))} />
              <TextPair idBase={`${base}-cta`} label="cta" value={block.ctaLabel} onChange={(language, next) => update(setBlockText(document, block.id, "ctaLabel", language, next))} />
              <SingleField idBase={`${base}-cta-href`} label="cta href" value={block.ctaHref} onChange={(next) => update(setBlockString(document, block.id, "ctaHref", next))} />
              <div id={`${base}-image`}>
                <ImageDrop strings={strings} label={strings.blockImageLabel} value={block.image} onChange={(patch) => update(setBlockImage(document, block.id, patch))} />
              </div>
            </>
          );
        case "heading":
          return (
            <>
              <TextPair idBase={`${base}-text`} label="text" value={block.text} onChange={(language, next) => update(setBlockText(document, block.id, "text", language, next))} />
              <SelectField
                idBase={`${base}-level`}
                label="level"
                value={block.level}
                options={[
                  { value: 2, label: "H2" },
                  { value: 3, label: "H3" },
                ]}
                onChange={(next) => update(setBlockChoice(document, block.id, "level", Number(next)))}
              />
            </>
          );
        case "richText":
          return (
            <>
              <TextPair idBase={`${base}-heading`} label="heading" value={block.heading} onChange={(language, next) => update(setBlockText(document, block.id, "heading", language, next))} />
              <TextPair idBase={`${base}-body`} label="body" value={block.body} onChange={(language, next) => update(setBlockText(document, block.id, "body", language, next))} multiline />
              <TextPair idBase={`${base}-cta`} label={`cta (${strings.optionalHint})`} value={block.ctaLabel} onChange={(language, next) => update(setBlockText(document, block.id, "ctaLabel", language, next))} />
              <SingleField idBase={`${base}-cta-href`} label="cta href" value={block.ctaHref} onChange={(next) => update(setBlockString(document, block.id, "ctaHref", next))} />
            </>
          );
        case "imageText":
          return (
            <>
              <TextPair idBase={`${base}-heading`} label="heading" value={block.heading} onChange={(language, next) => update(setBlockText(document, block.id, "heading", language, next))} />
              <TextPair idBase={`${base}-body`} label="body" value={block.body} onChange={(language, next) => update(setBlockText(document, block.id, "body", language, next))} multiline />
              <SelectField
                idBase={`${base}-side`}
                label="side"
                value={block.side}
                options={[
                  { value: "left", label: "left" },
                  { value: "right", label: "right" },
                ]}
                onChange={(next) => update(setBlockChoice(document, block.id, "side", next))}
              />
              <div id={`${base}-image`}>
                <ImageDrop strings={strings} label={strings.blockImageLabel} value={block.image} onChange={(patch) => update(setBlockImage(document, block.id, patch))} />
              </div>
            </>
          );
        case "cards":
          /* เลือกอยู่ที่การ์ดใบไหน → แก้เฉพาะใบนั้น (ตามที่ผู้ใช้ขอ: "จัดการเฉพาะการ์ดนั้น") */
          if (selectedCard !== null) {
            const card = block.items[selectedCard];
            if (card !== undefined) {
              const cardBase = `${base}-card-${selectedCard}`;
              return (
                <div className="border-brand-red flex flex-col gap-3 rounded-xl border-2 p-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-fg text-sm font-semibold">{fillTemplate(strings.cardNumber, { n: selectedCard + 1 })}</p>
                    <div className="flex flex-wrap gap-1">
                      <TinyButton label="◀" disabled={selectedCard === 0} onClick={() => setSelectedCard(selectedCard - 1)} />
                      <TinyButton
                        label="▶"
                        disabled={selectedCard >= block.items.length - 1}
                        onClick={() => setSelectedCard(selectedCard + 1)}
                      />
                      <TinyButton
                        label={strings.removeCard}
                        onClick={() => {
                          update(removeCard(document, block.id, selectedCard));
                          setSelectedCard(null);
                        }}
                      />
                      <TinyButton label={strings.backToBlock} onClick={() => setSelectedCard(null)} />
                    </div>
                  </div>

                  <TextPair
                    idBase={`${cardBase}-title`}
                    label="title"
                    value={card.title}
                    highlight={focusTarget?.id === `${cardBase}-title-th`}
                    onChange={(language, next) => update(setCardText(document, block.id, selectedCard, "title", language, next))}
                  />
                  <TextPair
                    idBase={`${cardBase}-body`}
                    label="body"
                    value={card.body}
                    highlight={focusTarget?.id === `${cardBase}-body-th`}
                    onChange={(language, next) => update(setCardText(document, block.id, selectedCard, "body", language, next))}
                  />
                  <SingleField
                    idBase={`${cardBase}-href`}
                    label="href"
                    value={card.href}
                    onChange={(next) => update(setCardString(document, block.id, selectedCard, "href", next))}
                  />
                  <div id={`${cardBase}-image`}>
                    <ImageDrop
                      strings={strings}
                      compact
                      label={strings.cardImageLabel}
                      value={card.image}
                      onChange={(patch) => update(setCardImage(document, block.id, selectedCard, patch))}
                    />
                  </div>
                </div>
              );
            }
          }

          return (
            <>
              <TextPair idBase={`${base}-heading`} label="heading" value={block.heading} onChange={(language, next) => update(setBlockText(document, block.id, "heading", language, next))} />
              <TextPair idBase={`${base}-body`} label={`body (${strings.optionalHint})`} value={block.body} onChange={(language, next) => update(setBlockText(document, block.id, "body", language, next))} />
              <SelectField
                idBase={`${base}-columns`}
                label="columns"
                value={block.columns}
                options={[1, 2, 3, 4].map((value) => ({ value, label: String(value) }))}
                onChange={(next) => update(setBlockChoice(document, block.id, "columns", Number(next)))}
              />

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-fg-muted text-xs font-semibold">
                    {strings.cardsLabel} ({block.items.length}/{MAX_CARDS})
                  </p>
                  <TinyButton label={strings.addCard} disabled={!canAddCard(document, block.id)} onClick={() => update(addCard(document, block.id))} />
                </div>

                <ul className="flex flex-wrap gap-1">
                  {block.items.map((_card, index) => (
                    <li
                      key={`${block.id}-pick-${index}`}
                      /* ลาก-วางสลับลำดับการ์ด (L1 — รอบที่ 50) */
                      onDragOver={(event) => {
                        if (!event.dataTransfer.types.includes(DRAG_CARD_MIME)) return;
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(event) => {
                        const payload = event.dataTransfer.getData(DRAG_CARD_MIME);
                        const [owner, fromText] = payload.split(":");
                        /* ลากข้ามบล็อกไม่ได้ (การ์ดอยู่กับบล็อกของมัน) */
                        if (owner !== block.id || fromText === undefined) return;
                        event.preventDefault();
                        update(moveCardTo(document, block.id, Number.parseInt(fromText, 10), index));
                        setSelectedCard(index);
                        setDragCardIndex(null);
                      }}
                      className={`flex items-center gap-0.5 rounded-lg ${dragCardIndex === index ? "opacity-40" : ""}`}
                    >
                      <button
                        type="button"
                        draggable
                        onDragStart={(event) => {
                          setDragCardIndex(index);
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData(DRAG_CARD_MIME, `${block.id}:${index}`);
                        }}
                        onDragEnd={() => setDragCardIndex(null)}
                        aria-label={strings.dragToMove}
                        title={strings.dragToMove}
                        className="text-fg-muted hover:text-fg focus-visible:ring-ring cursor-grab text-xs focus-visible:ring-2 focus-visible:outline-none active:cursor-grabbing"
                      >
                        ⠿
                      </button>
                      <TinyButton label={fillTemplate(strings.cardNumber, { n: index + 1 })} onClick={() => setSelectedCard(index)} />
                    </li>
                  ))}
                </ul>
                <p className="text-fg-muted text-xs">{strings.pickCardHint}</p>
              </div>
            </>
          );
        case "cta":
          return (
            <>
              <TextPair idBase={`${base}-heading`} label="heading" value={block.heading} onChange={(language, next) => update(setBlockText(document, block.id, "heading", language, next))} />
              <TextPair idBase={`${base}-body`} label="body" value={block.body} onChange={(language, next) => update(setBlockText(document, block.id, "body", language, next))} multiline />
              <TextPair idBase={`${base}-label`} label="button" value={block.label} onChange={(language, next) => update(setBlockText(document, block.id, "label", language, next))} />
              <SingleField idBase={`${base}-href`} label="href" value={block.href} onChange={(next) => update(setBlockString(document, block.id, "href", next))} />
              <SelectField
                idBase={`${base}-tone`}
                label="tone"
                value={block.tone}
                options={[
                  { value: "brand", label: "brand" },
                  { value: "neutral", label: "neutral" },
                ]}
                onChange={(next) => update(setBlockChoice(document, block.id, "tone", next))}
              />
            </>
          );
        case "quote":
          return (
            <>
              <TextPair idBase={`${base}-text`} label="text" value={block.text} onChange={(language, next) => update(setBlockText(document, block.id, "text", language, next))} multiline />
              <TextPair idBase={`${base}-attribution`} label={`attribution (${strings.optionalHint})`} value={block.attribution} onChange={(language, next) => update(setBlockText(document, block.id, "attribution", language, next))} />
            </>
          );
        case "divider":
          return <p className="text-fg-muted text-xs">{strings.optionalHint}</p>;

        /* ── ตาราง (รอบที่ 86): หัวคอลัมน์ + แถวข้อมูล — แก้ช่องได้ในแผงนี้เลย ── */
        case "table":
          return (
            <div className="flex flex-col gap-3">
              <TextPair
                idBase={`${base}-heading`}
                label={`heading (${strings.optionalHint})`}
                value={block.heading}
                onChange={(language, next) => update(setBlockText(document, block.id, "heading", language, next))}
              />
              <TextPair
                idBase={`${base}-caption`}
                label={`caption (${strings.optionalHint})`}
                value={block.caption}
                onChange={(language, next) => update(setBlockText(document, block.id, "caption", language, next))}
              />

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-fg-muted text-xs font-semibold">
                    {fillTemplate(strings.blockTableColumns, { n: block.columns.length, max: MAX_TABLE_COLUMNS })}
                  </p>
                  <TinyButton
                    label={strings.blockAddColumn}
                    disabled={!canAddTableColumn(document, block.id)}
                    onClick={() => update(addTableColumn(document, block.id))}
                  />
                </div>

                {block.columns.map((column, index) => (
                  <div key={`col-${index}`} className="border-line flex flex-col gap-1.5 rounded-lg border p-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-fg-muted text-xs font-semibold">{`C${index + 1}`}</p>
                      <TinyButton
                        label={strings.blockRemoveColumn}
                        disabled={!canRemoveTableColumn(document, block.id)}
                        onClick={() => update(removeTableColumn(document, block.id, index))}
                      />
                    </div>
                    <TextPair
                      idBase={`${base}-col-${index}`}
                      label="header"
                      value={column}
                      onChange={(language, next) => update(setTableColumnText(document, block.id, index, language, next))}
                    />
                  </div>
                ))}
              </div>

              <label className="text-fg-muted flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={block.firstColumnHeader}
                  onChange={(event) => update(setTableFirstColumnHeader(document, block.id, event.target.checked))}
                  className="border-line accent-brand-red size-4 rounded border"
                />
                {strings.blockFirstColumnHeader}
              </label>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-fg-muted text-xs font-semibold">
                    {fillTemplate(strings.blockTableRows, { n: block.rows.length, max: MAX_TABLE_ROWS })}
                  </p>
                  <TinyButton
                    label={strings.blockAddRow}
                    disabled={!canAddTableRow(document, block.id)}
                    onClick={() => update(addTableRow(document, block.id))}
                  />
                </div>

                {block.rows.map((row, rowIndex) => (
                  <div key={row.id} className="border-line flex flex-col gap-1.5 rounded-lg border p-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-fg-muted text-xs font-semibold">{`R${rowIndex + 1}`}</p>
                      <TinyButton label={strings.blockRemoveRow} onClick={() => update(removeTableRow(document, block.id, rowIndex))} />
                    </div>
                    {row.cells.map((cell, cellIndex) => (
                      <TextPair
                        key={`cell-${cellIndex}`}
                        idBase={`${base}-r${rowIndex}c${cellIndex}`}
                        label={`C${cellIndex + 1}`}
                        value={cell}
                        onChange={(language, next) => update(setTableCellText(document, block.id, rowIndex, cellIndex, language, next))}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          );

        /* ── แผนที่ (รอบที่ 86): ภาพ + คำบรรยาย + ลิงก์เปิดแผนที่ ── */
        case "map":
          return (
            <>
              <TextPair
                idBase={`${base}-heading`}
                label={`heading (${strings.optionalHint})`}
                value={block.heading}
                onChange={(language, next) => update(setBlockText(document, block.id, "heading", language, next))}
              />
              <TextPair
                idBase={`${base}-caption`}
                label={`caption (${strings.optionalHint})`}
                value={block.caption}
                onChange={(language, next) => update(setBlockText(document, block.id, "caption", language, next))}
              />
              <SingleField
                idBase={`${base}-link-href`}
                label={strings.blockMapLink}
                value={block.linkHref}
                onChange={(next) => update(setBlockString(document, block.id, "linkHref", next))}
              />
              <TextPair
                idBase={`${base}-link-label`}
                label={strings.blockMapLinkText}
                value={block.linkLabel}
                onChange={(language, next) => update(setBlockText(document, block.id, "linkLabel", language, next))}
              />
              <div id={`${base}-image`}>
                <ImageDrop
                  strings={strings}
                  label={strings.blockImageLabel}
                  value={block.image}
                  onChange={(patch) => update(setBlockImage(document, block.id, patch))}
                />
              </div>
            </>
          );

        /* ── ฟอร์ม (รอบที่ 86): เลือกฟอร์มจริงของเว็บที่จะฝัง ── */
        case "form":
          return (
            <>
              <SelectField
                idBase={`${base}-kind`}
                label={strings.blockFormKind}
                value={block.kind}
                options={[
                  { value: "contact", label: strings.blockFormContact },
                  { value: "newsletter", label: strings.blockFormNewsletter },
                  { value: "careers", label: strings.blockFormCareers },
                ]}
                onChange={(next) => update(setBlockChoice(document, block.id, "kind", next))}
              />
              <TextPair
                idBase={`${base}-heading`}
                label={`heading (${strings.optionalHint})`}
                value={block.heading}
                onChange={(language, next) => update(setBlockText(document, block.id, "heading", language, next))}
              />
              <TextPair
                idBase={`${base}-body`}
                label={`body (${strings.optionalHint})`}
                value={block.body}
                onChange={(language, next) => update(setBlockText(document, block.id, "body", language, next))}
              />
              <p className="text-fg-muted text-xs">{strings.blockFormHint}</p>
            </>
          );

        /* ── แกลเลอรี (รอบที่ 86): ชุดภาพ + lightbox ── */
        case "gallery":
          return (
            <div className="flex flex-col gap-3">
              <TextPair
                idBase={`${base}-heading`}
                label={`heading (${strings.optionalHint})`}
                value={block.heading}
                onChange={(language, next) => update(setBlockText(document, block.id, "heading", language, next))}
              />
              <SelectField
                idBase={`${base}-columns`}
                label={strings.blockGalleryColumns}
                value={block.columns}
                options={[2, 3, 4].map((value) => ({ value, label: String(value) }))}
                onChange={(next) => update(setBlockChoice(document, block.id, "columns", Number(next)))}
              />

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-fg-muted text-xs font-semibold">
                    {fillTemplate(strings.blockGalleryItems, { n: block.items.length, max: MAX_GALLERY_ITEMS })}
                  </p>
                  <TinyButton
                    label={strings.blockAddImage}
                    disabled={!canAddGalleryItem(document, block.id)}
                    onClick={() => update(addGalleryItem(document, block.id))}
                  />
                </div>

                {block.items.map((item, index) => (
                  <div key={item.id} className="border-line flex flex-col gap-1.5 rounded-lg border p-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-fg-muted text-xs font-semibold">{fillTemplate(strings.blockItemNumber, { n: index + 1 })}</p>
                      <TinyButton label={strings.blockRemoveImage} onClick={() => update(removeGalleryItem(document, block.id, index))} />
                    </div>
                    <div id={`${base}-img-${index}`}>
                      <ImageDrop
                        strings={strings}
                        compact
                        label={strings.blockImageLabel}
                        value={item.image}
                        onChange={(patch) => update(setGalleryItemImage(document, block.id, index, patch))}
                      />
                    </div>
                    <TextPair
                      idBase={`${base}-cap-${index}`}
                      label={`caption (${strings.optionalHint})`}
                      value={item.caption}
                      onChange={(language, next) => update(setGalleryItemCaption(document, block.id, index, language, next))}
                    />
                  </div>
                ))}
              </div>
            </div>
          );

        /* ── กระดานรับสมัครงาน (รอบที่ 88): ตำแหน่ง + ฝ่าย + อัตรา + คุณสมบัติ ── */
        case "jobBoard":
          return (
            <div className="flex flex-col gap-3">
              <TextPair
                idBase={`${base}-heading`}
                label={`heading (${strings.optionalHint})`}
                value={block.heading}
                onChange={(language, next) => update(setBlockText(document, block.id, "heading", language, next))}
              />
              <TextPair
                idBase={`${base}-body`}
                label={`body (${strings.optionalHint})`}
                value={block.body}
                onChange={(language, next) => update(setBlockText(document, block.id, "body", language, next))}
              />
              <label className="text-fg-muted flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={block.groupByDepartment}
                  onChange={(event) => update(setJobBoardGrouping(document, block.id, event.target.checked))}
                  className="border-line accent-brand-red size-4 rounded border"
                />
                {strings.blockJobGrouping}
              </label>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-fg-muted text-xs font-semibold">
                    {fillTemplate(strings.blockJobItems, { n: block.items.length, max: MAX_JOB_ITEMS })}
                  </p>
                  <TinyButton
                    label={strings.blockAddJob}
                    disabled={!canAddJobItem(document, block.id)}
                    onClick={() => update(addJobItem(document, block.id))}
                  />
                </div>

                {block.items.map((item, index) => (
                  <div key={item.id} className="border-line flex flex-col gap-1.5 rounded-lg border p-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-fg-muted text-xs font-semibold">{fillTemplate(strings.blockJobNumber, { n: index + 1 })}</p>
                      <TinyButton label={strings.blockRemoveJob} onClick={() => update(removeJobItem(document, block.id, index))} />
                    </div>
                    <TextPair
                      idBase={`${base}-job-${index}-title`}
                      label={strings.blockJobTitle}
                      value={item.title}
                      onChange={(language, next) => update(setJobItemText(document, block.id, index, "title", language, next))}
                    />
                    <TextPair
                      idBase={`${base}-job-${index}-dept`}
                      label={strings.blockJobDepartment}
                      value={item.department}
                      onChange={(language, next) => update(setJobItemText(document, block.id, index, "department", language, next))}
                    />
                    <SingleField
                      idBase={`${base}-job-${index}-openings`}
                      label={strings.blockJobOpenings}
                      value={String(item.openings)}
                      onChange={(next) => update(setJobItemOpenings(document, block.id, index, Number(next)))}
                    />
                    <TextPair
                      idBase={`${base}-job-${index}-qual`}
                      label={strings.blockJobQualifications}
                      value={item.qualifications}
                      onChange={(language, next) => update(setJobItemText(document, block.id, index, "qualifications", language, next))}
                    />
                    <TextPair
                      idBase={`${base}-job-${index}-exp`}
                      label={strings.blockJobExperience}
                      value={item.experience}
                      onChange={(language, next) => update(setJobItemText(document, block.id, index, "experience", language, next))}
                    />
                  </div>
                ))}
              </div>
            </div>
          );

        /* ── รายชื่อคณะผู้บริหาร (รอบที่ 88): ชื่อ–ตำแหน่งเป็นข้อความ + ภาพรายบุคคล (ไม่บังคับ) ── */
        case "rosterText":
          return (
            <div className="flex flex-col gap-3">
              <TextPair
                idBase={`${base}-heading`}
                label={`heading (${strings.optionalHint})`}
                value={block.heading}
                onChange={(language, next) => update(setBlockText(document, block.id, "heading", language, next))}
              />
              <TextPair
                idBase={`${base}-body`}
                label={`body (${strings.optionalHint})`}
                value={block.body}
                onChange={(language, next) => update(setBlockText(document, block.id, "body", language, next))}
              />
              <SelectField
                idBase={`${base}-columns`}
                label={strings.blockRosterColumns}
                value={block.columns}
                options={[2, 3, 4].map((value) => ({ value, label: String(value) }))}
                onChange={(next) => update(setRosterColumns(document, block.id, Number(next)))}
              />

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-fg-muted text-xs font-semibold">
                    {fillTemplate(strings.blockRosterMembers, { n: block.members.length, max: MAX_ROSTER_MEMBERS })}
                  </p>
                  <TinyButton
                    label={strings.blockAddMember}
                    disabled={!canAddRosterMember(document, block.id)}
                    onClick={() => update(addRosterMember(document, block.id))}
                  />
                </div>

                {block.members.map((member, index) => (
                  <div key={member.id} className="border-line flex flex-col gap-1.5 rounded-lg border p-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-fg-muted text-xs font-semibold">{fillTemplate(strings.blockMemberNumber, { n: index + 1 })}</p>
                      <TinyButton label={strings.blockRemoveMember} onClick={() => update(removeRosterMember(document, block.id, index))} />
                    </div>
                    <TextPair
                      idBase={`${base}-person-${index}-name`}
                      label={strings.blockMemberName}
                      value={member.name}
                      onChange={(language, next) => update(setRosterMemberText(document, block.id, index, "name", language, next))}
                    />
                    <TextPair
                      idBase={`${base}-person-${index}-role`}
                      label={strings.blockMemberRole}
                      value={member.role}
                      onChange={(language, next) => update(setRosterMemberText(document, block.id, index, "role", language, next))}
                    />
                    <div id={`${base}-person-${index}-image`}>
                      <ImageDrop
                        strings={strings}
                        compact
                        label={strings.blockMemberPhotoHint}
                        value={member.image}
                        onChange={(patch) => update(setRosterMemberImage(document, block.id, index, patch))}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );

        /*
          แถว (คอลัมน์) — X1.1
          ผู้ใช้สั่ง: "กดส่วนไหนให้ส่วนนั้นออกมาปรับแต่ง" ⇒ แผงนี้จัดการเฉพาะ "โครงของแถว"
          (จำนวนคอลัมน์ · ความกว้าง · ลบ) ส่วนข้อความของบล็อกลูกให้เลือกบล็อกนั้นในเลเยอร์แล้วแก้ตามปกติ
        */
        case "row":
          return (
            <div className="flex flex-col gap-2">
              <p className="text-fg text-xs font-semibold">{fillTemplate(strings.rowColumnsCount, { n: block.columns.length })}</p>

              {block.columns.map((column, index) => {
                const removable = canRemoveColumn(document, block.id, column.id);
                return (
                  <div key={column.id} className="border-line flex flex-col gap-1.5 rounded-lg border p-2">
                    <p className="text-fg-muted text-xs font-semibold">{fillTemplate(strings.columnLabel, { n: index + 1 })}</p>
                    <SelectField
                      idBase={`${base}-col-${index}-width`}
                      label={strings.columnWidthLabel}
                      value={column.width}
                      options={STYLE_CHOICES.columnWidth}
                      onChange={(next) => update(setColumnWidth(document, block.id, column.id, next as BlockColumnWidth))}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="text-fg-muted text-[11px]">
                        {column.blocks.length === 0
                          ? strings.columnEmpty
                          : `${fillTemplate(strings.blocksCount, { n: column.blocks.length })} · ${strings.columnHasBlocks}`}
                      </span>
                      <TinyButton label={strings.removeColumn} disabled={!removable} onClick={() => update(removeColumn(document, block.id, column.id))} />
                    </div>
                  </div>
                );
              })}

              <div className="flex flex-wrap items-center gap-2">
                <TinyButton
                  label={strings.addColumn}
                  disabled={block.columns.length >= MAX_COLUMNS}
                  onClick={() => update(addColumn(document, block.id))}
                />
                <p className="text-fg-muted text-[11px]">{strings.rowHint}</p>
              </div>
            </div>
          );

      }
    })();

    return (
      <div className="flex flex-col gap-3">
        {content}
        <hr className="border-line" />
        {visibilitySection}
      {styleSection}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* แถบสถานะ + ปุ่มหลัก */}
      <div className="border-line bg-surface flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3">
        <div className="flex flex-col">
          <p className="text-fg-muted text-xs">{strings.builderIntro}</p>
          <p className="text-fg text-xs">
            {publishedAt === null ? strings.notPublishedYet : fillTemplate(strings.publishedStatus, { time: publishedAt.slice(0, 16).replace("T", " ") })}
            {draftUpdatedAt === null ? "" : ` · ${fillTemplate(strings.draftStatus, { time: draftUpdatedAt.slice(0, 16).replace("T", " ") })}`}
          </p>
          <p className="text-fg text-xs">
            {/* นับรวมบล็อกที่ซ้อนในคอลัมน์ (X1.1) — ตัวเลขเดียวกับที่หน้าจอ/ด่านตรวจใช้ */}
            {fillTemplate(strings.blocksCount, { n: countBlocks(document.blocks) })} ·{" "}
            {errors.length > 0 ? `${strings.errorTitle}: ${errors.length}` : `${strings.warningCount.replace("{count}", String(warnings.length))}`}
            {missingEnglishCount(issues) > 0 ? ` · EN ${missingEnglishCount(issues)}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin" className="text-link focus-visible:ring-ring text-sm font-semibold underline underline-offset-4">
            {strings.builderBack}
          </Link>
        </div>
      </div>

      <StatusPanel state={draftState} strings={strings} />
      {/* สวิตช์ "ใช้กับหน้าเว็บจริง" (เซสชัน S1) — แสดงเฉพาะเมื่อหน้าจอส่งค่ามา (isLive ไม่บังคับ) */}
      {isLive === undefined ? null : (
        <section className="border-line bg-surface flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3">
          <div className="flex flex-col gap-0.5">
            <p className="text-fg text-sm font-semibold">
              {isLive ? strings.liveOn : strings.liveOff}
            </p>
            <p className="text-fg-muted text-xs">{isLive ? strings.liveHintOn : strings.liveHintOff}</p>
          </div>
          {/* คำเตือนก่อนเปิดสวิตช์: เปิดแล้วหน้าเว็บจะแสดงเฉพาะบล็อก (S2 รอบที่ 83) */}
          {coverage === undefined ? null : <TemplateCoverageNote {...coverage} />}

          <form action={setPageLiveAction} className="flex items-center gap-2">
            <input type="hidden" name="page" value={page} />
            <input type="hidden" name="live" value={isLive ? "0" : "1"} />
            <button
              type="submit"
              className="border-line text-fg hover:bg-surface-raised focus-visible:ring-ring rounded-lg border px-2.5 py-1 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none"
            >
              {isLive ? strings.liveTurnOff : strings.liveTurnOn}
            </button>
          </form>
        </section>
      )}

      <StatusPanel state={publishState} strings={strings} />
      <StatusPanel state={restoreState} strings={strings} />
      <StatusPanel state={migrateState} strings={strings} />

      {/*
        การ์ด "รุ่นข้อมูลที่เก็บไว้" (X1.1)
        - ตัวอ่านย้ายรุ่นให้อัตโนมัติทุกครั้ง ⇒ หน้าจอนี้ไม่พังเพราะข้อมูลเก่า
        - แต่ข้อมูลในฐานข้อมูลยังเป็นรุ่นเก่าค้างอยู่ → ให้ผู้ใช้กดย้ายให้สะอาด (มี audit + ไม่แตะประวัติ)
      */}
      {storedVersions === undefined ? null : (
        <section className="border-line bg-surface flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3">
          <div className="flex flex-col gap-0.5">
            <p className="text-fg text-sm font-semibold">{strings.versionTitle}</p>
            <p className="text-fg-muted text-xs">
              {fillTemplate(strings.versionLine, {
                draft: storedVersions.draft === null ? 0 : storedVersions.draft.total,
                published: storedVersions.published === null ? 0 : storedVersions.published.total,
              })}
            </p>
            <p className="text-fg-muted text-xs">
              {legacyStoredBlocks > 0
                ? `${fillTemplate(strings.versionLegacy, {
                    n: legacyStoredBlocks,
                    version: legacyStoredVersion,
                    current: BLOCK_SCHEMA_VERSION,
                  })} · ${strings.versionMigrateHint}`
                : fillTemplate(strings.versionCurrent, { current: BLOCK_SCHEMA_VERSION })}
            </p>
          </div>
          <form action={migrateAction} className="flex items-center gap-2">
            <input type="hidden" name="page" value={page} />
            <button
              type="submit"
              disabled={legacyStoredBlocks === 0}
              className="border-line text-fg hover:bg-surface-raised focus-visible:ring-ring rounded-lg border px-2.5 py-1 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
            >
              {strings.versionMigrate}
            </button>
          </form>
        </section>
      )}

      {/*
        โครงหน้า (ผู้ใช้สั่ง รอบที่ 44): "เมนูที่ใช้ปรับแต่ง … เอามาไว้ข้าง ๆ · กดส่วนไหนให้ส่วนนั้นออกมาปรับแต่ง"
        ⇒ พรีวิวอยู่ซ้าย (กว้างที่สุด) · **แผงปรับแต่งอยู่ขวา** เลื่อนตามได้
        ⇒ และ "หน้า home ปรับแต่งล้น ต้องสกอลข้าง" ⇒ ทุกช่องใส่ `min-w-0` + ให้ข้อความตัดบรรทัด
           (สาเหตุเดิม: ชื่อบล็อกยาวในคอลัมน์แคบ ดันให้เกิดแถบเลื่อนแนวนอนทั้งหน้า)
      */}
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* เลเยอร์ */}
        <section className="border-line bg-surface flex min-w-0 flex-col gap-2 rounded-2xl border p-3 md:col-start-2 md:row-start-2">
          <h2 className="text-fg text-sm font-semibold">{strings.layers}</h2>

          {/* เลย์เอาต์ของหน้า (X1.8) — ตั้งระดับหน้า ไม่ใช่ระดับบล็อก ⇒ อยู่เหนือรายการบล็อก */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="builder-layout" className="text-fg-muted text-xs">
              {strings.layoutLabel}
            </label>
            <select
              id="builder-layout"
              value={layoutOf(document, "th")}
              onChange={(event) => update(setPageLayout(document, event.target.value as PageLayout, "th"))}
              className="border-line bg-surface text-fg focus-visible:ring-ring w-full rounded-lg border px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
            >
              {LAYOUT_CHOICES.map((choice) => (
                <option key={choice.value} value={choice.value}>
                  {choice.label}
                </option>
              ))}
            </select>

            {/* เลย์เอาต์ของหน้าอังกฤษแยกได้ (รอบที่ 92) — ค่าเริ่มต้น = ใช้ค่าเดียวกับไทย */}
            <label htmlFor="builder-layout-en" className="text-fg-muted text-xs">
              {strings.layoutLabelEn}
            </label>
            <select
              id="builder-layout-en"
              value={layoutOf(document, "en")}
              onChange={(event) => update(setPageLayout(document, event.target.value as PageLayout, "en"))}
              className="border-line bg-surface text-fg focus-visible:ring-ring w-full rounded-lg border px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
            >
              {LAYOUT_CHOICES.map((choice) => (
                <option key={choice.value} value={choice.value}>
                  {choice.label}
                </option>
              ))}
            </select>
            <p className="text-fg-muted text-xs">{strings.layoutHint}</p>
          </div>

          {/*
            ⚠️ รอบที่ 56: "แถบเมนู" และ "ป้ายประกาศ" ย้ายไปหน้าจอ "ส่วนกลางของเว็บ" (/admin/builder/chrome)
            หน้าจอนี้เหลือเฉพาะ "เนื้อหาของหน้า" (บล็อก) ตามที่ผู้ใช้สั่ง —
            *"เราควรเห็นแค่ navbar เมื่อเราจัดการ navbar … ไม่ตรงวัตถุประสงค์"*
          */}

          {/* เพิ่มบล็อกใหม่ */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="builder-add-type" className="text-fg-muted text-xs">
              {strings.chooseBlockType}
            </label>
            <div className="flex gap-2">
              <select
                id="builder-add-type"
                value={newBlockType}
                onChange={(event) => setNewBlockType(event.target.value as BlockType)}
                className="border-line bg-surface text-fg focus-visible:ring-ring w-full rounded-lg border px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
              >
                {BLOCK_CATALOG.map((entry) => (
                  <option key={entry.type} value={entry.type}>
                    {entry.label}
                  </option>
                ))}
              </select>
              <TinyButton
                label={strings.addBlockSubmit}
                onClick={() => {
                  /* เพิ่มที่ "ตำแหน่งที่เลือกไว้" ได้ (X1.1) — ต่อท้ายหน้า หรือต่อท้ายคอลัมน์ของแถว */
                  const target =
                    addTarget === "root"
                      ? null
                      : (() => {
                          const [rowId, columnId] = addTarget.split(":");
                          const row = document.blocks.find((block) => block.id === rowId);
                          const column = row !== undefined && isRowBlock(row) ? row.columns.find((entry) => entry.id === columnId) : undefined;
                          return {
                            rowId: rowId ?? null,
                            columnId: columnId ?? null,
                            index: column?.blocks.length ?? MAX_BLOCKS_PER_COLUMN,
                          };
                        })();

                  /* ยิงที่เป้าหมายก่อน · ถ้าเป้าหมายหายไป (คอลัมน์ถูกลบ) ให้ถอยไปวางระดับหน้า — ปุ่มต้องไม่เงียบ */
                  const attempt = insertBlockAt(document, newBlockType, target);
                  const result = target !== null && attempt.blockId === null ? insertBlockAt(document, newBlockType, null) : attempt;
                  update(result.document);
                  if (result.blockId !== null) {
                    setSelectedId(result.blockId);
                    setSelectedCard(null);
                  }
                }}
              />
            </div>
            {/* เลือกที่วาง — จำเป็นเมื่อหน้ามี "แถว" (ไม่งั้นจะเพิ่มได้แค่ระดับหน้า) */}
            <label htmlFor="builder-add-target" className="text-fg-muted text-xs">
              {strings.addTargetLabel}
            </label>
            <select
              id="builder-add-target"
              value={addTarget}
              onChange={(event) => setAddTarget(event.target.value)}
              className="border-line bg-surface text-fg focus-visible:ring-ring w-full rounded-lg border px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
            >
              <option value="root">{strings.addTargetRoot}</option>
              {document.blocks.map((block, rowIndex) =>
                isRowBlock(block)
                  ? block.columns.map((column, columnIndex) => (
                      <option key={`${block.id}:${column.id}`} value={`${block.id}:${column.id}`}>
                        {fillTemplate(strings.addTargetColumn, { row: rowIndex + 1, column: columnIndex + 1 })}
                      </option>
                    ))
                  : null,
              )}
            </select>
            <p className="text-fg-muted text-xs">{BLOCK_CATALOG.find((entry) => entry.type === newBlockType)?.hint ?? ""}</p>
          </div>

          {/* เลเยอร์แบบซ้อนได้ (X1.1) — คอมโพเนนต์แยก เพื่อไม่ให้ไฟล์นี้ยาวเกินจำเป็น */}
          <BlockLayerList
            document={document}
            selectedId={selectedId}
            strings={strings}
            onSelect={(blockId) => {
              setSelectedId(blockId);
              setSelectedCard(null);
            }}
            onMove={(blockId, delta) => update(moveBlock(document, blockId, delta))}
            onDuplicate={(blockId) => update(duplicateBlock(document, blockId))}
            onRemove={(blockId) => {
              update(removeBlock(document, blockId));
              if (blockId === selectedId) setSelectedId("");
            }}
            onMoveTo={(blockId, target: BlockLocation) => update(moveBlockToLocation(document, blockId, target))}
          />
        </section>

        {/* พรีวิวเหมือนหน้าเว็บจริง (โหลดในเปลือกเว็บจริงผ่าน iframe) */}
        {/*
          โหมดเต็มหน้าจอ: ต้องเป็น overlay ที่ **ยึดขนาดตามวิวพอร์ต** (`fixed inset-0 h-dvh overflow-hidden`)
          ⇒ ช่องพรีวิวมีความสูงจำกัดแน่นอน · iframe ใช้ `h-full` ได้โดยไม่เกิดลูปวัดขนาด
          (รอบที่ 39: เติม `h-dvh overflow-hidden` กัน "overflow ลากยาวไม่สิ้นสุด")
        */}
        <section
          className={
            fullscreen
              ? "bg-bg fixed inset-0 z-50 flex h-dvh flex-col gap-2 overflow-hidden p-2 sm:p-3"
              : "border-line bg-surface flex min-w-0 flex-col gap-2 rounded-2xl border p-3 md:col-start-1 md:row-span-3 md:row-start-1"
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-fg text-sm font-semibold">{strings.previewTitle}</h2>
            <div className="flex flex-wrap gap-1">
              <TinyButton
                label={strings.previewModeDraft}
                onClick={() => setPreviewMode("draft")}
                disabled={previewMode === "draft"}
              />
              <TinyButton
                label={strings.previewModePublished}
                onClick={() => setPreviewMode("published")}
                disabled={previewMode === "published"}
              />
              <TinyButton
                label={strings.previewModeLive}
                onClick={() => setPreviewMode("live")}
                disabled={previewMode === "live"}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1">
              {PREVIEW_SIZES.map((entry) => (
                <TinyButton
                  key={entry.key}
                  label={`${strings[entry.labelKey]} ${entry.width}`}
                  active={previewWidth === entry.key}
                  onClick={() => setPreviewWidth(entry.key)}
                  disabled={previewWidth === entry.key}
                />
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <TinyButton
                label={fullscreen ? strings.exitFullscreen : strings.fullscreen}
                onClick={() => setFullscreen((current) => !current)}
                active={fullscreen}
              />
              <TinyButton label={strings.reloadPreview} onClick={() => setFrameKey((current) => current + 1)} />
              <a
                href={previewSrc}
                target="_blank"
                rel="noreferrer"
                className="text-link focus-visible:ring-ring text-xs font-semibold underline underline-offset-4"
              >
                {strings.openInNewTab}
              </a>
            </div>
          </div>

          <p className="text-fg-muted text-xs">
            {previewMode === "live" ? strings.previewLiveNote : strings.previewNote}{" "}
            <span className="font-mono">
              {fullscreen
                ? strings.fullscreenHint
                : fillTemplate(strings.previewSizeHint, {
                    width: previewSize.width,
                    height: previewSize.height,
                    percent: scalePercent,
                  })}
            </span>
          </p>

          {/*
            ช่องพรีวิว
            - ปกติ: iframe เรนเดอร์ที่ "ความกว้างจริงของจอ" แล้วย่อด้วย transform ⇒ เลย์เอาต์จอใหญ่จริง ไม่ใช่แท็บเล็ต
            - เต็มหน้าจอ: ใช้ **CSS 100%** ล้วน ๆ ไม่วัดขนาดด้วย JS
              ⚠️ บทเรียน รอบที่ 39 (ผู้ใช้รายงาน "overflow ลากยาวลงมาแบบ infinity"):
                 เดิมตั้งความสูง iframe = ความสูงช่องที่วัดได้ ⇒ วัด → ตั้ง → วัด วนกันไม่จบ (feedback loop กับ ResizeObserver)
                 แก้โดยไม่คำนวณขนาดในโหมดเต็มหน้าจอเลย ⇒ ลูปเกิดขึ้นไม่ได้เชิงโครงสร้าง
          */}
          <div ref={paneRef} className={`bg-bg-subtle overflow-auto rounded-xl p-2 ${fullscreen ? "min-h-0 flex-1" : ""}`}>
            {fullscreen ? (
              <iframe
                key={`${previewMode}-${frameKey}`}
                ref={frameRef}
                src={previewSrc}
                onLoad={postToFrame}
                title={strings.previewTitle}
                className="bg-bg h-full w-full rounded-lg border-0"
              />
            ) : (
              <div className="mx-auto" style={{ width: `${scaledWidth}px`, height: `${scaledHeight}px` }}>
                <iframe
                  key={`${previewMode}-${frameKey}`}
                  ref={frameRef}
                  src={previewSrc}
                  onLoad={postToFrame}
                  title={strings.previewTitle}
                  style={{
                    width: `${previewSize.width}px`,
                    height: `${previewSize.height}px`,
                    transform: `scale(${scale})`,
                    transformOrigin: "top left",
                  }}
                  className="bg-bg rounded-lg border-0"
                />
              </div>
            )}
          </div>
        </section>

        {/*
          แผงตั้งค่า (ผู้ใช้สั่ง รอบที่ 49): **กดในเลเยอร์ → ตั้งค่าขึ้นที่นี่**
          - เลือก "ป้ายประกาศเข้าเว็บ" ในเลเยอร์ (หรือคลิกป้ายในพรีวิว) ⇒ แผงนี้สลับมาเป็นเมนูป้าย
          - เลือกบล็อก ⇒ แผงนี้เป็นตั้งค่าของบล็อกนั้น
          ⇒ มี "ที่ตั้งค่า" ที่เดียว อ่านง่าย ไม่ต้องไปหาหน้าต่างอื่น
        */}
        <section
          ref={noticePanelRef}
          className="border-line bg-surface flex min-w-0 flex-col gap-3 rounded-2xl border p-3 md:col-start-2 md:row-start-3"
        >
          <h2 className="text-fg text-sm font-semibold">{strings.inspector}</h2>
          {selected === null ? (
            <p className="text-fg-muted text-xs">{strings.inspectorHint}</p>
          ) : (
            <>
              <p className="text-fg-muted text-xs">
                {BLOCK_CATALOG.find((entry) => entry.type === selected.type)?.label ?? selected.type}
              </p>
              {renderInspector(selected)}
            </>
          )}
        </section>
      </div>

      {/* ฟอร์มบันทึก/เผยแพร่ + สถานะงานที่ยังไม่บันทึก (X1.5) */}
      <div className="border-line bg-surface flex flex-wrap items-center gap-3 rounded-2xl border p-3">
        <form
          action={draftAction}
          onSubmit={() => {
            /* จำเอกสารที่ส่งไปจริง — ใช้ตั้ง "ฉบับที่บันทึกแล้ว" เมื่อ action ตอบกลับ (X1.5) */
            pendingSaveRef.current = document;
          }}
        >
          <input type="hidden" name="page" value={page} />
          <input type="hidden" name="payload" value={payload} />
          <SubmitButton label={strings.saveDraft} pendingLabel={strings.savingDraft} tone="outline" />
        </form>

        <form
          action={publishActionState}
          onSubmit={() => {
            pendingSaveRef.current = document;
          }}
        >
          <input type="hidden" name="page" value={page} />
          <input type="hidden" name="payload" value={payload} />
          <SubmitButton label={strings.publish} pendingLabel={strings.publishing} tone="brand" />
        </form>

        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <p className={`text-xs font-semibold ${dirty ? "text-fg" : "text-fg-muted"}`}>
            {dirty ? fillTemplate(strings.draftUnsavedCount, { count: unsavedCount }) : strings.draftAllSaved}
          </p>
          {dirty ? <p className="text-fg-muted text-[11px]">{diffSummaryLine(unsavedDiff, strings)}</p> : null}

          <div className="text-fg-muted flex flex-wrap items-center gap-2 text-[11px]">
            <button
              type="button"
              aria-pressed={autosaveEnabled}
              onClick={() => setAutosaveEnabled((current) => !current)}
              className={
                autosaveEnabled
                  ? "bg-brand-red text-on-brand focus-visible:ring-ring rounded-lg px-2 py-1 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none"
                  : "border-line text-fg hover:bg-surface-raised focus-visible:ring-ring rounded-lg border px-2 py-1 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none"
              }
            >
              {autosaveEnabled ? strings.draftAutosaveOn : strings.draftAutosaveOff}
            </button>

            <span aria-live="polite">
              {autosave.status === "saving" ? strings.draftAutosaveSaving : null}
              {autosave.status === "saved" ? fillTemplate(strings.draftAutosaveSaved, { time: shortTimeOf(autosave.at) ?? "" }) : null}
              {autosave.status === "failed" ? strings.draftAutosaveFailed : null}
              {autosave.status === "idle" && autosaveDecision === "blocked-errors" ? strings.draftAutosaveBlocked : null}
              {autosave.status === "idle" && autosaveDecision !== "blocked-errors"
                ? fillTemplate(strings.draftAutosaveHint, { seconds: Math.round(AUTOSAVE_DELAY_MS / 1000) })
                : null}
            </span>

            <span>{fillTemplate(strings.draftLastSaved, { time: shortTimeOf(draftUpdatedAt) ?? "—" })}</span>
          </div>
        </div>

        {warnings.length > 0 ? (
          <p className="text-fg-muted text-xs">{fillTemplate(strings.warningCount, { count: warnings.length })}</p>
        ) : null}
      </div>

      {/*
        ประวัติการเผยแพร่ + "เทียบก่อนกู้คืน" (X1.5)
        ผู้ใช้สั่ง: ควรเห็นก่อนว่ากู้คืนแล้วอะไรจะเปลี่ยน — ไม่ใช่กดแล้วรู้ทีหลัง
        ⇒ ต่อรุ่นมี 2 ทาง: "เทียบกับฉบับร่าง" (อ่านล้วน) แล้วค่อยกด "กู้คืน" ในแผงเทียบ
      */}
      <section className="border-line bg-surface flex flex-col gap-2 rounded-2xl border p-3">
        <h2 className="text-fg text-sm font-semibold">{strings.revisions}</h2>
        {revisions.length === 0 ? (
          <p className="text-fg-muted text-xs">{strings.noRevisions}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {revisions.map((entry) => (
              <li key={entry.revision} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-fg-muted text-xs">
                  {fillTemplate(strings.revisionLabel, {
                    revision: entry.revision,
                    blocks: entry.blockCount,
                    time: entry.createdAt.slice(0, 16).replace("T", " "),
                  })}
                </span>
                <div className="flex flex-wrap items-center gap-1">
                  <form action={compareAction}>
                    <input type="hidden" name="page" value={page} />
                    <input type="hidden" name="revision" value={entry.revision} />
                    <input type="hidden" name="payload" value={payload} />
                    <button
                      type="submit"
                      className="border-line text-fg hover:bg-surface-raised focus-visible:ring-ring rounded-lg border px-2 py-1 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {strings.draftCompareOpen}
                    </button>
                  </form>
                  <form action={restoreAction}>
                    <input type="hidden" name="page" value={page} />
                    <input type="hidden" name="revision" value={entry.revision} />
                    <button
                      type="submit"
                      className="border-line text-fg hover:bg-surface-raised focus-visible:ring-ring rounded-lg border px-2 py-1 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {strings.restoreRevision}
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}

        {compareState.status === "compared" && compareState.compare != null ? (
          <div className="border-line bg-surface-raised flex min-w-0 flex-col gap-2 rounded-xl border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-fg text-xs font-semibold">
                {fillTemplate(strings.draftCompareTitle, { revision: compareState.compare.revision })}
              </p>
              <button
                type="button"
                onClick={() => setClosedCompare(compareState)}
                className="border-line text-fg hover:bg-surface-raised focus-visible:ring-ring rounded-lg border px-2 py-1 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none"
              >
                {strings.draftCompareClose}
              </button>
            </div>

            {compareState.compare != null && closedCompare !== compareState ? (
              <>
                {compareState.compare.diff === null ? (
                  <p className="text-fg text-xs font-semibold">
                    {compareState.compare.problem === "draft-unreadable" ? strings.draftCompareProblemDraft : strings.draftCompareProblemRead}
                  </p>
                ) : (
                  <>
                    <DocumentDiffView diff={compareState.compare.diff} strings={strings} />
                    <form action={restoreAction} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="page" value={page} />
                      <input type="hidden" name="revision" value={compareState.compare.revision} />
                      <button
                        type="submit"
                        className="bg-brand-red text-on-brand focus-visible:ring-ring rounded-lg px-2.5 py-1 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                      >
                        {strings.draftCompareRestore}
                      </button>
                    </form>
                  </>
                )}
              </>
            ) : null}
          </div>
        ) : null}
      </section>

      {/* พรีเซ็ต (แบบสำเร็จ) — ผู้ใช้สั่ง รอบที่ 52 */}
      <section className="border-line bg-surface flex min-w-0 flex-col gap-3 rounded-2xl border p-3 md:col-start-2">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-fg text-sm font-semibold">{strings.presetsTitle}</h2>
          <p className="text-fg-muted text-xs">{strings.presetsHint}</p>
        </div>

        {/* บันทึกบล็อกที่เลือกเป็นพรีเซ็ต */}
        <form action={savePresetAction} className="flex flex-col gap-2">
          <input type="hidden" name="page" value={page} />
          <input type="hidden" name="blockId" value={selected?.id ?? ""} />
          <input type="hidden" name="payload" value={payload} />
          <label htmlFor="preset-name" className="text-fg-muted text-xs">
            {strings.presetNameLabel}
          </label>
          <input
            id="preset-name"
            name="name"
            type="text"
            placeholder={strings.presetNamePlaceholder}
            className="border-line bg-surface text-fg focus-visible:ring-ring w-full rounded-lg border px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
          />
          <button
            type="submit"
            disabled={selected === null}
            className="border-line text-fg hover:bg-surface-raised focus-visible:ring-ring rounded-lg border px-2.5 py-1.5 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
          >
            {selected === null ? strings.presetSaveNoSelection : strings.presetSave}
          </button>
        </form>

        {presets.length === 0 ? (
          <p className="text-fg-muted text-xs">{strings.presetEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {presets.map((preset) => (
              <li key={preset.id} className="border-line flex min-w-0 flex-col gap-1 rounded-lg border p-2">
                <span className="text-fg text-xs font-semibold break-words">{preset.name}</span>
                <span className="text-fg-muted text-[11px]">
                  {BLOCK_CATALOG.find((entry) => entry.type === preset.blockType)?.label ?? preset.blockType} ·{" "}
                  {fillTemplate(strings.presetSavedAt, { time: preset.createdAt.slice(0, 10) })}
                </span>
                <div className="flex flex-wrap gap-1">
                  <TinyButton
                    label={strings.presetInsert}
                    onClick={() => {
                      const next = insertPresetBlock(document, preset.block);
                      update(next);
                      setSelectedId(next.blocks[next.blocks.length - 1]?.id ?? selectedId);
                    }}
                  />
                  <TinyButton
                    label={strings.presetReplace}
                    disabled={selected === null}
                    onClick={() => {
                      if (selected === null) return;
                      const next = replaceBlockWithPreset(document, selected.id, preset.block);
                      update(next);
                      setSelectedId(next.blocks.find((block) => block.type === preset.block.type)?.id ?? selectedId);
                    }}
                  />
                  <form action={deletePresetAction}>
                    <input type="hidden" name="id" value={preset.id} />
                    <input type="hidden" name="page" value={page} />
                    <button
                      type="submit"
                      className="border-line text-fg-muted hover:bg-surface-raised focus-visible:ring-ring rounded-lg border px-2 py-1 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {strings.presetDelete}
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {warnings.length > 0 ? (
        <section className="border-line bg-surface-raised flex min-w-0 flex-col gap-1 rounded-2xl border p-3 md:col-start-2">
          <p className="text-fg text-sm font-semibold">{strings.warningTitle}</p>
          <ul className="text-fg-muted list-disc pl-5 text-xs">
            {warnings.slice(0, 20).map((issue) => (
              <li key={`${issue.code}-${issue.path}`}>
                {issueLabel(strings, issue.code)} · <span className="font-mono">{issue.path}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
