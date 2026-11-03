"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { refreshPublicSite } from "@/lib/cache/refresh";

import { type BuilderState } from "@/features/admin/builder-state";
import { requireAdminUser } from "@/lib/auth/dal";
import {
  loadDocumentRow,
  publishJsonDraftIfCurrent,
  saveJsonDraftIfCurrent,
  type DraftWriteConflict,
} from "@/lib/blocks/repository";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import {
  MOURNING_PAGE_KEY,
  defaultMourningConfig,
  mourningErrorsOf,
  parseMourningConfig,
  validateMourningConfig,
} from "@/lib/mourning/config";

/**
 * Server Actions ของ **ป้ายประกาศเข้าเว็บ** (`page = "mourning"`)
 *
 * ลำดับเดียวกันทุก action: ตรวจสิทธิ์ → parse (ไม่เชื่อเบราว์เซอร์) → validate → บันทึก/เผยแพร่
 * เก็บในตาราง `page_document` แถว `page = "mourning"` ⇒ ได้ประวัติ + การเผยแพร่ชุดเดิม
 *
 * ⚠️ รอบที่ 275 (มติเจ้าของ): **จอ `/admin/builder/mourning` ถูกถอดออก** เพราะซ้ำกับแท็บ
 *    "ป้ายประกาศ" ใน **ส่วนกลางของเว็บ** (`/admin/builder/chrome?part=notice`) ที่ใช้ actions ชุดนี้อยู่แล้ว
 *    ⇒ พาธปลายทางหลังบันทึก/ยกเลิก ชี้ไปที่จอที่เหลืออยู่เพียงที่เดียว
 */
const MOURNING_PATH = "/admin/builder/chrome?part=notice";

type Prepared =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly state: BuilderState };

function failure(problems: readonly string[]): BuilderState {
  return { status: "invalid", errors: [], warnings: [], problems, revision: null };
}

function expectedVersionOf(formData: FormData): string | null {
  const value = formData.get("version");
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function conflictState(conflict: DraftWriteConflict): BuilderState {
  return { status: "conflict", errors: [], warnings: [], problems: [], revision: null, conflict };
}

async function prepare(formData: FormData): Promise<Prepared> {
  const payload = formData.get("payload");
  if (typeof payload !== "string" || payload.trim() === "") {
    return { ok: false, state: failure(["ไม่พบข้อมูลที่ส่งมาจากหน้าจอ"]) };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(payload);
  } catch {
    return { ok: false, state: failure(["ข้อมูลที่ส่งมาไม่ใช่ JSON ที่อ่านได้"]) };
  }

  const messages = await getMessagesFor("th");
  const parsed = parseMourningConfig(raw, messages);
  if (!parsed.ok) return { ok: false, state: failure(parsed.problems) };

  const errors = mourningErrorsOf(validateMourningConfig(parsed.config));
  if (errors.length > 0) {
    return {
      ok: false,
      state: {
        status: "invalid",
        errors: errors.map((entry) => ({ code: entry.code, path: entry.path, detail: entry.detail })),
        warnings: [],
        problems: [],
        revision: null,
      },
    };
  }

  return { ok: true, value: parsed.config };
}

export async function saveMourningDraftAction(_previous: BuilderState, formData: FormData): Promise<BuilderState> {
  const user = await requireAdminUser("presets");
  const prepared = await prepare(formData);
  if (!prepared.ok) return prepared.state;

  try {
    const saved = await saveJsonDraftIfCurrent(
      MOURNING_PAGE_KEY,
      prepared.value,
      user.email,
      expectedVersionOf(formData),
    );
    if (!saved.ok) return conflictState(saved.conflict);

    revalidatePath(MOURNING_PATH);
    return {
      status: "draft-saved",
      errors: [],
      warnings: [],
      problems: [],
      revision: null,
      draftVersion: saved.version,
    };
  } catch {
    return { status: "failed", errors: [], warnings: [], problems: ["บันทึกลงฐานข้อมูลไม่สำเร็จ"], revision: null };
  }
}

export async function publishMourningAction(_previous: BuilderState, formData: FormData): Promise<BuilderState> {
  const user = await requireAdminUser("presets");
  const prepared = await prepare(formData);
  if (!prepared.ok) return prepared.state;

  try {
    const saved = await saveJsonDraftIfCurrent(
      MOURNING_PAGE_KEY,
      prepared.value,
      user.email,
      expectedVersionOf(formData),
    );
    if (!saved.ok) return conflictState(saved.conflict);

    const published = await publishJsonDraftIfCurrent(MOURNING_PAGE_KEY, user.email, null, saved.version);
    if (!published.ok) return conflictState(published.conflict);

    revalidatePath(MOURNING_PATH);
    /* ป้ายประกาศอยู่ทุกหน้า ⇒ ทำให้หน้าเว็บสาธารณะสดใหม่ทั้งเว็บ (X1.7) */
    await refreshPublicSite("mourning");
    return {
      status: "published",
      errors: [],
      warnings: [],
      problems: [],
      revision: published.revision,
      draftVersion: saved.version,
    };
  } catch {
    return { status: "failed", errors: [], warnings: [], problems: ["เผยแพร่ไม่สำเร็จ"], revision: null };
  }
}

/** คืนค่าเริ่มต้นจากโค้ด/พจนานุกรม (ใช้เมื่ออยากเริ่มใหม่ ไม่แตะฉบับที่เผยแพร่อยู่จนกว่าจะกดเผยแพร่) */
export async function resetMourningToDefaultsAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser("presets");
  const messages = await getMessagesFor("th");
  const saved = await saveJsonDraftIfCurrent(
    MOURNING_PAGE_KEY,
    defaultMourningConfig(messages),
    user.email,
    expectedVersionOf(formData),
  );
  if (!saved.ok) redirect(`${MOURNING_PATH}&conflict=1`);
  revalidatePath(MOURNING_PATH);
}

/* ── ควบคุมจากหน้าอื่น (ผู้ใช้สั่ง รอบที่ 38: "คอนโทรลจากการคลิกหน้า /admin/builder/home หรือโยนภาพเข้าตรง ๆ") ── */

/** โหลดฉบับร่างของป้ายประกาศ + version (ถ้ายังไม่มี = ค่าเริ่มต้นในโค้ด) */
async function loadDraftState() {
  const messages = await getMessagesFor("th");
  const row = await loadDocumentRow(MOURNING_PAGE_KEY, "draft");
  if (row === null) return { config: defaultMourningConfig(messages), version: null };

  const parsed = parseMourningConfig(row.raw, messages);
  return {
    config: parsed.ok ? parsed.config : defaultMourningConfig(messages),
    version: row.version,
  };
}

/** เปิด/ปิดป้ายประกาศจากหน้าอื่น (บันทึกเป็นฉบับร่าง) */
export async function setNoticeEnabledAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser("presets");
  const next = formData.get("enabled") === "1";

  /*
    อ่านค่าล่าสุดแล้วเขียนแบบ guarded — ถ้ามีคนแก้ระหว่างอ่าน/เขียนจะลองใหม่หนึ่งครั้ง
    (การสลับเปิด/ปิดเป็นเจตนาเฉพาะฟิลด์เดียว ไม่ควรทับงานที่เพิ่งแก้)
  */
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const current = await loadDraftState();
    const saved = await saveJsonDraftIfCurrent(
      MOURNING_PAGE_KEY,
      { ...current.config, enabled: next },
      user.email,
      current.version,
    );
    if (saved.ok) break;
  }

  revalidatePath(MOURNING_PATH);
  await refreshPublicSite("mourning");
}

/** เผยแพร่ป้ายประกาศตามค่าล่าสุดที่บันทึกไว้ (ไม่ต้องส่งข้อมูลจากหน้าจอ) */
export async function publishNoticeAction(): Promise<void> {
  const user = await requireAdminUser("presets");

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const row = await loadDocumentRow(MOURNING_PAGE_KEY, "draft");
    if (row === null) break;
    const published = await publishJsonDraftIfCurrent(MOURNING_PAGE_KEY, user.email, null, row.version);
    if (published.ok) break;
  }

  revalidatePath(MOURNING_PATH);
  await refreshPublicSite("mourning");
}
