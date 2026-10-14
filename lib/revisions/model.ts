import type { AdminProductDetail } from "@/lib/products/repository";
import type { ProductInput } from "@/lib/products/model";
import type { AdminNewsDetail } from "@/lib/news/repository";
import type { AdminJobPosting } from "@/lib/careers/repository";
import type { AdminRecipeListItem } from "@/lib/recipes/repository";
import type { NewsBlock } from "@/lib/news/body";

/**
 * "ประวัติรุ่น" ของ สินค้า / เมนูอาหาร / ข่าว (B1 · รอบที่ 143) — **ตรรกะล้วน ไม่มี DB**
 *
 * มติเจ้าของ (2026-10-06): ทำ **แบบเดียวกับตัวสร้างหน้าเว็บ** = เก็บทุกครั้งที่บันทึก ·
 * ระยะเก็บ 1 ปี (`lib/retention/plan.ts`) · **เทียบความต่างก่อนกู้คืน** · ย้อนได้เฉพาะผู้มีสิทธิ์ `content`
 *
 * กติกา:
 * - สแนปช็อต = **สำเนาทั้งก้อนของสิ่งที่แก้ได้** (ไม่รวม id/ผู้แก้/เวลา ⇒ เทียบความต่างได้สะอาด)
 * - ภาพเก็บเป็น **พาธ** (`/media/<id>`) ตามมติ D9 ไม่เก็บ URL เต็ม
 * - `revisionDiff` เทียบแบบค่าราบ (สตริง/ตัวเลข/null) · อาร์เรย์ (ส่วนผสม/บล็อกข่าว) ถูกรวมเป็นข้อความบรรทัดเดียว
 */

export const REVISION_KINDS = ["product", "recipe", "news", "job"] as const;
export type RevisionKind = (typeof REVISION_KINDS)[number];

export type RevisionSnapshot = Readonly<Record<string, unknown>>;

/** ข้อมูลรุ่นสำหรับแสดงในรายการ (ไม่มีสแนปช็อต) */
export type RevisionMeta = {
  readonly id: string;
  readonly revision: number;
  readonly note: string;
  readonly createdBy: string;
  readonly createdLocal: string;
  /** จำนวนช่องที่ต่างจากรุ่นที่ใหม่กว่า (0 = ไม่มีการเปลี่ยนแปลง) */
  readonly changeCount: number;
  readonly isCurrent: boolean;
};

export type RevisionFieldChange = {
  readonly field: string;
  readonly before: string;
  readonly after: string;
};

/** จัดรูปค่าให้อ่านเทียบกันได้ (อาร์เรย์/ออบเจ็กต์ → ข้อความบรรทัดเดียว) */
export function revisionValueText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value.map((item) => revisionValueText(item)).filter((text) => text !== "").join(" · ");
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.keys(record)
      .sort()
      .map((key) => {
        const inner = revisionValueText(record[key]);
        return inner === "" ? "" : `${key}: ${inner}`;
      })
      .filter((text) => text !== "")
      .join(" · ");
  }
  return "";
}

/**
 * เทียบสองสแนปช็อต → เฉพาะช่องที่ต่าง (เรียงตามชื่อช่องเพื่อผลลัพธ์นิ่ง)
 * ใช้ตอน "เทียบความต่างก่อนกู้คืน" และนับจำนวนที่เปลี่ยนในรายการรุ่น
 */
export function revisionDiff(from: RevisionSnapshot, to: RevisionSnapshot): readonly RevisionFieldChange[] {
  const fields = new Set([...Object.keys(from), ...Object.keys(to)]);
  const changes: RevisionFieldChange[] = [];
  for (const field of [...fields].sort()) {
    const before = revisionValueText(from[field]);
    const after = revisionValueText(to[field]);
    if (before !== after) changes.push({ field, before, after });
  }
  return changes;
}

/* ── สแนปช็อตของแต่ละชนิด (จากตัวอ่านหลังบ้านที่มีอยู่) ────────────────────── */

export function productSnapshotOf(detail: AdminProductDetail): RevisionSnapshot {
  return {
    categoryId: detail.categoryId,
    nameTh: detail.nameTh,
    nameEn: detail.nameEn,
    groupTh: detail.groupTh,
    groupEn: detail.groupEn,
    taglineTh: detail.taglineTh,
    taglineEn: detail.taglineEn,
    detailsTh: detail.detailsTh,
    detailsEn: detail.detailsEn,
    allergensTh: detail.allergensTh,
    allergensEn: detail.allergensEn,
    netWeightTh: detail.netWeightTh,
    netWeightEn: detail.netWeightEn,
    fdaNumber: detail.fdaNumber,
    packagingTh: detail.packagingTh,
    packagingEn: detail.packagingEn,
    sortOrder: detail.sortOrder,
    imagePath: detail.imagePath,
    ingredients: detail.ingredients.map((item) => ({
      nameTh: item.nameTh,
      nameEn: item.nameEn,
      percentText: item.percentText,
    })),
  };
}

export function recipeSnapshotOf(detail: AdminRecipeListItem): RevisionSnapshot {
  return {
    titleTh: detail.titleTh,
    titleEn: detail.titleEn,
    videoId: detail.videoId,
    publishedOn: detail.publishedOn,
    sortOrder: detail.sortOrder,
    coverPath: detail.coverPath,
    status: detail.status,
  };
}

export function newsSnapshotOf(detail: AdminNewsDetail): RevisionSnapshot {
  return {
    titleTh: detail.titleTh,
    titleEn: detail.titleEn,
    excerptTh: detail.excerptTh,
    excerptEn: detail.excerptEn,
    publishedLocal: detail.publishedLocal,
    publishedLabel: detail.publishedLabel,
    status: detail.status,
    coverPath: detail.coverPath,
    body: detail.body,
  };
}

/* ── แปลงสแนปช็อตกลับเป็น "อินพุต" ของตัวเขียนเดิม (ใช้ตอนกู้คืน) ───────────── */

/** `/media/<id>` → `<id>` (ค่าว่าง/รูปแบบไม่ถูก = null ⇒ เอาภาพออก ตามกติกาของฟอร์ม) */
export function mediaIdFromPath(path: unknown): string | null {
  const text = typeof path === "string" ? path.trim() : "";
  if (!text.startsWith("/media/")) return null;
  const id = text.slice("/media/".length).trim();
  return id === "" ? null : id;
}

function snapshotText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export type ProductRestore = {
  readonly imageMediaId: string | null;
  /** ทุกช่องยกเว้น `id`/`sourceId`/`sourceUrl` (ผู้เรียกเติมเอง) */
  readonly input: ProductInput;
  readonly ingredients: readonly {
    readonly nameTh: string;
    readonly nameEn: string;
    readonly percentText: string;
  }[];
};

/** อ่านสแนปช็อตสินค้า → ค่าที่พร้อมเขียนกลับ */
export function productRestoreOf(snapshot: RevisionSnapshot): ProductRestore {
  const ingredients = Array.isArray(snapshot["ingredients"])
    ? snapshot["ingredients"].map((item) => {
        const row = (item ?? {}) as Record<string, unknown>;
        return {
          nameTh: snapshotText(row["nameTh"]),
          nameEn: snapshotText(row["nameEn"]),
          percentText: snapshotText(row["percentText"]),
        };
      })
    : [];
  return {
    imageMediaId: mediaIdFromPath(snapshot["imagePath"]),
    ingredients,
    input: {
      id: "",
      categoryId: snapshotText(snapshot["categoryId"]),
      sourceId: "",
      sourceUrl: "",
      nameTh: snapshotText(snapshot["nameTh"]),
      nameEn: snapshotText(snapshot["nameEn"]),
      groupTh: snapshotText(snapshot["groupTh"]),
      groupEn: snapshotText(snapshot["groupEn"]),
      taglineTh: snapshotText(snapshot["taglineTh"]),
      taglineEn: snapshotText(snapshot["taglineEn"]),
      detailsTh: snapshotText(snapshot["detailsTh"]),
      detailsEn: snapshotText(snapshot["detailsEn"]),
      allergensTh: snapshotText(snapshot["allergensTh"]),
      allergensEn: snapshotText(snapshot["allergensEn"]),
      netWeightTh: snapshotText(snapshot["netWeightTh"]),
      netWeightEn: snapshotText(snapshot["netWeightEn"]),
      fdaNumber: snapshotText(snapshot["fdaNumber"]),
      packagingTh: snapshotText(snapshot["packagingTh"]),
      packagingEn: snapshotText(snapshot["packagingEn"]),
      sortOrder: typeof snapshot["sortOrder"] === "number" ? snapshot["sortOrder"] : 0,
    },
  };
}

export type NewsRestore = {
  readonly coverPath: string | null;
  readonly body: readonly NewsBlock[];
  readonly values: {
    readonly titleTh: string;
    readonly titleEn: string;
    readonly excerptTh: string;
    readonly excerptEn: string;
    readonly publishedLocal: string | null;
    readonly status: "draft" | "published";
  };
};

export function newsRestoreOf(snapshot: RevisionSnapshot): NewsRestore {
  const body = Array.isArray(snapshot["body"]) ? (snapshot["body"] as readonly NewsBlock[]) : [];
  return {
    coverPath: typeof snapshot["coverPath"] === "string" ? snapshot["coverPath"] : null,
    body,
    values: {
      titleTh: snapshotText(snapshot["titleTh"]),
      titleEn: snapshotText(snapshot["titleEn"]),
      excerptTh: snapshotText(snapshot["excerptTh"]),
      excerptEn: snapshotText(snapshot["excerptEn"]),
      publishedLocal: typeof snapshot["publishedLocal"] === "string" ? snapshot["publishedLocal"] : null,
      status: snapshot["status"] === "draft" ? "draft" : "published",
    },
  };
}

export type RecipeRestore = {
  readonly coverPath: string | null;
  readonly values: {
    readonly titleTh: string;
    readonly titleEn: string;
    readonly videoId: string;
    readonly publishedOn: string | null;
    readonly sortOrder: number;
    readonly status: "draft" | "published";
  };
};

export function recipeRestoreOf(snapshot: RevisionSnapshot): RecipeRestore {
  return {
    coverPath: typeof snapshot["coverPath"] === "string" ? snapshot["coverPath"] : null,
    values: {
      titleTh: snapshotText(snapshot["titleTh"]),
      titleEn: snapshotText(snapshot["titleEn"]),
      videoId: snapshotText(snapshot["videoId"]),
      publishedOn: typeof snapshot["publishedOn"] === "string" ? snapshot["publishedOn"] : null,
      sortOrder: typeof snapshot["sortOrder"] === "number" ? snapshot["sortOrder"] : 0,
      status: snapshot["status"] === "draft" ? "draft" : "published",
    },
  };
}

/* ── ประกาศรับสมัครงาน (รอบที่ 278 · ปิดหนี้ D-265-3) ─────────────────────────── */

/** สแนปช็อตของประกาศรับสมัครงาน — สำเนาทุกช่องที่แก้ได้ (ไม่รวม id/ผู้แก้/เวลา) */
export function jobSnapshotOf(detail: AdminJobPosting): RevisionSnapshot {
  return {
    titleTh: detail.titleTh,
    titleEn: detail.titleEn,
    departmentTh: detail.departmentTh,
    departmentEn: detail.departmentEn,
    openings: detail.openings,
    gender: detail.gender,
    ageTh: detail.ageTh,
    ageEn: detail.ageEn,
    qualificationsTh: detail.qualificationsTh,
    qualificationsEn: detail.qualificationsEn,
    experienceTh: detail.experienceTh,
    experienceEn: detail.experienceEn,
    sortOrder: detail.sortOrder,
    status: detail.status,
  };
}

export type JobRestore = {
  readonly values: {
    readonly titleTh: string;
    readonly titleEn: string;
    readonly departmentTh: string;
    readonly departmentEn: string;
    readonly openings: number;
    readonly gender: string;
    readonly ageTh: string;
    readonly ageEn: string;
    readonly qualificationsTh: string;
    readonly qualificationsEn: string;
    readonly experienceTh: string;
    readonly experienceEn: string;
    readonly sortOrder: number;
    readonly status: "draft" | "published";
  };
};

/** แปลงสแนปช็อตกลับเป็นอินพุตของตัวเขียนเดิม (ใช้ตอนกู้คืน) — ค่าที่อ่านไม่ได้ = ค่ากลางที่ปลอดภัย */
export function jobRestoreOf(snapshot: RevisionSnapshot): JobRestore {
  const openings = Number(snapshot["openings"]);
  const sortOrder = Number(snapshot["sortOrder"]);
  return {
    values: {
      titleTh: snapshotText(snapshot["titleTh"]),
      titleEn: snapshotText(snapshot["titleEn"]),
      departmentTh: snapshotText(snapshot["departmentTh"]),
      departmentEn: snapshotText(snapshot["departmentEn"]),
      openings: Number.isFinite(openings) ? openings : 0,
      gender: snapshotText(snapshot["gender"]),
      ageTh: snapshotText(snapshot["ageTh"]),
      ageEn: snapshotText(snapshot["ageEn"]),
      qualificationsTh: snapshotText(snapshot["qualificationsTh"]),
      qualificationsEn: snapshotText(snapshot["qualificationsEn"]),
      experienceTh: snapshotText(snapshot["experienceTh"]),
      experienceEn: snapshotText(snapshot["experienceEn"]),
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
      status: snapshot["status"] === "draft" ? "draft" : "published",
    },
  };
}
