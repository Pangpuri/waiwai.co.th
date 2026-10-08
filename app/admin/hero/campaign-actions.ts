"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { recordAudit } from "@/lib/audit/log";
import { requireAdminUser } from "@/lib/auth/dal";
import { refreshPublicSite } from "@/lib/cache/refresh";
import {
  CAMPAIGN_ANCHOR_PRESETS,
  DEFAULT_PLACEMENT_ANCHOR,
  MAX_CAMPAIGNS,
  parseCampaignInput,
} from "@/lib/campaigns/model";
import {
  countCampaigns,
  createCampaign,
  deleteCampaignForever,
  purgeCampaignTrash,
  restoreCampaign,
  saveCampaignPlacement,
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

  /*
    ── การ์ดบนหน้าข่าวสาร (รอบที่ 198 · migration 0034) ───────────────────────────
    ช่องนี้ **ไม่มีในฟอร์มเก่า/ฟอร์มที่ยิงตรง ๆ** ⇒ ถ้าไม่ส่งมา (null) = ไม่แตะ placement เดิมเลย
    (กันการเผลอล้างค่าด้วยค่า 0 ที่เกิดจาก `Number(null)`) ⇒ fail-safe ไม่ใช่ fail-destructive
  */
  if (formData.get("newsAnchorX") !== null && formData.get("newsAnchorY") !== null) {
    const newsX = Number(formData.get("newsAnchorX"));
    const newsY = Number(formData.get("newsAnchorY"));
    await saveCampaignPlacement(
      id,
      "news",
      {
        anchorX: Number.isFinite(newsX) ? newsX : DEFAULT_PLACEMENT_ANCHOR.x,
        anchorY: Number.isFinite(newsY) ? newsY : DEFAULT_PLACEMENT_ANCHOR.y,
        isEnabled: formData.get("showOnNews") === "on",
      },
      user.email,
    );
  }

  if (!ok) return;

  await recordAudit({ action: "hero-save", actorEmail: user.email, target: `campaign:${id}`, detail: "campaign-save" });

  /*
    ── "บันทึก + เผยแพร่" ในฟอร์มเดียว (รอบที่ 199 · บั๊กจริงจากเจ้าของ) ──────────────
    เดิมปุ่มเผยแพร่เป็น **ฟอร์มแยก** ที่ส่งสำเนาค่าจาก *ฐานข้อมูล* (ไม่ใช่ค่าที่พิมพ์บนจอ)
    ⇒ เจ้าของพิมพ์หัวข้อใหม่แล้วกดเผยแพร่ ⇒ ระบบยังเห็นหัวข้อเก่า (ว่าง) ⇒ "ช่องหัวข้อ (TH) — ต้องกรอก"
    แม้กล่องบนจอจะมีข้อความ ⇒ รวมเป็นฟอร์มเดียว: **ตรวจค่าที่พิมพ์ → บันทึก → เปลี่ยนสถานะ**
    (ปุ่มเลือกด้วย `name="intent"` — ทำงานได้โดยไม่ต้องมี JS)
  */
  const intent = typeof formData.get("intent") === "string" ? String(formData.get("intent")) : "save";
  if (intent === "publish" || intent === "unpublish") {
    const nextStatus = intent === "publish" ? "published" : "draft";
    const changed = await setCampaignStatus(id, nextStatus, user.email);
    if (!changed) redirect("/admin/hero?tab=campaigns&error=save-failed");
    await recordAudit({
      action: "hero-save",
      actorEmail: user.email,
      target: `campaign:${id}`,
      detail: intent === "publish" ? "campaign-publish" : "campaign-unpublish",
    });
    await refreshAfterCampaignChange("campaign-status");
    return;
  }

  await refreshAfterCampaignChange("campaign-saved");
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

/**
 * ลบการ์ดในถัง **ถาวร** (รอบที่ 202) — บังคับยืนยันที่ฝั่งเซิร์ฟเวอร์ (`confirm=yes`)
 * ประตู "ต้องอยู่ในถังก่อน" อยู่ที่ SQL (`delete from campaign where … and deleted_at is not null`)
 */
export async function deleteCampaignForeverAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser("content");
  const id = typeof formData.get("id") === "string" ? String(formData.get("id")) : "";
  /* ไม่ติ๊กยืนยัน = ไม่ทำอะไร (ไม่พึ่ง JS/`confirm()` ของเบราว์เซอร์) */
  if (id === "" || formData.get("confirm") !== "yes") return;
  const ok = await deleteCampaignForever(id);
  if (!ok) redirect("/admin/hero?tab=campaigns&error=save-failed");
  await recordAudit({ action: "hero-save", actorEmail: user.email, target: `campaign:${id}`, detail: "campaign-purge" });
  await refreshAfterCampaignChange("campaign-purged");
}

/** ลบถาวรทั้งถัง (เก็บกวาดการ์ดทดสอบ) — ต้องติ๊กยืนยันเช่นกัน */
export async function purgeCampaignTrashAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser("content");
  if (formData.get("confirm") !== "yes") return;
  const removed = await purgeCampaignTrash();
  if (removed === 0) redirect("/admin/hero?tab=campaigns&error=save-failed");
  await recordAudit({
    action: "hero-save",
    actorEmail: user.email,
    target: "campaign:trash",
    detail: `campaign-purge-all:${removed}`,
  });
  await refreshAfterCampaignChange("campaign-purged");
}
