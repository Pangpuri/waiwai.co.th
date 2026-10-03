/**
 * Dictionary area: admin — autosave + compare before restore (X1.5)
 *
 * แยกออกจาก admin.ts เพราะไฟล์นั้นใกล้เพดาน 32 KB (ด่าน check:i18n: "แยกพื้นที่ย่อย อย่าขยายเพดาน")
 * ⚠️ ชนิดอ้างจาก "รายการคีย์ของไฟล์ไทย" ⇒ ขาด/เกินคีย์เดียว typecheck แดงทันที
 */
import type { Messages } from "@/lib/i18n/messages/th";
import type { adminDraft as thAdminDraft } from "@/lib/i18n/messages/areas/th/adminDraft";

export const adminDraft: Pick<Messages["admin"], keyof typeof thAdminDraft> = {
  draftAutosaveOn: "Autosave: on",
  draftAutosaveOff: "Autosave: off",
  draftAutosaveHint: "The draft is saved automatically {seconds} seconds after you stop editing (you can always press save yourself).",
  draftAutosaveSaving: "Autosaving…",
  draftAutosaveSaved: "Autosaved at {time}",
  draftAutosaveFailed: "Autosave failed — please press \"Save draft\" again",
  draftAutosaveBlocked: "Autosave is paused — fix the errors first",
  draftUnsavedCount: "{count} changes not saved yet",
  draftAllSaved: "Everything is saved",
  draftLastSaved: "Last saved {time}",
  draftWarnLeave: "{count} unsaved changes — leave this page anyway?",
  draftCompareOpen: "Compare with draft",
  draftCompareTitle: "Revision {revision} compared with the draft on screen",
  draftCompareSummary: "Added {added} · removed {removed} · changed {changed} · moved {moved}",
  draftCompareOrderChanged: "Block order changed",
  draftCompareIdentical: "No difference from the current draft",
  draftCompareRestore: "Restore this revision as draft",
  draftCompareClose: "Close comparison",
  draftCompareTruncated: "Showing part of the changes — there are more",
  draftCompareProblemRead: "This revision cannot be read — restoring it is not advised",
  draftCompareProblemDraft: "The current draft cannot be read — nothing to compare",
  draftCompareFieldTruncated: "and more",
  draftKindAdded: "Block added",
  draftKindRemoved: "Block removed",
  draftKindChanged: "Block changed",
  draftKindMoved: "Block moved",
  draftInColumn: "Column {n}",
  /* Page-level change (X1.8): the layout is not tied to any block, so it has its own label */
  draftDiffLayout: "Page layout",
  draftRestoredApplied: "Restored — the draft on screen was replaced by the restored revision (not published yet)",
};
