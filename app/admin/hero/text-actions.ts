"use server";

import { redirect } from "next/navigation";

import { recordAudit } from "@/lib/audit/log";
import { requireAdminUser } from "@/lib/auth/dal";
import { refreshPublicSite } from "@/lib/cache/refresh";
import { toContent, toDraft, setSectionText } from "@/lib/content/draft";
import { heroTextsFieldsOf, parseHeroTextsInput } from "@/lib/content/home-hero";
import { HOME_PAGE_SPEC } from "@/lib/content/model";
import { isDatabaseConfigured, loadPageContent, savePageContent } from "@/lib/content/repository";

/**
 * บันทึก **"ข้อความหัวเว็บไซต์" (hero)** จากหน้าจอสไลด์ & แคมเปญ — รอบที่ 251
 *
 * ## มติเจ้าของ 2026-10-09
 * *"รวมทุกอย่างของ hero ไว้ที่ 'สไลด์ & แคมเปญ' + เปลี่ยนชื่อเมนูเป็น 'สไลด์ แคมเปญ ข้อความหัวเว็บไซต์'"*
 * ⇒ หน้าจอสไลด์เป็น **เจ้าของส่วน hero ทั้งส่วน** (สไลด์ · การ์ด · ข้อความ · ปุ่ม)
 *
 * ## หลักการ (ทำตามแบบเดียวกับ `saveHeroCardAction` รอบที่ 203)
 * - **เก็บที่เดิม**: EAV `content_field` → section `hero` (ไม่ย้ายที่เก็บ ⇒ หน้าเว็บอ่านค่าเดิม ไม่ต้อง migrate)
 * - **อ่าน-แก้-เขียนทั้งหน้า**: โหลดเนื้อหาหน้าแรก → แก้เฉพาะฟิลด์ hero → `savePageContent()` (transaction เดียว)
 *   ⇒ ตัวช่วยเดิมจัดการ orphan/คีย์ซ้ำให้ครบ (บทเรียนคีย์ `item_key` 2026-10-02)
 * - **fail-closed**: เจอแถวที่โครงไม่รู้จัก (`unknownKeys`) = ไม่บันทึก (กันข้อมูลส่วนอื่นหาย)
 * - ตรวจค่าด้วย `parseHeroTextsInput()` (ตรรกะล้วน) → `?error=invalid` + `&fields=` บอกช่องที่ต้องแก้
 * - บันทึกแล้วสั่ง `refreshPublicSite()` (ISR) ⇒ หน้าเว็บใหม่ทันที + audit `hero-save` (`hero-texts-save`)
 */
export async function saveHeroTextsAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser("content");
  if (!isDatabaseConfigured()) redirect("/admin/hero?error=save-failed");

  const parsed = parseHeroTextsInput(formData);
  /* ฟอร์มฝั่งจอมี `required` อยู่แล้ว — ตรงนี้เป็นด่านกันจริงที่ฝั่งเซิร์ฟเวอร์ */
  if (!parsed.ok) {
    const fields = parsed.problems.join(",");
    redirect(`/admin/hero?error=invalid&fields=${encodeURIComponent(fields)}`);
  }

  const loaded = await loadPageContent(HOME_PAGE_SPEC);
  if (loaded.unknownKeys.length > 0) redirect("/admin/hero?error=save-failed");

  let draft = toDraft(HOME_PAGE_SPEC, loaded.content);
  const fields = heroTextsFieldsOf(parsed.value);
  for (const [field, value] of Object.entries(fields)) {
    draft = setSectionText(draft, "hero", field, "th", value.th);
    draft = setSectionText(draft, "hero", field, "en", value.en);
  }

  await savePageContent(HOME_PAGE_SPEC, toContent(draft), user.email);
  await recordAudit({
    action: "hero-save",
    actorEmail: user.email,
    target: "home:hero-texts",
    detail: "hero-texts-save",
  });
  await refreshPublicSite("page");
  redirect("/admin/hero?saved=texts-saved");
}
