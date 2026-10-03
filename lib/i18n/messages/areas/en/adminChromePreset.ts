/**
 * Dictionary area: admin — site-wide (chrome) presets (W3b)
 *
 * แยกไฟล์ตามกติกาด่าน check:i18n ("พื้นที่หลังบ้านชนเพดาน ⇒ แยกพื้นที่ย่อย")
 * ⚠️ ชนิดอ้างจาก "รายการคีย์ของไฟล์ไทย" ⇒ ขาด/เกินคีย์เดียว typecheck แดงทันที
 * ⚠️ ห้ามพิมพ์เพดานจำนวนชุดในไฟล์นี้ — มาจาก `lib/chrome/presets.ts`
 */
import type { Messages } from "@/lib/i18n/messages/th";
import type { adminChromePreset as thAdminChromePreset } from "@/lib/i18n/messages/areas/th/adminChromePreset";

export const adminChromePreset: Pick<Messages["admin"], keyof typeof thAdminChromePreset> = {
  chromePresetTitle: "Site-wide presets",
  chromePresetHint: "Save the navbar, footer and notice as reusable sets, or drop a saved set into the draft.",
  chromePresetSaveTitle: "Save the current set as a preset",
  chromePresetSaveHint: "Capture the “new” set (the draft you are working on) or the “old” set (what the live site uses now).",
  chromePresetNameLabel: "Set name",
  chromePresetNamePlaceholder: "e.g. Plain navbar · New-year footer",
  chromePresetSourceLabel: "Capture from",
  chromePresetSourceDraft: "Draft (the new one)",
  chromePresetSourcePublished: "Live version (the old one)",
  chromePresetSave: "Save as preset",
  chromePresetSaved: "Preset saved",
  chromePresetOverwritten: "Overwrote the preset with the same name",
  chromePresetEmpty: "No saved sets for this part yet",
  chromePresetListTitle: "Saved sets",
  chromePresetApply: "Use this set",
  chromePresetApplied: "Applied to the draft — the live site changes only after you publish",
  chromePresetApplyHint: "Only the draft is replaced · the live version stays untouched",
  chromePresetDelete: "Delete this set",
  chromePresetDeleted: "Moved to the trash (restore it from the trash page)",
  chromePresetDeleteWarning: "Deleting sends it to the shared trash — you can restore it from the trash page.",
  chromePresetSavedAt: "saved {time}",
  chromePresetCountNavbar: "{items} items · {buttons} buttons",
  chromePresetCountFooter: "{groups} groups · {socials} socials",
  chromePresetCountMourning: "{images} images",
  chromePresetMourningOn: "notice on",
  chromePresetMourningOff: "notice off",
  chromePresetTooMany: "This part already has {max} sets — delete an unused one first",
  chromePresetBadName: "Give the set a name before saving",
  chromePresetSavedFromDefault: "This part was never saved before — captured the default set the live site uses",
  chromePresetInvalid: "This set cannot be used — fix the invalid values in that part first",
  chromePresetNotFound: "Set not found (it may have been deleted)",
  chromePresetDbMissing: "Database not configured — presets are unavailable",
  auditChromePresetSave: "Saved a site-wide preset",
  auditChromePresetApply: "Applied a site-wide preset",
};
