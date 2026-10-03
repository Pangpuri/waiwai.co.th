/**
 * Dictionary area: admin — X1.2 — media library
 *
 * แยกออกจาก admin.ts เพราะไฟล์ใหญ่เกินเพดาน 32 KB (ด่าน check:i18n: "แยกพื้นที่ย่อย อย่าขยายเพดาน")
 * ⚠️ ชนิดอ้างจาก "รายการคีย์ของไฟล์ไทย" ⇒ ขาด/เกินคีย์เดียว typecheck แดงทันที
 */
import type { Messages } from "@/lib/i18n/messages/th";
import type { adminMedia as thAdminMedia } from "@/lib/i18n/messages/areas/th/adminMedia";

export const adminMedia: Pick<Messages["admin"], keyof typeof thAdminMedia> = {
  mediaTitle: "Media library",
  mediaHint: "Every image uploaded to the database — search, reuse, replace and delete when unused.",
  mediaSearch: "Search (filename / alt text)",
  mediaSearchAction: "Search",
  mediaClear: "Clear",
  mediaStats: "{count} images · {size} · {unused} unused",
  mediaUsage: "Used in",
  mediaUnused: "Not used yet",
  mediaPath: "Path to use",
  mediaAltTh: "Alt text (Thai)",
  mediaAltEn: "Alt text (English)",
  mediaSaveAlt: "Save alt text",
  mediaReplace: "Replace file (same path)",
  mediaReplaceAction: "Replace",
  mediaDelete: "Delete",
  mediaDeleteBlocked: "Cannot delete — this image is still in use",
  mediaDeleted: "Deleted",
  mediaUploadTitle: "Upload a new image",
  mediaUploadAction: "Upload",
  mediaNoResults: "No images found",
  mediaDimensions: "Size",
};
