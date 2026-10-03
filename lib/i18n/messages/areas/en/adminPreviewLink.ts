/**
 * Dictionary area: admin — temporary preview links (X2.6)
 *
 * แยกไฟล์ตามกติกาด่าน check:i18n ("พื้นที่หลังบ้านชนเพดาน ⇒ แยกพื้นที่ย่อย")
 * ⚠️ ชนิดอ้างจาก "รายการคีย์ของไฟล์ไทย" ⇒ ขาด/เกินคีย์เดียว typecheck แดงทันที
 * ⚠️ ห้ามพิมพ์ตัวเลขชั่วโมง/เพดาน/วันในไฟล์นี้ — มาจาก `lib/preview-link/plan.ts`
 */
import type { Messages } from "@/lib/i18n/messages/th";
import type { adminPreviewLink as thAdminPreviewLink } from "@/lib/i18n/messages/areas/th/adminPreviewLink";

export const adminPreviewLink: Pick<Messages["admin"], keyof typeof thAdminPreviewLink> = {
  previewLinkTitle: "Temporary preview links",
  previewLinkHint: "Create a link so a manager or the marketing team can view the draft without an admin account.",
  previewLinkTtlNote:
    "Links last {hours} · only the token hash is stored, so a link can never be shown again (copy it right after creating).",
  previewLinkCreate: "Create a new link",
  previewLinkCreateAction: "Create link",
  previewLinkCreated: "Link created — copy it now (it will not be shown again)",
  previewLinkCreatedLabel: "Preview link",
  previewLinkLocaleLabel: "Link language",
  previewLinkLocaleTh: "Thai (/th)",
  previewLinkLocaleEn: "English (/en)",
  previewLinkPageLabel: "Page",
  previewLinkPageHome: "Home",
  previewLinkListTitle: "Existing links",
  previewLinkEmpty: "No links created yet",
  previewLinkColPage: "Page",
  previewLinkColCreated: "Created",
  previewLinkColCreatedBy: "Created by",
  previewLinkColExpires: "Expires",
  previewLinkColStatus: "Status",
  previewLinkColUsed: "Usage",
  previewLinkColActions: "Manage",
  previewLinkStatusActive: "Active",
  previewLinkStatusExpired: "Expired",
  previewLinkStatusRevoked: "Revoked",
  previewLinkHoursLeft: "{hours} h left",
  previewLinkUsedCount: "opened {count} times",
  previewLinkNeverUsed: "Never opened",
  previewLinkRevoke: "Revoke",
  previewLinkRevoked: "Revoked",
  previewLinkNotFound: "Link not found (it may already be gone)",
  previewLinkTooMany: "Active links reached the cap ({max}) — revoke an older link first",
  previewLinkDbMissing: "Database not configured — cannot create links",
  previewLinkRevokeWarning: "Revoking kills the link immediately (whoever holds it can no longer open it).",
  previewLinkNoStoreWarning: "This page is a staff tool — never share this admin URL itself.",
  auditPreviewLinkCreate: "Created a preview link",
  auditPreviewLinkRevoke: "Revoked a preview link",
  auditPreviewLinkPurge: "Cleaned up preview links",
};
