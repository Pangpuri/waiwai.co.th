"use server";

import { revalidatePath } from "next/cache";
import { refreshPublicSite } from "@/lib/cache/refresh";

import { requireAdminUser } from "@/lib/auth/dal";
import { isDatabaseConfigured } from "@/lib/content/repository";
import { normalizePageName, validatePageName, validatePageSeo, type PageSeo } from "@/lib/pages/model";
import { updatePage, updatePageSeo } from "@/lib/pages/repository";

/**
 * Server Action ของ "หน้าตั้งค่าหน้า" (W1) — เปลี่ยนชื่อหน้า (= ชื่อเมนูของหน้านั้น), เปิด/ปิดในเมนู, ลำดับ
 *
 * ลำดับเดียวกับที่อื่น: ตรวจสิทธิ์ → ตรวจค่า (ไม่เชื่อฟอร์ม) → เขียนฐานข้อมูล → revalidate
 * ⚠️ ชื่อหน้าถูกใช้เป็นป้ายเมนูของ navbar ด้วย (ดู lib/chrome/loader.ts) ⇒ แก้ที่เดียว ได้ทั้งเว็บ
 */
export async function updatePageAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser();
  if (!isDatabaseConfigured()) return;

  const id = String(formData.get("id") ?? "").trim();
  if (id === "") return;

  const nameTh = normalizePageName(String(formData.get("nameTh") ?? ""));
  const rawNameEn = String(formData.get("nameEn") ?? "").trim();
  const nameEn = rawNameEn === "" ? "" : normalizePageName(rawNameEn);
  if (nameTh === null || nameEn === null) return;

  if (validatePageName(nameTh, nameEn).length > 0) return;

  const orderRaw = Number.parseInt(String(formData.get("menuOrder") ?? "0"), 10);
  const menuOrder = Number.isFinite(orderRaw) ? Math.max(0, Math.min(orderRaw, 9999)) : 0;

  await updatePage(id, { nameTh, nameEn, inMenu: formData.get("inMenu") === "1", menuOrder }, user.email);

  revalidatePath(`/admin/builder/${id}`);
  await refreshPublicSite("pages");
  revalidatePath("/admin/builder/chrome");
  await refreshPublicSite("pages");
}

/** บันทึกค่า SEO ของหน้า (W2) — ว่างได้ทุกช่อง = ใช้ค่าเดิมจากพจนานุกรม */
export async function updatePageSeoAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser();
  if (!isDatabaseConfigured()) return;

  const id = String(formData.get("id") ?? "").trim();
  if (id === "") return;

  const cut = (name: string, max: number) => String(formData.get(name) ?? "").trim().slice(0, max);

  const seo: PageSeo = {
    titleTh: cut("seoTitleTh", 70),
    titleEn: cut("seoTitleEn", 70),
    descriptionTh: cut("seoDescriptionTh", 170),
    descriptionEn: cut("seoDescriptionEn", 170),
    ogImagePath: cut("ogImagePath", 300),
    noindex: formData.get("seoNoindex") === "1",
  };

  if (validatePageSeo(seo).length > 0) return;

  await updatePageSeo(id, seo, user.email);
  revalidatePath(`/admin/builder/${id}`);
  await refreshPublicSite("pages");
}
