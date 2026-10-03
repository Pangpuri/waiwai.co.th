"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { type BuilderIssue, type BuilderState } from "@/features/admin/builder-state";
import { requireAdminUser } from "@/lib/auth/dal";
import { documentDiff } from "@/lib/blocks/diff";
import { buildHomeTemplate } from "@/lib/blocks/home-template";
import { parseBlockDocument } from "@/lib/blocks/parse";
import {
  isPageLive,
  loadDocumentRow,
  loadRevision,
  migrateStoredDocuments,
  publishDraft,
  restoreRevisionToDraft,
  saveDraft,
  setPageLive,
} from "@/lib/blocks/repository";
import { documentErrorsOf, documentWarningsOf, validateDocument } from "@/lib/blocks/validate";
import type { BlockDocument } from "@/lib/blocks/types";
import { refreshPublicSite } from "@/lib/cache/refresh";

/**
 * Server Actions ของหน้าจอสร้างหน้าเว็บ (บล็อกอิสระ)
 *
 * ลำดับเดียวกันทุก action
 *   1. **ตรวจสิทธิ์ก่อนเสมอ** (`requireAdminUser()`)
 *   2. แปลงข้อมูลที่ส่งมาแบบไม่เชื่อใจ (`parseBlockDocument`)
 *   3. ตรวจเนื้อหาด้วย validator ของบล็อก (error = หยุด · warning = เตือนแต่ไปต่อ)
 *   4. เขียน DB (draft / published + ประวัติ) พร้อมชื่อผู้ทำ
 *
 * ⚠️ "เผยแพร่" = บันทึกฉบับร่างที่เห็นอยู่ **แล้ว**คัดลอกเป็นฉบับที่ใช้จริง
 * เพื่อให้ "สิ่งที่เห็นตอนกด = สิ่งที่ขึ้นเว็บ" เสมอ (ไม่ใช่เผยแพร่ของเก่าที่ค้างอยู่ใน DB)
 */

const BUILDER_BASE = "/admin/builder";

function pathOf(page: string): string {
  return `${BUILDER_BASE}/${page}`;
}

type Prepared =
  | { readonly ok: true; readonly document: BlockDocument; readonly warnings: readonly BuilderIssue[] }
  | { readonly ok: false; readonly state: BuilderState };

async function prepare(page: string, formData: FormData): Promise<Prepared> {
  const payload = formData.get("payload");
  if (typeof payload !== "string" || payload.trim() === "") {
    return {
      ok: false,
      state: { status: "failed", errors: [], warnings: [], problems: ["ไม่พบข้อมูลที่ส่งมาจากหน้าจอ"], revision: null },
    };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(payload);
  } catch {
    return {
      ok: false,
      state: { status: "failed", errors: [], warnings: [], problems: ["ข้อมูลที่ส่งมาไม่ใช่ JSON ที่อ่านได้"], revision: null },
    };
  }

  const parsed = parseBlockDocument(page, raw);
  if (!parsed.ok) {
    return {
      ok: false,
      state: { status: "invalid", errors: [], warnings: [], problems: parsed.problems, revision: null },
    };
  }

  const issues = validateDocument(parsed.document);
  const errors = documentErrorsOf(issues).map((entry) => ({ code: entry.code, path: entry.path, detail: entry.detail }));
  const warnings = documentWarningsOf(issues).map((entry) => ({ code: entry.code, path: entry.path, detail: entry.detail }));

  if (errors.length > 0) {
    return { ok: false, state: { status: "invalid", errors, warnings, problems: [], revision: null } };
  }

  return { ok: true, document: parsed.document, warnings };
}

export async function saveDraftAction(_previous: BuilderState, formData: FormData): Promise<BuilderState> {
  const user = await requireAdminUser();
  const page = String(formData.get("page") ?? "").trim();
  if (page === "") {
    return { status: "failed", errors: [], warnings: [], problems: ["ไม่รู้ว่าจะบันทึกหน้าไหน"], revision: null };
  }

  const prepared = await prepare(page, formData);
  if (!prepared.ok) return prepared.state;

  try {
    await saveDraft(page, prepared.document, user.email);
  } catch {
    return { status: "failed", errors: [], warnings: prepared.warnings, problems: ["บันทึกลงฐานข้อมูลไม่สำเร็จ"], revision: null };
  }

  revalidatePath(pathOf(page));
  return { status: "draft-saved", errors: [], warnings: prepared.warnings, problems: [], revision: null };
}

export async function publishAction(_previous: BuilderState, formData: FormData): Promise<BuilderState> {
  const user = await requireAdminUser();
  const page = String(formData.get("page") ?? "").trim();
  if (page === "") {
    return { status: "failed", errors: [], warnings: [], problems: ["ไม่รู้ว่าจะเผยแพร่หน้าไหน"], revision: null };
  }

  const prepared = await prepare(page, formData);
  if (!prepared.ok) return prepared.state;

  try {
    await saveDraft(page, prepared.document, user.email);
    const { revision } = await publishDraft(page, user.email, null);
    revalidatePath(pathOf(page));

    /*
      เผยแพร่สำเร็จแล้ว → ทำให้หน้าเว็บสาธารณะสดใหม่ (X1.7)
      ISR + on-demand revalidate = หน้าเว็บใหม่ทันทีโดยไม่ต้อง build · ถ้าตั้ง REBUILD_HOOK_URL/REBUILD_COMMAND
      (โฮสต์ที่ไม่มี ISR) จึงสั่ง build เพิ่ม · ล้มเหลวก็ไม่ทำให้การเผยแพร่ล้ม
    */
    const refresh = await refreshPublicSite("page");
    const rebuild = refresh.rebuild;

    return {
      status: "published",
      errors: [],
      warnings: prepared.warnings,
      problems: [],
      revision,
      rebuild: rebuild.kind,
      rebuildDetail: rebuild.kind === "failed" ? rebuild.detail : null,
    };
  } catch {
    return {
      status: "failed",
      errors: [],
      warnings: prepared.warnings,
      problems: ["เผยแพร่ไม่สำเร็จ — ตรวจว่าบันทึกฉบับร่างแล้วและฐานข้อมูลยังใช้ได้"],
      revision: null,
    };
  }
}

export async function restoreRevisionAction(_previous: BuilderState, formData: FormData): Promise<BuilderState> {
  const user = await requireAdminUser();
  const page = String(formData.get("page") ?? "").trim();
  const revision = Number.parseInt(String(formData.get("revision") ?? ""), 10);

  if (page === "" || !Number.isInteger(revision)) {
    return { status: "failed", errors: [], warnings: [], problems: ["ไม่พบรุ่นที่ต้องการกู้คืน"], revision: null };
  }

  /* อ่านรุ่นที่จะกู้คืน "ก่อน" เขียนทับ เพื่อส่งเอกสารกลับให้หน้าจอแสดงทันที (X1.5) */
  const raw = await loadRevision(page, revision);

  try {
    await restoreRevisionToDraft(page, revision, user.email);
  } catch {
    return { status: "failed", errors: [], warnings: [], problems: ["กู้คืนไม่สำเร็จ"], revision: null };
  }

  const parsed = raw === null ? null : parseBlockDocument(page, raw);
  const restoredDocument = parsed !== null && parsed.ok ? parsed.document : null;

  revalidatePath(pathOf(page));
  return { status: "restored", errors: [], warnings: [], problems: [], revision, restoredDocument };
}

/**
 * เทียบ "ฉบับร่างบนหน้าจอ" กับ "รุ่นในประวัติ" ก่อนตัดสินใจกู้คืน (X1.5)
 *
 * ทำไมต้องเทียบก่อน: การกู้คืนเขียนทับฉบับร่างทั้งก้อน ⇒ ผู้ใช้ควรเห็นก่อนว่าอะไรจะเปลี่ยน
 * (เพิ่ม/ลบ/แก้/ย้าย กี่จุด) ไม่ใช่กดแล้วรู้ทีหลัง
 *
 * - ใช้ `payload` จากฟอร์ม (สิ่งที่ผู้ใช้เห็นอยู่จริง รวมงานที่ยังไม่บันทึก) — ถ้าไม่มี/อ่านไม่ได้จึงอ่านฉบับร่างจากฐานข้อมูล
 * - ความต่างถูกคำนวณ **ฝั่งเซิร์ฟเวอร์** (ข้อมูลจาก DB ห้ามเชื่อจนกว่าจะผ่าน parse)
 * - ไม่เขียนอะไรลงฐานข้อมูล — เป็นการอ่านล้วน (ผู้ใช้ยังต้องกด "กู้คืน" อีกครั้ง)
 */
export async function compareRevisionAction(_previous: BuilderState, formData: FormData): Promise<BuilderState> {
  await requireAdminUser();

  const page = String(formData.get("page") ?? "").trim();
  const revision = Number.parseInt(String(formData.get("revision") ?? ""), 10);
  if (page === "" || !Number.isInteger(revision)) {
    return { status: "failed", errors: [], warnings: [], problems: ["ไม่พบรุ่นที่ต้องการเทียบ"], revision: null };
  }

  const raw = await loadRevision(page, revision);
  const parsed = raw === null ? null : parseBlockDocument(page, raw);
  if (parsed === null || !parsed.ok) {
    return {
      status: "compared",
      errors: [],
      warnings: [],
      problems: [],
      revision: null,
      compare: { revision, diff: null, problem: "read-failed" },
    };
  }

  const current = await readCurrentDraftForCompare(page, formData);
  if (current === null) {
    return {
      status: "compared",
      errors: [],
      warnings: [],
      problems: [],
      revision: null,
      compare: { revision, diff: null, problem: "draft-unreadable" },
    };
  }

  return {
    status: "compared",
    errors: [],
    warnings: [],
    problems: [],
    revision: null,
    compare: { revision, diff: documentDiff(current, parsed.document), problem: null },
  };
}

/** ฉบับร่างที่ใช้เทียบ: เอาจาก payload ที่หน้าจอส่งมา (สิ่งที่ผู้ใช้เห็น) ถ้าใช้ไม่ได้จึงอ่านจาก DB */
async function readCurrentDraftForCompare(page: string, formData: FormData): Promise<BlockDocument | null> {
  const payload = formData.get("payload");
  if (typeof payload === "string" && payload.trim() !== "") {
    try {
      const parsed = parseBlockDocument(page, JSON.parse(payload));
      if (parsed.ok) return parsed.document;
    } catch {
      /* payload เสีย → ลองอ่านจากฐานข้อมูลต่อ */
    }
  }

  const row = await loadDocumentRow(page, "draft");
  if (row === null) return null;
  const parsed = parseBlockDocument(page, row.raw);
  return parsed.ok ? parsed.document : null;
}

/** เริ่มจากเทมเพลต (ข้อความชุดเดียวกับหน้าเว็บปัจจุบัน) — ใช้เมื่อยังไม่มีฉบับร่าง */
export async function startFromTemplateAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser();
  const page = String(formData.get("page") ?? "").trim();
  if (page !== "home") redirect(`${BUILDER_BASE}/home`);

  const template = buildHomeTemplate();
  await saveDraft(page, { ...template, page }, user.email);
  revalidatePath(pathOf(page));
  redirect(pathOf(page));
}

/**
 * เปิด/ปิด "ใช้เนื้อหานี้กับหน้าเว็บจริง" (เซสชั่น S1)
 * เปิด = หน้าเว็บสาธารณะเรนเดอร์เอกสารที่เผยแพร่แทนเลย์เอาต์ที่ออกแบบไว้ · ปิด = กลับไปใช้ของเดิมทันทีหลังสร้างใหม่
 */
export async function setPageLiveAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser();

  const page = String(formData.get("page") ?? "").trim();
  if (page === "") return;

  const live = formData.get("live") === "1";
  await setPageLive(page, live, user.email);

  revalidatePath(pathOf(page));
  await refreshPublicSite("page");
}

/** ใช้ในหน้าจอเพื่อแสดงสถานะสวิตช์ (อ่านอย่างเดียว) */
export async function readPageLiveAction(page: string): Promise<boolean> {
  await requireAdminUser();
  return isPageLive(page);
}

/**
 * ย้ายรุ่นรูปทรงบล็อกของ "ข้อมูลที่เก็บไว้" (ฉบับร่าง + ฉบับเผยแพร่) ให้เป็นรุ่นปัจจุบัน (X1.1)
 *
 * ตัวอ่าน (`parseBlockDocument`) ย้ายให้อัตโนมัติทุกครั้งอยู่แล้ว ⇒ ปุ่มนี้ไม่ได้ทำให้หน้าเว็บอ่านได้/ไม่ได้
 * แต่ทำให้ **ข้อมูลในฐานข้อมูลสะอาด** (สำรองข้อมูล/ส่งออก/เครื่องมืออื่นที่อ่าน JSONB ตรง ๆ จะเห็นรูปทรงปัจจุบัน)
 * ⚠️ ไม่แตะประวัติการเผยแพร่ — ประวัติคือภาพในอดีต ต้องคงไว้ตามจริง
 */
export async function migrateBlocksAction(_previous: BuilderState, formData: FormData): Promise<BuilderState> {
  const user = await requireAdminUser();
  const page = String(formData.get("page") ?? "").trim();
  if (page === "") {
    return { status: "failed", errors: [], warnings: [], problems: ["ไม่รู้ว่าจะย้ายข้อมูลของหน้าไหน"], revision: null };
  }

  try {
    const result = await migrateStoredDocuments(page, user.email);
    revalidatePath(pathOf(page));
    return { status: "migrated", errors: [], warnings: [], problems: [], revision: null, migrated: result };
  } catch {
    return { status: "failed", errors: [], warnings: [], problems: ["ย้ายรุ่นข้อมูลไม่สำเร็จ"], revision: null };
  }
}
