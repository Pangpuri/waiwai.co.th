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
  mediaUsageBlockPreset: "Block preset",
  mediaUsageChromePreset: "Site-wide preset",
  mediaUsageProduct: "Product (imported from the old site)",
  mediaUsageRecipe: "Recipe video (imported from the old site)",
  mediaUsageSeo: "SEO (share image / icon)",
  mediaUnused: "Not used yet",
  mediaPath: "Path to use",
  mediaAltTh: "Alt text (Thai)",
  mediaAltEn: "Alt text (English)",
  mediaSaveAlt: "Save alt text",
  mediaReplace: "Replace file (same path)",
  mediaReplaceAction: "Replace",
  mediaDelete: "Move to trash",
  mediaDeleteBlocked: "Cannot delete — this image is still in use",
  mediaDeleted: "Moved to trash (restore it from the trash page)",
  mediaTrashHint: "Delete moves the file to the trash — nothing is permanent until the retention window ends.",
  mediaTrashLink: "Open trash",
  mediaUploadTitle: "Upload a new image",
  mediaUploadAction: "Upload",
  mediaNoResults: "No images found",
  mediaDimensions: "Size",
  /* Pick from the library inside the content editor (round 93) */
  /* Automatic shrink before upload (round 99) */
  imageShrunkHint: "Shrunk automatically:",
  imageShrinkNote: "Large images are downscaled and converted to WebP in the browser before upload (max 2400px) — files with JavaScript disabled are sent unchanged.",
  mediaPickFromLibrary: "Pick from library",
  mediaPickHint: "Click an image to use it here (alt text comes from the library and can be edited)",
};
