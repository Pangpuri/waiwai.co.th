"use server";

import { revalidatePath } from "next/cache";

import { recordAudit } from "@/lib/audit/log";
import { requireAdminUser } from "@/lib/auth/dal";
import { refreshPublicSite } from "@/lib/cache/refresh";
import { parseHeroCardInput } from "@/lib/hero/cards";
import { createHeroCard, trashHeroCard, updateHeroCard } from "@/lib/hero/cards-repository";

/**
 * Server Action ของ "การ์ดบนสไลด์ + ช่วงเวลาแคมเปญ" (รอบที่ 188)
 *
 * กติกาเดียวกับ action อื่นของโมดูล
 * - ตรวจสิทธิ์ทุก action (`content`) · ไม่เชื่อข้อมูลจากเบราว์เซอร์ (ผ่าน `parseHeroCardInput`)
 * - เขียน audit (`hero-save` · detail `card-add`/`card-save`/`card-trash`) · refresh หน้าเว็บ (แคมเปญขึ้น/ลงทันทีเมื่อบันทึก)
 */

async function refreshAfterCardChange(): Promise<void> {
  revalidatePath("/admin/hero");
  await refreshPublicSite("page");
}

export async function addHeroCardAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser("content");
  const slideId = typeof formData.get("slideId") === "string" ? String(formData.get("slideId")) : "";
  if (slideId === "") return;
  const id = await createHeroCard(slideId, user.email);
  if (id !== null) {
    await recordAudit({ action: "hero-save", actorEmail: user.email, target: `hero-card:${id}`, detail: "card-add" });
    await refreshAfterCardChange();
  }
}

export async function saveHeroCardAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser("content");
  const id = typeof formData.get("id") === "string" ? String(formData.get("id")) : "";
  if (id === "") return;

  const textOf = (prefix: string): { th: string; en: string } => ({
    th: typeof formData.get(`${prefix}Th`) === "string" ? String(formData.get(`${prefix}Th`)) : "",
    en: typeof formData.get(`${prefix}En`) === "string" ? String(formData.get(`${prefix}En`)) : "",
  });

  const parsed = parseHeroCardInput({
    title: textOf("title"),
    body: textOf("body"),
    ctaLabel: textOf("ctaLabel"),
    ctaHref: typeof formData.get("ctaHref") === "string" ? String(formData.get("ctaHref")) : "",
    position: typeof formData.get("position") === "string" ? String(formData.get("position")) : "left",
    startsAt: typeof formData.get("startsAt") === "string" ? String(formData.get("startsAt")) : "",
    endsAt: typeof formData.get("endsAt") === "string" ? String(formData.get("endsAt")) : "",
    isActive: formData.get("isActive") === "on",
  });
  /* ค่าไม่ผ่าน = ไม่บันทึก (ไม่เดาแทนผู้ใช้) — หน้าจอจะรีเฟรชกลับไปค่าที่ถูกต้อง */
  if (!parsed.ok) return;

  const ok = await updateHeroCard(id, parsed.value, user.email);
  if (ok) {
    await recordAudit({ action: "hero-save", actorEmail: user.email, target: `hero-card:${id}`, detail: "card-save" });
    await refreshAfterCardChange();
  }
}

export async function removeHeroCardAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser("content");
  const id = typeof formData.get("id") === "string" ? String(formData.get("id")) : "";
  if (id === "") return;
  const ok = await trashHeroCard(id, user.email);
  if (ok) {
    await recordAudit({ action: "hero-save", actorEmail: user.email, target: `hero-card:${id}`, detail: "card-trash" });
    await refreshAfterCardChange();
  }
}
