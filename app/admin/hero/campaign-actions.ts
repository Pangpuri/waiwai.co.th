"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { recordAudit } from "@/lib/audit/log";
import { requireAdminUser } from "@/lib/auth/dal";
import { refreshPublicSite } from "@/lib/cache/refresh";
import { CAMPAIGN_ANCHOR_PRESETS, MAX_CAMPAIGNS, isCampaignStatus, parseCampaignInput } from "@/lib/campaigns/model";
import {
  countCampaigns,
  createCampaign,
  restoreCampaign,
  setCampaignStatus,
  trashCampaign,
  updateCampaign,
} from "@/lib/campaigns/repository";
import { invalidCampaignHref } from "@/lib/hero/feedback";

/**
 * Server Action ของ "แคมเปญ" (รอบที่ 190)
 *
 * กติกาเดียวกับ action อื่นของโมดูล
 * - ตรวจสิทธิ์ทุก action (`content`) · ไม่เชื่อข้อมูลจากเบราว์เซอร์ (ผ่าน `parseCampaignInput`)
 * - audit ด้วยรหัสเดิม `hero-save` (detail `campaign-*` ⇒ ไม่ต้องขยาย union ของ audit)
 * - refresh หน้าเว็บ ⇒ เผยแพร่/ถอนแล้วหน้าแรกเปลี่ยนทันที (ISR)
 * - ⚠️ เผยแพร่ได้เฉพาะค่าที่ผ่านการตรวจ (หัวข้อไทยบังคับ) — กัน "แคมเปญเปล่าขึ้นเว็บ"
 */

/** ปิดรอบการบันทึกของแคมเปญ: refresh หน้าเว็บ + Redirect กลับแท็บแคมเปญพร้อมรหัสผลลัพธ์ */
async function refreshAfterCampaignChange(flag: string): Promise<void> {
  revalidatePath("/admin/hero");
  await refreshPublicSite("page");
  redirect(`/admin/hero?tab=campaigns&saved=${flag}`);
}

export async function addCampaignAction(): Promise<void> {
  const user = await requireAdminUser("content");
  /* เพดานกัน "ขึ้นมั่วจนเละ" — เกินเพดานไม่สร้างเพิ่ม */
  if ((await countCampaigns()) >= MAX_CAMPAIGNS) return;
  const id = await createCampaign(user.email);
  if (id !== null) {
    await recordAudit({ action: "hero-save", actorEmail: user.email, target: `campaign:${id}`, detail: "campaign-add" });
    await refreshAfterCampaignChange("campaign-added");
  }
}

export async function saveCampaignAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser("content");
  const id = typeof formData.get("id") === "string" ? String(formData.get("id")) : "";
  if (id === "") return;

  const slideIds = formData.getAll("slideIds").filter((value): value is string => typeof value === "string");
  /* ปุ่มลัดตำแหน่ง (ซ้าย/กลาง/ขวา): ถ้าส่งมา ให้ใช้ค่านั้นแทนตัวเลขที่กรอก */
  const presetRaw = typeof formData.get("preset") === "string" ? String(formData.get("preset")) : "";
  const presetAnchor = Object.prototype.hasOwnProperty.call(CAMPAIGN_ANCHOR_PRESETS, presetRaw)
    ? CAMPAIGN_ANCHOR_PRESETS[presetRaw as keyof typeof CAMPAIGN_ANCHOR_PRESETS]
    : null;
  const parsed = parseCampaignInput({
    name: formData.get("name"),
    title: { th: formData.get("titleTh"), en: formData.get("titleEn") },
    body: { th: formData.get("bodyTh"), en: formData.get("bodyEn") },
    ctaLabel: { th: formData.get("ctaLabelTh"), en: formData.get("ctaLabelEn") },
    ctaHref: formData.get("ctaHref"),
    imagePath: formData.get("imagePath"),
    imageAltTh: formData.get("imageAltTh"),
    imageAltEn: formData.get("imageAltEn"),
    anchorX: presetAnchor === null ? Number(formData.get("anchorX")) : presetAnchor.x,
    anchorY: presetAnchor === null ? Number(formData.get("anchorY")) : presetAnchor.y,
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    isActive: formData.get("isActive") === "on",
    slideIds,
  });
  /* ค่าไม่ผ่าน = ไม่บันทึก (ไม่เดาแทนผู้ใช้) — หน้าจอจะรีเฟรชกลับไปค่าที่ถูกต้อง + บอกว่าช่องไหนไม่ผ่าน */
  if (!parsed.ok) redirect(invalidCampaignHref(parsed.problems));

  const ok = await updateCampaign(id, parsed.value, user.email);
  if (!ok) redirect("/admin/hero?tab=campaigns&error=save-failed");
  if (ok) {
    await recordAudit({ action: "hero-save", actorEmail: user.email, target: `campaign:${id}`, detail: "campaign-save" });
    await refreshAfterCampaignChange("campaign-saved");
  }
}

/** เผยแพร่ / ถอนแคมเปญ (intent เดียว) */
export async function setCampaignStatusAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser("content");
  const id = typeof formData.get("id") === "string" ? String(formData.get("id")) : "";
  const status = typeof formData.get("status") === "string" ? String(formData.get("status")) : "";
  if (id === "" || !isCampaignStatus(status)) return;

  /* ⚠️ กันแคมเปญเปล่าขึ้นเว็บ: ก่อนเผยแพร่ต้องผ่านการตรวจค่า (หัวข้อไทยบังคับ) */
  if (status === "published") {
    const parsed = parseCampaignInput({
      name: formData.get("name"),
      title: { th: formData.get("titleTh"), en: formData.get("titleEn") },
      ctaHref: formData.get("ctaHref"),
    imagePath: formData.get("imagePath"),
    imageAltTh: formData.get("imageAltTh"),
    imageAltEn: formData.get("imageAltEn"),
      anchorX: Number(formData.get("anchorX")),
      anchorY: Number(formData.get("anchorY")),
      slideIds: formData.getAll("slideIds"),
    });
    if (!parsed.ok) redirect(invalidCampaignHref(parsed.problems));
  }

  const ok = await setCampaignStatus(id, status, user.email);
  if (!ok) redirect("/admin/hero?tab=campaigns&error=save-failed");
  if (ok) {
    await recordAudit({
      action: "hero-save",
      actorEmail: user.email,
      target: `campaign:${id}`,
      detail: status === "published" ? "campaign-publish" : "campaign-unpublish",
    });
    await refreshAfterCampaignChange("campaign-status");
  }
}

export async function removeCampaignAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser("content");
  const id = typeof formData.get("id") === "string" ? String(formData.get("id")) : "";
  if (id === "") return;
  const ok = await trashCampaign(id, user.email);
  if (!ok) redirect("/admin/hero?tab=campaigns&error=save-failed");
  if (ok) {
    await recordAudit({ action: "hero-save", actorEmail: user.email, target: `campaign:${id}`, detail: "campaign-trash" });
    await refreshAfterCampaignChange("campaign-trashed");
  }
}

/**
 * กู้คืนแคมเปญจากถังขยะ (รอบที่ 198)
 * ⚠️ ก่อนรอบนี้ย้ายเข้าถังได้อย่างเดียว — ไม่มีทางกู้จากจอเลย (การ์ดที่เผยแพร่อยู่หายถาวรในทางปฏิบัติ)
 */
export async function restoreCampaignAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser("content");
  const id = typeof formData.get("id") === "string" ? String(formData.get("id")) : "";
  if (id === "") return;
  const ok = await restoreCampaign(id);
  if (!ok) redirect("/admin/hero?tab=campaigns&error=save-failed");
  if (ok) {
    await recordAudit({ action: "hero-save", actorEmail: user.email, target: `campaign:${id}`, detail: "campaign-restore" });
    await refreshAfterCampaignChange("campaign-restored");
  }
}
