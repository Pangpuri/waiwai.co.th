"use server";

import { redirect } from "next/navigation";

import {
  type CategoryFormReason,
  type CategoryFormState,
  type CategoryPresetState,
  type CategoryReorderState,
} from "@/features/admin/category-state";
import { isDatabaseConfigured } from "@/db/pool";
import { parseOrderCsv, reorderRows } from "@/lib/admin/reorder";
import { recordAudit } from "@/lib/audit/log";
import { requireAdminUser } from "@/lib/auth/dal";
import { revalidateAdminPath, refreshPublicSite } from "@/lib/cache/refresh";
import { mediaIdFromPath } from "@/lib/media/usage";
import {
  builtInCategorySlugs,
  categorySlugInput,
  nextCategorySortOrder,
  parseCategoryPreset,
  slugifyCategoryName,
  validateCategoryEdit,
  validateNewCategory,
} from "@/lib/products/categories";
import {
  applyCategoryPreset,
  categorySnapshotOf,
  createProductCategoryAdmin,
  deleteCategoryPreset,
  deleteEmptyCategoryAdmin,
  listAdminCategories,
  listCategoryIds,
  listCategorySlugs,
  loadCategoryPreset,
  restoreAllCategoriesFromDefault,
  restoreCategoryFromDefault,
  saveCategoryPreset,
  setCategoryHidden,
  updateProductCategoryAdmin,
} from "@/lib/products/categories-repository";
/* โหมดเขียนภาพใช้ตัวกลางตัวเดิม (บทเรียนจริงรอบที่ 263: ไม่มีคีย์ในฟอร์ม = ไม่แตะภาพ) */
import { imageWriteMode } from "@/lib/products/media-mode";

/**
 * Server Action ของหน้าจอ **"หมวดสินค้า"** (รอบที่ 264 · มติ D25)
 *
 * กติกาเดียวกับหลังบ้านส่วนอื่น
 * - ตรวจสิทธิ์ `content` ทุก action · ไม่เชื่อข้อมูลจากเบราว์เซอร์ (ผ่าน validator กลาง)
 * - เขียน audit ทุกครั้งที่เปลี่ยนข้อมูล · บันทึกแล้วสั่ง `refreshPublicSite("page")` ให้เว็บอัปเดตทันที
 *
 * 🆕 รอบที่ 280 (มติ D30 — แทนที่มติ D25 ข้อ 1/3)
 * - **แก้ slug ได้** ⇒ เปลี่ยนแล้วระบบบันทึกประวัติ + ทำ **301** จากที่อยู่เดิม (ชั้นข้อมูลเป็นคนทำ)
 * - **ลบหมวดได้** แต่เฉพาะ **หมวดว่างที่ไม่ใช่หมวดในโค้ด** (`deleteCategoryAction`)
 *   ⚠️ ประตูจริงอยู่ที่ SQL · ที่นี่ตรวจซ้ำเพื่อให้ข้อความบนจอตรง (ไม่ใช่เพื่อกันการโจมตี)
 */

const LIST_PATH = "/admin/product-categories";

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function fail(reason: CategoryFormReason): CategoryFormState {
  return { status: "error", reason, createdSlug: "" };
}

/**
 * บันทึกค่าหมวด (แก้ของเดิมเท่านั้น)
 * ⚠️ `imagePath`/`logoPath` ใช้ `imageWriteMode` — ฟอร์มไม่ส่งคีย์ = ไม่แตะภาพ (บทเรียนรอบที่ 263)
 */
export async function saveCategoryAction(
  _previous: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const user = await requireAdminUser("content");
  if (!isDatabaseConfigured()) return fail("database");

  const id = field(formData, "categoryId");
  if (id === "") return fail("missing");

  /*
    ที่อยู่บนเว็บ: ตรวจกับ **slug ของหมวดอื่น** (ตัดตัวเองออก) — เปลี่ยนแล้วชั้นข้อมูลจะทำ 301 ให้เอง
    · ช่องว่าง = ไม่แตะที่อยู่เดิม (ไม่ใช่ "ลบที่อยู่")
  */
  const slugInput = categorySlugInput(field(formData, "slug"));
  const otherSlugs = (await listCategorySlugs()).filter((slug) => slug !== slugInput);

  const input = {
    id,
    slug: slugInput,
    nameTh: field(formData, "nameTh"),
    nameEn: field(formData, "nameEn"),
    descriptionTh: field(formData, "descriptionTh"),
    descriptionEn: field(formData, "descriptionEn"),
    sortOrder: readInt(field(formData, "sortOrder"), 100),
    isHidden: field(formData, "isHidden") === "on",
    /* `undefined` = ไม่แตะภาพ · `null` = ผู้ใช้เลือก "ไม่ใช้ภาพ" (ลบจริง) */
    imageMediaId: imageWriteMode(formData, "imagePath") === "set" ? mediaIdFromPath(field(formData, "imagePath")) : undefined,
    logoMediaId: imageWriteMode(formData, "logoPath") === "set" ? mediaIdFromPath(field(formData, "logoPath")) : undefined,
  };

  if (validateCategoryEdit(input, { existingSlugs: otherSlugs }).length > 0) return fail("invalid");

  /*
    ⚠️ ที่อยู่ใหม่ชนกับหมวดอื่น = unique index โยน error (ทั้ง transaction ย้อนกลับ — ไม่มีที่อยู่ครึ่ง ๆ กลาง ๆ)
    ⇒ จับไว้แล้วรายงานเป็น "ที่อยู่ซ้ำ" ไม่ปล่อยให้เป็น 500
  */
  let saved = false;
  try {
    saved = await updateProductCategoryAdmin(input, user.email);
  } catch {
    return fail("duplicate");
  }
  if (!saved) return fail("missing");

  await recordAudit({
    action: "product-category-save",
    actorEmail: user.email,
    target: `category:${id}`,
    detail: slugInput !== undefined ? `updated · slug=${slugInput}` : "updated",
  });
  revalidateAdminPath(LIST_PATH);
  await refreshPublicSite("page");
  return { status: "saved", reason: "", createdSlug: "" };
}

/**
 * เพิ่มหมวดใหม่ — slug สร้างจากชื่ออังกฤษ (มติ D25 ข้อ 1) · เพดาน 12 หมวด (ข้อ 2)
 * ⚠️ `source_id` **ไม่บังคับ** สำหรับหมวดที่สร้างเอง (ต่างจากหมวดที่นำเข้าจากเว็บเดิม)
 */
export async function createCategoryAction(
  _previous: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const user = await requireAdminUser("content");
  if (!isDatabaseConfigured()) return fail("database");

  const nameTh = field(formData, "nameTh");
  const nameEn = field(formData, "nameEn");
  const [existingSlugs, rows] = await Promise.all([listCategoryIds(), listAdminCategories()]);

  const issues = validateNewCategory({ nameTh, nameEn }, { existingSlugs, total: existingSlugs.length });
  if (issues.length > 0) {
    if (issues.some((issue) => issue.code === "too-many-categories")) return fail("limit");
    if (issues.some((issue) => issue.code === "slug-duplicate")) return fail("duplicate");
    return fail("invalid");
  }

  const slug = slugifyCategoryName(nameEn);
  const imagePath = field(formData, "imagePath");
  const logoPath = field(formData, "logoPath");

  const created = await createProductCategoryAdmin(
    {
      id: slug,
      nameTh,
      nameEn,
      descriptionTh: field(formData, "descriptionTh"),
      descriptionEn: field(formData, "descriptionEn"),
      sortOrder: nextCategorySortOrder(rows),
      imageMediaId: imagePath === "" ? null : mediaIdFromPath(imagePath),
      logoMediaId: logoPath === "" ? null : mediaIdFromPath(logoPath),
    },
    user.email,
  );
  /* ตรวจซ้ำอีกชั้นที่ฐานข้อมูล (unique key) — กันสองคำขอแข่งกัน */
  if (!created) return fail("duplicate");

  await recordAudit({
    action: "product-category-create",
    actorEmail: user.email,
    target: `category:${slug}`,
    detail: "created",
  });
  revalidateAdminPath(LIST_PATH);
  await refreshPublicSite("page");
  return { status: "saved", reason: "", createdSlug: slug };
}

/** ซ่อน/แสดงหมวดบนเว็บ (มติ D25 ข้อ 3 — ไม่มี "ลบ") */
export async function toggleCategoryHiddenAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser("content");
  const id = field(formData, "id");
  const hidden = field(formData, "intent") === "hide";
  if (id === "" || !isDatabaseConfigured()) return;

  if (!(await setCategoryHidden(id, hidden, user.email))) return;
  await recordAudit({
    action: "product-category-hide",
    actorEmail: user.email,
    target: `category:${id}`,
    detail: hidden ? "hidden" : "shown",
  });
  revalidateAdminPath(LIST_PATH);
  await refreshPublicSite("page");
}

/**
 * **ลบหมวดถาวร** (รอบที่ 280 · มติ D30 ข้อ 4) — เฉพาะหมวดที่ **ว่างเปล่าและไม่ใช่หมวดในโค้ด**
 *
 * ⚠️ **ประตูจริงอยู่ที่ SQL** (`deleteEmptyCategoryAdmin` — `exists product` + `id <> all(builtIn)`)
 *   ที่นี่ตรวจซ้ำเพื่อให้ข้อความบนจอตรงสาเหตุ (ไม่ใช่ด่านกันการโจมตี)
 * ลบสำเร็จ/ไม่สำเร็จ ⇒ **redirect กลับหน้าจอพร้อมข้อความ** (ฟอร์มธรรมดา ไม่ต้องมี JS)
 */
export async function deleteCategoryAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser("content");
  const id = field(formData, "id");
  if (id === "" || !isDatabaseConfigured()) return;

  const row = (await listAdminCategories()).find((entry) => entry.id === id);
  if (row === undefined) redirect(`${LIST_PATH}?error=delete-missing`);
  if (builtInCategorySlugs().includes(id)) redirect(`${LIST_PATH}?error=delete-built-in`);
  if (row.productCount > 0) redirect(`${LIST_PATH}?error=delete-has-products`);

  const deleted = await deleteEmptyCategoryAdmin(id, builtInCategorySlugs());
  if (!deleted) redirect(`${LIST_PATH}?error=delete-blocked`);

  await recordAudit({
    action: "product-category-delete",
    actorEmail: user.email,
    target: `category:${id}`,
    detail: `slug=${row.slug}`,
  });
  revalidateAdminPath(LIST_PATH);
  await refreshPublicSite("page");
  redirect(`${LIST_PATH}?deleted=${encodeURIComponent(row.slug)}`);
}

/**
 * คืนค่าเริ่มต้น (รายหมวดหรือทั้งชุด) — อ่านจากตาราง `product_category_default` ที่ **UI แก้ไม่ได้**
 * ส่ง `id` ว่าง = คืนทั้งชุด · ไม่ส่ง `id` เลย = คืนทั้งชุดเช่นกัน
 */
export async function restoreCategoryDefaultsAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser("content");
  if (!isDatabaseConfigured()) return;

  const id = field(formData, "id");
  const count = id === "" ? await restoreAllCategoriesFromDefault(user.email) : Number(await restoreCategoryFromDefault(id, user.email));
  if (count === 0) return;

  await recordAudit({
    action: "product-category-restore",
    actorEmail: user.email,
    target: id === "" ? "category:*" : `category:${id}`,
    detail: `restored=${String(count)}`,
  });
  revalidateAdminPath(LIST_PATH);
  await refreshPublicSite("page");
}

/** จัดลำดับหมวด (ใช้ร่วมกับ `SortableList` ของเดิม — ส่ง `order=id1,id2,…`) */
export async function reorderCategoriesAction(
  _previous: CategoryReorderState,
  formData: FormData,
): Promise<CategoryReorderState> {
  const user = await requireAdminUser("content");
  if (!isDatabaseConfigured()) return { saved: 0, failed: true };
  /* จอส่ง kind มาด้วย — ตรวจให้ตรงกับ action นี้ (กันใช้ผิดจอ) */
  if (field(formData, "kind") !== "category") return { saved: 0, failed: true };

  const ids = parseOrderCsv(field(formData, "order"));
  const saved = await reorderRows("category", ids, user.email);
  if (saved === 0) return { saved: 0, failed: true };

  await recordAudit({
    action: "product-category-reorder",
    actorEmail: user.email,
    target: "category:*",
    detail: `ordered=${String(saved)}`,
  });
  revalidateAdminPath(LIST_PATH);
  await refreshPublicSite("page");
  return { saved, failed: false };
}

/* ── พรีเซ็ต (มติ D25 ข้อ 5) ─────────────────────────────────────────────────── */

/** บันทึกชุดจากค่าปัจจุบันของทุกหมวด — ชื่อซ้ำ = เขียนทับชุดเดิม */
export async function saveCategoryPresetAction(
  _previous: CategoryPresetState,
  formData: FormData,
): Promise<CategoryPresetState> {
  const user = await requireAdminUser("content");
  if (!isDatabaseConfigured()) return { status: "error", count: 0, reason: "database" };

  const name = field(formData, "name");
  if (name === "") return { status: "error", count: 0, reason: "missing" };

  const rows = await listAdminCategories();
  if (rows.length === 0) return { status: "error", count: 0, reason: "missing" };

  await saveCategoryPreset(name, { version: 1, categories: rows.map(categorySnapshotOf) }, user.email);
  await recordAudit({
    action: "product-category-preset-save",
    actorEmail: user.email,
    target: `category-preset:${name}`,
    detail: `items=${String(rows.length)}`,
  });
  revalidateAdminPath(LIST_PATH);
  return { status: "saved", count: rows.length, reason: "" };
}

/** ใช้ชุด — เขียนทับเฉพาะหมวดที่มีอยู่จริง (ไม่ลบ/ไม่สร้างหมวดใหม่) */
export async function applyCategoryPresetAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser("content");
  const presetId = field(formData, "presetId");
  if (presetId === "" || !isDatabaseConfigured()) return;

  const preset = await loadCategoryPreset(presetId);
  if (preset === null) return;

  const result = await applyCategoryPreset(preset.payload, user.email);
  if (result.applied === 0 && result.skipped.length === 0) return;

  await recordAudit({
    action: "product-category-preset-apply",
    actorEmail: user.email,
    target: `category-preset:${preset.name}`,
    detail: `applied=${String(result.applied)} skipped=${String(result.skipped.length)}`,
  });
  revalidateAdminPath(LIST_PATH);
  await refreshPublicSite("page");
}

export async function deleteCategoryPresetAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser("content");
  const presetId = field(formData, "presetId");
  if (presetId === "" || !isDatabaseConfigured()) return;

  const preset = await loadCategoryPreset(presetId);
  if (preset === null || !(await deleteCategoryPreset(presetId))) return;

  await recordAudit({
    action: "product-category-preset-delete",
    actorEmail: user.email,
    target: `category-preset:${preset.name}`,
    detail: "deleted",
  });
  revalidateAdminPath(LIST_PATH);
}

/**
 * นำเข้าชุดจากไฟล์ JSON (ไฟล์ที่ส่งออกจากจอนี้)
 * ⚠️ **ไม่เชื่อไฟล์** — `parseCategoryPreset()` ตรวจรูปแบบ/เวอร์ชัน/ความยาว และข้ามแถวที่เสีย
 */
export async function importCategoryPresetAction(
  _previous: CategoryPresetState,
  formData: FormData,
): Promise<CategoryPresetState> {
  const user = await requireAdminUser("content");
  if (!isDatabaseConfigured()) return { status: "error", count: 0, reason: "database" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { status: "error", count: 0, reason: "missing" };

  let text = "";
  try {
    text = await file.text();
  } catch {
    return { status: "error", count: 0, reason: "invalid" };
  }

  const parsed = parseCategoryPreset(text);
  if (parsed === null) return { status: "error", count: 0, reason: "invalid" };

  const rawName = field(formData, "name");
  const name = rawName === "" ? "imported" : rawName;
  await saveCategoryPreset(name, parsed.payload, user.email);
  await recordAudit({
    action: "product-category-preset-import",
    actorEmail: user.email,
    target: `category-preset:${name}`,
    detail: `items=${String(parsed.payload.categories.length)} skipped=${String(parsed.skipped)}`,
  });
  revalidateAdminPath(LIST_PATH);
  return { status: "imported", count: parsed.payload.categories.length, reason: "" };
}
