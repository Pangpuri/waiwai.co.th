"use server";

import { loadEntityRevision, recordEntityRevision } from "@/lib/revisions/repository";
import { productRestoreOf, productSnapshotOf } from "@/lib/revisions/model";
import { revalidatePath } from "next/cache";

import {
  INITIAL_ADMIN_UPLOAD_STATE,
  type AdminUploadState,
  type CategorySaveState,
  type ProductSaveState,
} from "@/features/admin/product-state";
import { recordAudit } from "@/lib/audit/log";
import { requireAdminUser } from "@/lib/auth/dal";
import { revalidateAdminPath, refreshPublicSite } from "@/lib/cache/refresh";
import { isDatabaseConfigured } from "@/db/pool";
import { mediaIdFromPath } from "@/lib/media/usage";
import { storeImageFile } from "@/lib/media/upload";
import {
  deleteProductForever,
  loadProductForAdmin,
  replaceProductIngredients,
  setProductTrashed,
  upsertProduct,
  upsertProductCategory,
} from "@/lib/products/repository";
import {
  isCatalogCategoryId,
  productIdOfSourceId,
  validateIngredientInput,
  validateProductInput,
  type ProductIngredientInput,
  type ProductInput,
} from "@/lib/products/model";

/**
 * Server Action ของหลังบ้าน "สินค้า" (รอบที่ 132)
 *
 * กติกาเดียวกับหลังบ้านข่าว: ตรวจสิทธิ์ทุก action · ห้ามเชื่อข้อมูลจากเบราว์เซอร์ (ผ่าน validator กลาง)
 * · เขียน audit ทุกครั้ง · บันทึกแล้วสั่ง `refreshPublicSite("page")` ให้หน้าเว็บอัปเดตทันที
 * ⚠️ **ไม่ให้แก้ `id`/`source_id`** — URL `/products/<slug>` ต้องคงที่ (การเปลี่ยน slug ต้องมีตัวเปลี่ยนเส้นทาง 301 ซึ่งยังไม่มี)
 */

const LIST_PATH = "/admin/products";

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

/** ส่วนผสมที่ส่งมาจากตัวแก้ (JSON) — ตรวจทีละรายการด้วย validator กลาง */
function readIngredients(raw: string): readonly ProductIngredientInput[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw === "" ? "[]" : raw) as unknown;
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;

  const items: ProductIngredientInput[] = [];
  for (const entry of parsed) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const candidate: ProductIngredientInput = {
      nameTh: typeof record["nameTh"] === "string" ? record["nameTh"].trim() : "",
      nameEn: typeof record["nameEn"] === "string" ? record["nameEn"].trim() : "",
      percentText: typeof record["percentText"] === "string" ? record["percentText"].trim() : "",
    };
    if (candidate.nameTh === "" && candidate.nameEn === "") continue;
    if (validateIngredientInput(candidate, items.length).length > 0) return null;
    items.push(candidate);
  }
  return items;
}

export async function saveProductAction(_previous: ProductSaveState, formData: FormData): Promise<ProductSaveState> {
  const user = await requireAdminUser("content");
  if (!isDatabaseConfigured()) return { status: "error", reason: "database", createdId: null };

  const id = field(formData, "id");
  const categoryId = field(formData, "categoryId");
  const nameTh = field(formData, "nameTh");
  if (nameTh === "" || !isCatalogCategoryId(categoryId)) {
    return { status: "error", reason: "title", createdId: null };
  }

  /*
    ⚠️ **รหัสสินค้าถูกล็อก** (รอบที่ 134) — ห้ามใช้ค่าที่ส่งมาจากเบราว์เซอร์เป็น id ตรง ๆ
    มิฉะนั้นฟอร์มที่ถูกแก้จะสร้างสินค้าใหม่/เปลี่ยน URL ของสินค้าเดิมได้ (ขัดกติกา "ห้ามแก้ slug")
    ⇒ id ต้อง derive จาก source_id เสมอ · ค่าที่ส่งมาใช้เป็น "เบาะแส" ว่าเป็นการสร้างหรือแก้เท่านั้น
  */
  const existingSourceId = field(formData, "sourceId");
  const sourceId = existingSourceId === "" ? String(Date.now()) : existingSourceId;
  const productId = productIdOfSourceId(sourceId);
  if (id !== "" && id !== productId) return { status: "error", reason: "id", createdId: null };

  const ingredients = readIngredients(field(formData, "ingredients"));
  if (ingredients === null) return { status: "error", reason: "ingredients", createdId: null };

  const input: ProductInput = {
    id: productId,
    sourceId,
    sourceUrl: "",
    categoryId,
    nameTh,
    nameEn: field(formData, "nameEn"),
    groupTh: field(formData, "groupTh"),
    groupEn: field(formData, "groupEn"),
    taglineTh: field(formData, "taglineTh"),
    taglineEn: field(formData, "taglineEn"),
    detailsTh: field(formData, "detailsTh"),
    /* ช่อง EN (รอบที่ 141) — การตลาดกรอกเองผ่านหลังบ้าน */
    detailsEn: field(formData, "detailsEn"),
    allergensTh: field(formData, "allergensTh"),
    allergensEn: field(formData, "allergensEn"),
    netWeightTh: field(formData, "netWeightTh"),
    netWeightEn: field(formData, "netWeightEn"),
    fdaNumber: field(formData, "fdaNumber"),
    packagingTh: field(formData, "packagingTh"),
    packagingEn: field(formData, "packagingEn"),
    sortOrder: readInt(field(formData, "sortOrder")),
  };

  if (validateProductInput(input).length > 0) return { status: "error", reason: "title", createdId: null };

  /* imageMode "set" = ผู้ดูแลเลือก "ไม่ใช้ภาพ" แล้วต้องลบได้จริง (สคริปต์นำเข้าใช้โหมด "keep") */
  await upsertProduct(input, user.email, mediaIdFromPath(field(formData, "imagePath")), { imageMode: "set" });
  await replaceProductIngredients(productId, ingredients);
  await recordAudit({
    action: "product-save",
    actorEmail: user.email,
    target: `product:${productId}`,
    detail: id === "" ? "created" : "updated",
  });

  revalidateAdminPath(LIST_PATH);
  revalidateAdminPath(`${LIST_PATH}/${productId}`);
  revalidatePath(`${LIST_PATH}/${productId}`);
  await refreshPublicSite("page");
  /* B1 (รอบที่ 145): เก็บรุ่นหลังบันทึกสำเร็จ — อ่านค่าจริงจากฐานข้อมูล จึงตรงกับของจริงเสมอ */
  await recordProductRevision(productId, user.email);
  return { status: "saved", reason: null, createdId: productId };
}

/** บันทึกชื่อ/คำอธิบาย/ภาพของหมวดสินค้า (รอบที่ 254: ชื่อ + โลโก้การ์ดแก้ได้จากหลังบ้าน · มติ D24) */
export async function saveProductCategoryAction(
  _previous: CategorySaveState,
  formData: FormData,
): Promise<CategorySaveState> {
  const user = await requireAdminUser("content");
  if (!isDatabaseConfigured()) return { status: "error", reason: "database" };

  const categoryId = field(formData, "categoryId");
  if (!isCatalogCategoryId(categoryId)) return { status: "error", reason: "invalid" };

  await upsertProductCategory(
    {
      id: categoryId,
      sourceId: field(formData, "sourceId"),
      /* ชื่อหมวด (migration 0037) — ผู้ดูแลกรอกเอง · ว่าง = กลับไปใช้ชื่อจากพจนานุกรม */
      nameTh: field(formData, "nameTh"),
      nameEn: field(formData, "nameEn"),
      descriptionTh: field(formData, "descriptionTh"),
      descriptionEn: field(formData, "descriptionEn"),
    },
    user.email,
    mediaIdFromPath(field(formData, "imagePath")),
    {
      /* imageMode/logoMode "set" = ผู้ดูแลเลือก "ไม่ใช้ภาพ" แล้วต้องลบได้จริง (สคริปต์นำเข้าใช้โหมด "keep") */
      imageMode: "set",
      logoMediaId: mediaIdFromPath(field(formData, "logoPath")),
      logoMode: "set",
      /* กดบันทึก = ค่าที่กรอกต้องชนะ (ล้างชื่อกลับไปใช้พจนานุกรมได้) */
      nameMode: "replace",
    },
  );
  await recordAudit({
    action: "product-category-save",
    actorEmail: user.email,
    target: `category:${categoryId}`,
    detail: "updated",
  });

  revalidateAdminPath(LIST_PATH);
  await refreshPublicSite("page");
  return { status: "saved", reason: null };
}

/**
 * ย้ายสินค้าเข้าถังขยะ / กู้คืน (รอบที่ 139)
 *
 * ⚠️ ห้ามลบถาวรตรงนี้ — ต้องผ่านถังขยะก่อน (กดพลาดแล้วกู้คืนได้ เสมอ)
 * ⚠️ ใช้ `intent` ช่องเดียว (trash/restore) ⇒ ฟอร์มเดียวจบ ไม่ต้องมี JS
 */
export async function trashProductAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser("content");
  const id = field(formData, "id").trim();
  const trashed = field(formData, "intent") === "trash";
  if (id === "" || !isDatabaseConfigured()) return;

  const changed = await setProductTrashed(id, trashed, user.email);
  if (!changed) return;

  await recordAudit({
    action: trashed ? "product-trash" : "product-restore",
    actorEmail: user.email,
    target: `product:${id}`,
    detail: trashed ? "moved-to-trash" : "restored",
  });
  revalidateAdminPath(LIST_PATH);
  revalidateAdminPath(`${LIST_PATH}/${id}`);
  await refreshPublicSite("page");
}

/**
 * ลบสินค้า **ถาวร** (รอบที่ 139) — เฉพาะของที่อยู่ในถังขยะแล้ว
 *
 * ⚠️ ประตูอยู่ที่ SQL ของ `deleteProductForever()` (`deleted_at is not null`) ⇒ fail-closed
 * ⚠️ ลบถาวร ⇒ ส่วนผสมถูกลบตาม (on delete cascade) และ **กู้คืนไม่ได้**
 */
export async function deleteProductForeverAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser("content");
  const id = field(formData, "id").trim();
  if (id === "" || !isDatabaseConfigured()) return;

  const deleted = await deleteProductForever(id);
  if (!deleted) return;

  await recordAudit({
    action: "product-delete",
    actorEmail: user.email,
    target: `product:${id}`,
    detail: "deleted-forever",
  });
  revalidateAdminPath(LIST_PATH);
  revalidateAdminPath(`${LIST_PATH}/${id}`);
  await refreshPublicSite("page");
}

/** อัปโหลดภาพจากเครื่อง (ใช้ท่อกลาง storeImageFile — ย่อภาพ/ตรวจหัวไฟล์/เพดาน 5MB) */
export async function uploadProductImageAction(
  _previous: AdminUploadState,
  formData: FormData,
): Promise<AdminUploadState> {
  await requireAdminUser("content");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ...INITIAL_ADMIN_UPLOAD_STATE, status: "invalid", reason: "missing" };
  }

  const stored = await storeImageFile(file, "product-editor");
  if (!stored.ok) return { ...INITIAL_ADMIN_UPLOAD_STATE, status: "invalid", reason: stored.reason };

  revalidateAdminPath(LIST_PATH);
  return { status: "ok", path: stored.path, reason: "" };
}

/* ── ประวัติรุ่น (B1 ส่วนที่ 2 · รอบที่ 145) ─────────────────────────────── */

async function recordProductRevision(id: string, actor: string, note = ""): Promise<void> {
  const saved = await loadProductForAdmin(id);
  if (saved === null) return;
  await recordEntityRevision({ kind: "product", entityId: id, snapshot: productSnapshotOf(saved), actor, note });
}

/**
 * กู้คืนจากรุ่นในประวัติ
 * - ตรวจสิทธิ์ `content` · ตรวจว่ารุ่นนั้นเป็นของรายการนี้จริง
 * - **บันทึกสถานะปัจจุบันเป็นรุ่นใหม่ก่อนเขียนทับ** ⇒ กู้คืนผิดก็ย้อนกลับได้เสมอ
 */
export async function restoreProductRevisionAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser("content");
  const id = field(formData, "id");
  const revisionId = field(formData, "revisionId");
  if (id === "" || revisionId === "") return;

  const snapshot = await loadEntityRevision({ kind: "product", entityId: id, revisionId });
  const current = await loadProductForAdmin(id);
  if (snapshot === null || current === null) return;

  await recordProductRevision(id, user.email, "ก่อนกู้คืน");

  const restore = productRestoreOf(snapshot);
  await upsertProduct(
    { ...restore.input, id: id, sourceId: current.sourceId, sourceUrl: "" },
    user.email,
    restore.imageMediaId,
    { imageMode: "set" },
  );
  await replaceProductIngredients(
    id,
    restore.ingredients.map((item, index) => ({ ...item, sortOrder: index + 1 })),
  );
  await recordProductRevision(id, user.email, `กู้คืนรุ่น #${revisionId}`);
  await recordAudit({
    action: "product-revision-restore",
    actorEmail: user.email,
    target: `product:${id}`,
    detail: `revision=${revisionId}`,
  });

  revalidateAdminPath(LIST_PATH);
  revalidateAdminPath(`${LIST_PATH}/${id}`);
  await refreshPublicSite("page");
}
