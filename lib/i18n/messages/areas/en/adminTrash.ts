/**
 * Dictionary area: admin — X2.4 — trash
 *
 * แยกไฟล์ตามกติกาด่าน check:i18n ("พื้นที่หลังบ้านชนเพดาน ⇒ แยกพื้นที่ย่อย อย่าขยายเพดาน")
 * ⚠️ ชนิดอ้างจาก "รายการคีย์ของไฟล์ไทย" ⇒ ขาด/เกินคีย์เดียว typecheck แดงทันที
 * ⚠️ ห้ามพิมพ์ตัวเลขระยะเก็บในไฟล์นี้ — ตัวเลขมาจาก `lib/retention/plan.ts` แล้วเติมด้วย `{days}`
 */
import type { Messages } from "@/lib/i18n/messages/th";
import type { adminTrash as thAdminTrash } from "@/lib/i18n/messages/areas/th/adminTrash";

export const adminTrash: Pick<Messages["admin"], keyof typeof thAdminTrash> = {
  trashTitle: "Trash",
  trashHint: "Items deleted from the media library or presets land here first — restorable until the retention window ends.",
  trashRetentionNote: "Kept for {days}, then permanently deleted automatically (or delete it permanently right away).",
  trashDbMissing: "Database not configured — the trash cannot be opened until it is set up.",
  trashEmpty: "Trash is empty — nothing to restore.",
  trashStats: "In trash: {media} images · {preset} presets",
  trashColItem: "Item",
  trashColKind: "Type",
  trashColDeletedAt: "Moved in",
  trashColDeletedBy: "By",
  trashColExpiry: "Time left",
  trashColActions: "Manage",
  trashKindMedia: "Image",
  trashKindPreset: "Block preset",
  trashKindChromePreset: "Site-wide preset",
  trashDaysLeft: "{days} days left",
  trashDueNow: "Will be deleted in the next run",
  trashRestore: "Restore",
  trashRestoreDone: "Restored — it is back to normal",
  trashDeleteForever: "Delete permanently",
  trashDeleteForeverDone: "Permanently deleted",
  trashDeleteForeverWarning: "Permanent deletion cannot be undone — the file leaves the database immediately.",
  trashEmptyAction: "Delete everything permanently",
  trashEmptyDone: "Permanently deleted {count} items",
  trashNotFound: "Item not found (it may already be gone)",
  trashNoPreview: "Trashed images are not served on the website — restore it first to use it again.",
  trashPurgeNow: "Delete expired items now",
  trashPurgeHint: "Use this instead of waiting for the automatic run (it normally runs on admin sign-in or via cron).",
  trashBackToMedia: "Go to the media library",
  trashListLabel: "Items in the trash",
  trashConfirmEmpty: "Confirm: I understand this cannot be undone",
  trashCardTitle: "Trash",
  trashCardHint: "Deleted items stay restorable until the retention window ends.",
  trashCardCount: "{count} items in the trash",
  trashCardEmpty: "Trash is empty",
  trashCardDbMissing: "Database not configured",
  auditTrashMove: "Moved to trash",
  auditTrashRestore: "Restored from trash",
  auditTrashDelete: "Permanently deleted from trash",
  auditTrashPurge: "Permanent deletion by retention policy",
};
