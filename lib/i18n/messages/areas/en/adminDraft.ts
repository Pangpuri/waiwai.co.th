/**
 * Dictionary area: admin — autosave + compare before restore (X1.5)
 *
 * แยกออกจาก admin.ts เพราะไฟล์นั้นใกล้เพดาน 32 KB (ด่าน check:i18n: "แยกพื้นที่ย่อย อย่าขยายเพดาน")
 * ⚠️ ชนิดอ้างจาก "รายการคีย์ของไฟล์ไทย" ⇒ ขาด/เกินคีย์เดียว typecheck แดงทันที
 */
import type { Messages } from "@/lib/i18n/messages/th";
import type { adminDraft as thAdminDraft } from "@/lib/i18n/messages/areas/th/adminDraft";

export const adminDraft: Pick<Messages["admin"], keyof typeof thAdminDraft> = {
  sectionManagedElsewhere: "The live site shows this from another system (owner: {screen}) — values typed here are not shown yet. Do not edit in two places",
  draftAutosaveOn: "Autosave: on",
  draftAutosaveOff: "Autosave: off",
  draftAutosaveHint: "Saved automatically {seconds} seconds after you stop editing — no need to save manually.",
  draftAutosaveSaving: "Autosaving…",
  draftAutosaveSaved: "Autosaved at {time}",
  draftAutosaveFailed: "Autosave failed — your work is still on screen; keep editing or press “Publish” to save and go live.",
  draftAutosaveBlocked: "Autosave is paused — fix the errors first",
  draftUnsavedCount: "{count} changes not saved yet",
  draftAllSaved: "Everything is saved",
  draftLastSaved: "Last saved {time}",
  draftWarnLeave: "{count} unsaved changes — leave this page anyway?",
  draftCompareOpen: "Compare with the version you are editing",
  draftCompareTitle: "Revision {revision} compared with what is on screen",
  draftCompareSummary: "Added {added} · removed {removed} · changed {changed} · moved {moved}",
  draftCompareOrderChanged: "Block order changed",
  draftCompareIdentical: "No difference from what you are editing now",
  draftCompareRestore: "Restore this revision for editing",
  draftCompareClose: "Close comparison",
  draftCompareTruncated: "Showing part of the changes — there are more",
  draftCompareProblemRead: "This revision cannot be read — restoring it is not advised",
  draftCompareProblemDraft: "The version on screen cannot be read — nothing to compare",
  draftCompareFieldTruncated: "and more",
  draftKindAdded: "Block added",
  draftKindRemoved: "Block removed",
  draftKindChanged: "Block changed",
  draftKindMoved: "Block moved",
  draftInColumn: "Column {n}",
  /* Page-level change (X1.8): the layout is not tied to any block, so it has its own label */
  draftDiffLayout: "Page layout",
  draftRestoredApplied: "Restored — what is on screen was replaced by the restored revision (not live yet)",
  /* ── Round 252: retired sections / code-layout-only sections ── */
  sectionDead: "This section is no longer used — the site does not read these values (real source: {screen}) · nothing to edit here, the stored values are kept intact.",
  sectionCodeLayoutOnly:
    "Values here apply **only while the home page uses the code layout** — once the page runs on blocks (page builder), the marketplace block decides instead.",
};
