"use server";

import { revalidatePath } from "next/cache";
import { refreshPublicSite } from "@/lib/cache/refresh";

import { type BuilderState } from "@/features/admin/builder-state";
import { requireAdminUser } from "@/lib/auth/dal";
import { loadDocumentRow, publishDraft, saveJsonDraft } from "@/lib/blocks/repository";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import {
  MOURNING_PAGE_KEY,
  defaultMourningConfig,
  mourningErrorsOf,
  parseMourningConfig,
  validateMourningConfig,
} from "@/lib/mourning/config";

/**
 * Server Actions ของหน้าจอ "ป๊อปอัพไว้อาลัย"
 *
 * ลำดับเดียวกันทุก action: ตรวจสิทธิ์ → parse (ไม่เชื่อเบราว์เซอร์) → validate → บันทึก/เผยแพร่
 * เก็บในตาราง `page_document` แถว `page = "mourning"` ⇒ ได้ประวัติ + การเผยแพร่ชุดเดิม
 */

const MOURNING_PATH = "/admin/builder/mourning";

type Prepared =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly state: BuilderState };

function failure(problems: readonly string[]): BuilderState {
  return { status: "invalid", errors: [], warnings: [], problems, revision: null };
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
  const user = await requireAdminUser();
  const prepared = await prepare(formData);
  if (!prepared.ok) return prepared.state;

  try {
    await saveJsonDraft(MOURNING_PAGE_KEY, prepared.value, user.email);
  } catch {
    return { status: "failed", errors: [], warnings: [], problems: ["บันทึกลงฐานข้อมูลไม่สำเร็จ"], revision: null };
  }

  revalidatePath(MOURNING_PATH);
  return { status: "draft-saved", errors: [], warnings: [], problems: [], revision: null };
}

export async function publishMourningAction(_previous: BuilderState, formData: FormData): Promise<BuilderState> {
  const user = await requireAdminUser();
  const prepared = await prepare(formData);
  if (!prepared.ok) return prepared.state;

  try {
    await saveJsonDraft(MOURNING_PAGE_KEY, prepared.value, user.email);
    const { revision } = await publishDraft(MOURNING_PAGE_KEY, user.email, null);
    revalidatePath(MOURNING_PATH);
    /* ป้ายประกาศอยู่ทุกหน้า ⇒ ทำให้หน้าเว็บสาธารณะสดใหม่ทั้งเว็บ (X1.7) */
    await refreshPublicSite("mourning");
    return { status: "published", errors: [], warnings: [], problems: [], revision };
  } catch {
    return { status: "failed", errors: [], warnings: [], problems: ["เผยแพร่ไม่สำเร็จ"], revision: null };
  }
}

/** คืนค่าเริ่มต้นจากโค้ด/พจนานุกรม (ใช้เมื่ออยากเริ่มใหม่ ไม่แตะฉบับที่เผยแพร่อยู่จนกว่าจะกดเผยแพร่) */
export async function resetMourningToDefaultsAction(): Promise<void> {
  const user = await requireAdminUser();
  const messages = await getMessagesFor("th");
  await saveJsonDraft(MOURNING_PAGE_KEY, defaultMourningConfig(messages), user.email);
  revalidatePath(MOURNING_PATH);
}

/* ── ควบคุมจากหน้าอื่น (ผู้ใช้สั่ง รอบที่ 38: "คอนโทรลจากการคลิกหน้า /admin/builder/home หรือโยนภาพเข้าตรง ๆ") ── */

/** โหลดฉบับร่างของป้ายประกาศ (ถ้ายังไม่มี = ค่าเริ่มต้นในโค้ด) */
async function loadDraftConfig() {
  const messages = await getMessagesFor("th");
  const row = await loadDocumentRow(MOURNING_PAGE_KEY, "draft");
  if (row === null) return defaultMourningConfig(messages);

  const parsed = parseMourningConfig(row.raw, messages);
  return parsed.ok ? parsed.config : defaultMourningConfig(messages);
}

/** เปิด/ปิดป้ายประกาศจากหน้าอื่น (บันทึกเป็นฉบับร่าง) */
export async function setNoticeEnabledAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser();
  const next = formData.get("enabled") === "1";

  const config = await loadDraftConfig();
  await saveJsonDraft(MOURNING_PAGE_KEY, { ...config, enabled: next }, user.email);

  revalidatePath(MOURNING_PATH);
  await refreshPublicSite("mourning");
}

/** เผยแพร่ป้ายประกาศตามค่าล่าสุดที่บันทึกไว้ (ไม่ต้องส่งข้อมูลจากหน้าจอ) */
export async function publishNoticeAction(): Promise<void> {
  const user = await requireAdminUser();
  await publishDraft(MOURNING_PAGE_KEY, user.email, null);

  revalidatePath(MOURNING_PATH);
  await refreshPublicSite("mourning");
}
