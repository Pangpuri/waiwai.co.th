"use server";

import { redirect } from "next/navigation";

import { recordAudit } from "@/lib/audit/log";
import { requireAdminUser } from "@/lib/auth/dal";
import { refreshPublicSite } from "@/lib/cache/refresh";
import { parseHeroCardInput } from "@/lib/content/home-card";
import { frameOf } from "@/lib/hero/pr-card-frame";
import { saveHeroCardFrame } from "@/lib/hero/repository";
import { addItem, setItemMedia, setItemText, toContent, toDraft } from "@/lib/content/draft";
import { HOME_PAGE_SPEC } from "@/lib/content/model";
import { isDatabaseConfigured, loadPageContent, savePageContent } from "@/lib/content/repository";

/**
 * บันทึก "การ์ด PR แคมเปญ" (การ์ดที่ขยับมุมขวาล่างของหน้าแรก) จาก **หน้าแคมเปญ** โดยตรง — รอบที่ 203
 *
 * คำเจ้าของ: *"จริง ๆ ส่วนนี้ผมเขียนขึ้นเพื่อให้มันเป็นส่วน PR แคมเปญ … ย้ายมันไปไว้ส่วนแคมเปญ
 *   สามารถอัปโหลดรูปได้ เปลี่ยนข้อความสั้น ๆ ได้ เอามาเป็นส่วนของตัวเอง ไม่ต้องพาไปหน้าแก้ไขภาพรวม"*
 *
 * หลักการ
 * - เก็บที่เดิม (ตารางเนื้อหาแบบมีโครง: Page `home` → Section `hero` → Item `card`) ⇒ หน้าเว็บอ่านค่าเดียวกัน
 * - **อ่าน-แก้-เขียนทั้งหน้า**: โหลดเนื้อหาหน้าแรก → แก้เฉพาะการ์ด → บันทึกผ่าน `savePageContent()` (transaction เดียว)
 * - ⚠️ fail-closed: ถ้าเจอแถวที่โครงไม่รู้จัก (`unknownKeys`) = **ไม่บันทึก** (กันข้อมูลส่วนอื่นหาย)
 * - ตรวจค่าด้วย `parseHeroCardInput()` (ตรรกะล้วน) แล้ว refresh หน้าเว็บทันที (ISR)
 */
export async function saveHeroCardAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser("content");
  if (!isDatabaseConfigured()) redirect("/admin/hero?tab=campaigns&error=save-failed");

  const parsed = parseHeroCardInput(formData);
  /* ฟอร์มฝั่งจอมี `required` อยู่แล้ว — ตรงนี้เป็นด่านกันจริงที่ฝั่งเซิร์ฟเวอร์ */
  if (!parsed.ok) redirect("/admin/hero?tab=campaigns&error=invalid");

  const loaded = await loadPageContent(HOME_PAGE_SPEC);
  if (loaded.unknownKeys.length > 0) redirect("/admin/hero?tab=campaigns&error=save-failed");

  const heroSection = HOME_PAGE_SPEC.sections.find((section) => section.key === "hero");
  const cardGroup = heroSection?.items.find((group) => group.key === "card");
  if (cardGroup === undefined) redirect("/admin/hero?tab=campaigns&error=save-failed");

  let draft = toDraft(HOME_PAGE_SPEC, loaded.content);
  /* ยังไม่มีการ์ดในฐานข้อมูล (ยังไม่ seed) = เพิ่มให้ก่อน แล้วเขียนทับด้วยค่าที่กรอก */
  if ((draft.sections["hero"]?.items["card"] ?? []).length === 0) draft = addItem(draft, "hero", cardGroup);

  const value = parsed.value;
  draft = setItemText(draft, "hero", "card", 0, "title", "th", value.titleTh);
  draft = setItemText(draft, "hero", "card", 0, "title", "en", value.titleEn);
  draft = setItemText(draft, "hero", "card", 0, "body", "th", value.bodyTh);
  draft = setItemText(draft, "hero", "card", 0, "body", "en", value.bodyEn);
  draft = setItemText(draft, "hero", "card", 0, "linkLabel", "th", value.linkLabelTh);
  draft = setItemText(draft, "hero", "card", 0, "linkLabel", "en", value.linkLabelEn);
  draft = setItemText(draft, "hero", "card", 0, "href", "th", value.href);

  /* ธงลายน้ำ: คงค่าเดิมไว้ถ้ายังใช้ภาพเดิม (อัปโหลดใหม่ผ่านคลังของเรา = ไม่มีลายน้ำจากแหล่งอื่น) */
  const previous = loaded.content.sections["hero"]?.items["card"]?.[0]?.media["image"];
  const hasWatermark = previous !== undefined && previous.path === value.imagePath ? previous.hasWatermark : false;
  draft = setItemMedia(draft, "hero", "card", 0, "image", {
    path: value.imagePath,
    altTh: value.imageAltTh,
    altEn: value.imageAltEn,
    hasWatermark,
  });

  await savePageContent(HOME_PAGE_SPEC, toContent(draft), user.email);

  /* กรอบภาพการ์ด (รอบที่ 208) — เก็บที่ hero_setting (ไม่แตะโครงเนื้อหา EAV) */
  const frame = frameOf(typeof formData.get("imageFrame") === "string" ? String(formData.get("imageFrame")) : "");
  const frameSaved = await saveHeroCardFrame(frame, user.email);
  if (!frameSaved) redirect("/admin/hero?error=save-failed");
  await recordAudit({
    action: "hero-save",
    actorEmail: user.email,
    target: "home:hero-card",
    detail: `hero-card-save:${frame}`,
  });
  await refreshPublicSite("page");
  redirect("/admin/hero?tab=campaigns&saved=card-saved");
}
