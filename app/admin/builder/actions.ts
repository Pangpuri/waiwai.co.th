"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { type BuilderIssue, type BuilderState } from "@/features/admin/builder-state";
import { type ScheduleState } from "@/features/admin/schedule-state";
import { requireAdminUser } from "@/lib/auth/dal";
import { documentDiff } from "@/lib/blocks/diff";
import { publishGoesLive } from "@/lib/blocks/live-scope";
import { buildBlockTemplate, hasBlockTemplate } from "@/lib/blocks/templates";
import { parseBlockDocument } from "@/lib/blocks/parse";
import { decideTemplateApply } from "@/lib/blocks/template-apply";
import { parseScheduleEpoch } from "@/lib/blocks/schedule";
import {
  isPageLive,
  loadDocumentRow,
  loadRevision,
  migrateStoredDocuments,
  publishDraft,
  restoreRevisionToDraft,
  saveDraft,
  setPageLive,
  prunePageRevisions,
  setPublishSchedule,
} from "@/lib/blocks/repository";
import { documentErrorsOf, documentWarningsOf, validateDocument } from "@/lib/blocks/validate";
import { decideRevertLayout } from "@/lib/blocks/layout-revert";
import { PRUNE_HISTORY_CONFIRM_VALUE } from "@/lib/blocks/revision-plan";
import type { BlockDocument } from "@/lib/blocks/types";
import { recordAudit } from "@/lib/audit/log";
import { refreshPublicSite } from "@/lib/cache/refresh";

/**
 * Server Actions ของหน้าจอสร้างหน้าเว็บ (บล็อกอิสระ)
 *
 * ลำดับเดียวกันทุก action
 *   1. **ตรวจสิทธิ์ก่อนเสมอ** (`requireAdminUser("<permission>")`)
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
  const user = await requireAdminUser("content");
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
  const user = await requireAdminUser("content");
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
      ── มติเจ้าของ 2026-10-09 (รอบที่ 240): "หน้าแรก = กดเผยแพร่แล้วขึ้นเว็บเลย" ────────────
      เดิมต้องกดสองขั้น (เผยแพร่ → เปิดสวิตช์ "ใช้กับหน้าเว็บจริง") ⇒ ผู้ใช้งงว่า "เผยแพร่แล้วทำไมเว็บไม่เปลี่ยน"
      ⇒ หน้าแรก: เปิด `is_live` ให้เองในขั้นเดียว (หน้าที่เหลือยังไม่ขึ้นเว็บ — เจ้าของ: "ยังไม่เริ่มจริงจัง")
      ⚠️ ต้องเปิด **ก่อน** สั่ง refresh เพื่อให้ ISR สร้างหน้าใหม่จากฉบับที่เผยแพร่แล้ว
    */
    if (publishGoesLive(page)) await setPageLive(page, true, user.email);

    /*
      เผยแพร่สำเร็จแล้ว → ทำให้หน้าเว็บสาธารณะสดใหม่ (X1.7)
      ISR + on-demand revalidate = หน้าเว็บใหม่ทันทีโดยไม่ต้อง build · ถ้าตั้ง REBUILD_HOOK_URL/REBUILD_COMMAND
      (โฮสต์ที่ไม่มี ISR) จึงสั่ง build เพิ่ม · ล้มเหลวก็ไม่ทำให้การเผยแพร่ล้ม
    */
    const refresh = await refreshPublicSite("page");
    const rebuild = refresh.rebuild;

    /* อ่านสถานะจริงหลังเผยแพร่ ⇒ หน้าจอบอกผู้ใช้ได้ตรง ๆ ว่าหน้าเว็บเปลี่ยนหรือยัง (รอบที่ 239) */
    const live = await isPageLive(page);

    return {
      status: "published",
      errors: [],
      warnings: prepared.warnings,
      problems: [],
      revision,
      live,
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

/**
 * ตั้ง/ยกเลิก "กำหนดเวลาเผยแพร่" ของหน้านี้ (X2.7 ส่วนที่ 1 · รอบที่ 100)
 *
 * - ฟอร์มเดียวรองรับสองเจตนาผ่านฟิลด์ `intent` (`set` | `clear`) ⇒ มี useActionState ตัวเดียวบนหน้าจอ
 *   (สอง action แยกกันจะแย่งกันแสดงผลว่าอันไหนใหม่กว่า)
 * - `set` = **บันทึกฉบับร่างบนหน้าจอก่อน** แล้วจึงตั้งกำหนด (เหมือน `publishAction`)
 *   ⇒ "สิ่งที่เห็นตอนตั้งกำหนด = สิ่งที่จะขึ้นเว็บเมื่อถึงเวลา"
 * - `clear` = ไม่ต้องแตะเนื้อหา ⇒ ตั้ง `publish_at = null` ตรง ๆ
 * - เก็บเวลาที่ฝั่งเบราว์เซอร์แปลงเป็น epoch ของ **เขตเวลาผู้ใช้** แล้ว (ดู `parseScheduleEpoch`)
 */
export async function schedulePublishAction(_previous: ScheduleState, formData: FormData): Promise<ScheduleState> {
  const user = await requireAdminUser("content");

  const page = String(formData.get("page") ?? "").trim();
  if (page === "") {
    return { status: "failed", at: null, by: null, problem: "missing-page" };
  }

  if (formData.get("intent") === "clear") {
    try {
      await setPublishSchedule(page, null, user.email);
    } catch {
      return { status: "failed", at: null, by: null, problem: "server" };
    }

    revalidatePath(pathOf(page));
    return { status: "cleared", at: null, by: null, problem: null };
  }

  const prepared = await prepare(page, formData);
  if (!prepared.ok) {
    return { status: "failed", at: null, by: null, problem: "content" };
  }

  const parsed = parseScheduleEpoch(formData.get("at"), new Date());
  if (!parsed.ok) {
    return { status: "failed", at: null, by: null, problem: parsed.problem };
  }

  const at = parsed.at.toISOString();
  try {
    await saveDraft(page, prepared.document, user.email);
    await setPublishSchedule(page, at, user.email);
  } catch {
    return { status: "failed", at: null, by: null, problem: "server" };
  }

  revalidatePath(pathOf(page));
  return { status: "scheduled", at, by: user.email, problem: null };
}

export async function restoreRevisionAction(_previous: BuilderState, formData: FormData): Promise<BuilderState> {
  const user = await requireAdminUser("content");
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
  await requireAdminUser("content");

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

/**
 * **กลับไปใช้ดีไซน์เดิมของเว็บ** = ปิดการใช้บล็อกกับหน้านี้ (รอบที่ 246 · มติเจ้าของ)
 *
 * ที่มา (เคสจริง): เจ้าของถาม *"กลับดีฟอลยังไงครับ"* หลังจัดหน้าแรกด้วยบล็อก — แต่รอบที่ 240
 * เราถอดสวิตช์ "ใช้กับหน้าเว็บจริง" ออกไปแล้ว ⇒ ไม่มีทางถอยกลับจากหลังบ้านเลย
 *
 * กติกาของปุ่มนี้ (ตั้งใจให้ต่างจากสวิตช์เดิม)
 * - **ทิศเดียว**: ปิดเท่านั้น ⇒ ไม่มีทาง "กดผิดแล้วเปิดเว็บทั้งที่ยังไม่พร้อม"
 *   · เปิดใช้อีกครั้ง = กด **"เผยแพร่"** (เส้นทางปกติ ไม่มีปุ่มเพิ่ม)
 * - **ต้องติ๊กยืนยัน** (fail-closed เหมือน `startFromTemplateAction`) ⇒ กันกดพลาด
 * - ใช้ได้เฉพาะเมื่อหน้านี้ใช้บล็อกอยู่จริง (อ่านจาก DB — `decideRevertLayout` ตัวเดียวกับหน้าจอ)
 * - **ไม่แตะเนื้อหา**: ฉบับร่าง/ฉบับเผยแพร่/ประวัติรุ่น ยังอยู่ครบ (แค่หยุดใช้กับหน้าเว็บ)
 * - สั่ง `refreshPublicSite` ให้หน้าเว็บกลับมาใช้เลย์เอาต์โค้ดทันที (ISR) + บันทึก audit
 */
export async function revertToCodeLayoutAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser("content");
  const page = String(formData.get("page") ?? "").trim();

  if (!hasBlockTemplate(page)) redirect(pathOf(page));

  const isLive = await isPageLive(page).catch(() => false);
  const reason = decideRevertLayout({ isLive, confirmValue: String(formData.get("confirm") ?? "") });
  if (reason !== "ok") redirect(`${pathOf(page)}?layout=${reason}`);

  await setPageLive(page, false, user.email);
  await recordAudit({ actorEmail: user.email, action: "layout-revert", target: page, detail: null });

  await refreshPublicSite("page");
  revalidatePath(pathOf(page));
  redirect(`${pathOf(page)}?layout=done`);
}

/**
 * **ล้างประวัติการเผยแพร่** — เก็บเฉพาะรุ่นล่าสุด (รอบที่ 249 · เคสจริงจากเจ้าของ)
 *
 * *"ประวัติการเผยแพร่ นี่เก็บ log จริง แต่ก็ค่อย ๆ ยืดมาเต็มเลยครับ ควรมีลอจิกลบหรือล้างออกบ้าง"*
 * - ระบบมีเพดานอัตโนมัติอยู่แล้ว (`MAX_PAGE_REVISIONS` ตัดตอนเผยแพร่) — ปุ่มนี้สำหรับ "ล้างเดี๋ยวนี้"
 * - **ไม่ลบจนหมด**: เก็บบางรุ่นไว้เสมอ (รุ่นล่าสุด) ⇒ ยังกู้คืนได้
 * - fail-closed: ต้องติ๊กยืนยัน (ค่าคงที่เดียวกับที่หน้าจอใช้) + บันทึก audit
 */
export async function clearRevisionHistoryAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser("content");
  const page = String(formData.get("page") ?? "").trim();
  if (page === "" || !hasBlockTemplate(page)) redirect(pathOf(page));

  if (String(formData.get("confirm") ?? "").trim() !== PRUNE_HISTORY_CONFIRM_VALUE) {
    redirect(`${pathOf(page)}?history=needs-confirm`);
  }

  const removed = await prunePageRevisions(page, 1);
  await recordAudit({ actorEmail: user.email, action: "revisions-prune", target: page, detail: `removed=${removed}` });
  revalidatePath(pathOf(page));
  redirect(`${pathOf(page)}?history=${removed > 0 ? "pruned" : "nothing"}`);
}

/**
 * เริ่มจากเทมเพลตของหน้านั้น (ข้อความชุดเดียวกับหน้าเว็บปัจจุบัน) — ใช้เมื่อยังไม่มีฉบับร่าง
 *
 * ⭐ S2 (รอบที่ 82): อ่านเทมเพลตจาก **ทะเบียนกลาง** (`lib/blocks/templates.ts`) ⇒ ใช้ได้ทุกหน้าที่มีเทมเพลต
 * ⚠️ หน้านี้ไม่มีเทมเพลต = ไม่เขียนอะไร แล้วกลับมาที่หน้าเดิม (UI ไม่แสดงปุ่มให้อยู่แล้ว)
 */
export async function startFromTemplateAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser("content");
  const page = String(formData.get("page") ?? "").trim();

  if (!hasBlockTemplate(page)) redirect(pathOf(page));

  /*
    รอบที่ 225 (เคลียร์หนี้ UX): มีฉบับร่างอยู่ ⇒ **ต้องติ๊กยืนยัน** ก่อนทับ (fail-closed)
    ไม่งั้นแอดมินอาจกดทับงานที่แก้ไว้โดยไม่ตั้งใจ · ไม่มีฉบับร่าง = ไม่ต้องยืนยัน
  */
  const existingDraft = await loadDocumentRow(page, "draft").catch(() => null);
  const decision = decideTemplateApply({
    hasDraft: existingDraft !== null,
    confirmValue: String(formData.get("confirm") ?? ""),
  });
  if (!decision.allowed) redirect(`${pathOf(page)}?template=confirm`);

  const template = buildBlockTemplate(page);
  if (template === null) redirect(pathOf(page));

  /* เทมเพลตต้องผ่าน parser ก่อนเขียนลงฐานข้อมูล (ที่เดียวที่สร้างเอกสารให้ผู้ใช้เริ่ม) */
  const parsed = parseBlockDocument(page, template);
  if (!parsed.ok) redirect(pathOf(page));

  /*
    เก็บ "เลย์เอาต์ของหน้า" ที่ผู้ใช้เลือกไว้ (X1.8) — เทมเพลตคือเรื่องเนื้อหา ไม่ควรทำให้เลย์เอาต์รีเซ็ต
    (อ่านฉบับร่างเดิมก่อนเขียนทับ · อ่านไม่ได้ = ใช้ค่าเริ่มต้นของเทมเพลต ไม่ทำให้ปุ่มพัง)
  */
  let nextDocument: BlockDocument = parsed.document;
  try {
    const current = await loadDocumentRow(page, "draft");
    if (current !== null) {
      const currentParsed = parseBlockDocument(page, current.raw);
      if (currentParsed.ok) {
        /* คัดเฉพาะฟิลด์เลย์เอาต์ที่มีจริง (ทั้งไทยและอังกฤษ — รอบที่ 92) */
        const { layout, layoutEn } = currentParsed.document;
        if (layout !== undefined) nextDocument = { ...nextDocument, layout };
        if (layoutEn !== undefined) nextDocument = { ...nextDocument, layoutEn };
      }
    }
  } catch {
    /* อ่านฉบับร่างเดิมไม่ได้ = ไม่เป็นไร ใช้เลย์เอาต์ของเทมเพลต */
  }

  await saveDraft(page, nextDocument, user.email);
  revalidatePath(pathOf(page));
  redirect(pathOf(page));
}

/**
 * ย้ายรุ่นรูปทรงบล็อกของ "ข้อมูลที่เก็บไว้" (ฉบับร่าง + ฉบับเผยแพร่) ให้เป็นรุ่นปัจจุบัน (X1.1)
 *
 * ตัวอ่าน (`parseBlockDocument`) ย้ายให้อัตโนมัติทุกครั้งอยู่แล้ว ⇒ ปุ่มนี้ไม่ได้ทำให้หน้าเว็บอ่านได้/ไม่ได้
 * แต่ทำให้ **ข้อมูลในฐานข้อมูลสะอาด** (สำรองข้อมูล/ส่งออก/เครื่องมืออื่นที่อ่าน JSONB ตรง ๆ จะเห็นรูปทรงปัจจุบัน)
 * ⚠️ ไม่แตะประวัติการเผยแพร่ — ประวัติคือภาพในอดีต ต้องคงไว้ตามจริง
 */
export async function migrateBlocksAction(_previous: BuilderState, formData: FormData): Promise<BuilderState> {
  const user = await requireAdminUser("content");
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
