"use server";

import { revalidatePath } from "next/cache";

import { type BuilderState } from "@/features/admin/builder-state";
import { requireAdminUser } from "@/lib/auth/dal";
import { publishDraft, saveJsonDraft } from "@/lib/blocks/repository";
import { NAVBAR_PAGE_KEY, navbarErrorsOf, parseNavbarConfig, validateNavbarConfig } from "@/lib/chrome/navbar";
import { getMessagesFor } from "@/lib/i18n/dictionaries";

/**
 * Server Actions ของ "แถบเมนู (navbar)" (ผู้ใช้สั่ง รอบที่ 53)
 *
 * ลำดับเดียวกันทุก action: ตรวจสิทธิ์ → parse (ไม่เชื่อเบราว์เซอร์) → validate → บันทึก/เผยแพร่
 * เก็บใน `page_document` แถว `page = "chrome-navbar"` ⇒ ได้ฉบับร่าง/เผยแพร่/ประวัติ เหมือนหน้าอื่น
 *
 * หลังเผยแพร่ต้อง rebuild หน้าเว็บ (มติ D1) — กลไกเดิมที่หน้าสร้างหน้าเว็บ (REBUILD_HOOK_URL / REBUILD_COMMAND)
 */

const BUILDER_PATH = "/admin/builder/home";

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
  const parsed = parseNavbarConfig(raw, messages);
  if (!parsed.ok) return { ok: false, state: failure(parsed.problems) };

  const errors = navbarErrorsOf(validateNavbarConfig(parsed.config));
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

export async function saveNavbarDraftAction(_previous: BuilderState, formData: FormData): Promise<BuilderState> {
  const user = await requireAdminUser();
  const prepared = await prepare(formData);
  if (!prepared.ok) return prepared.state;

  try {
    await saveJsonDraft(NAVBAR_PAGE_KEY, prepared.value, user.email);
  } catch {
    return { status: "failed", errors: [], warnings: [], problems: ["บันทึกลงฐานข้อมูลไม่สำเร็จ"], revision: null };
  }

  revalidatePath(BUILDER_PATH);
  return { status: "draft-saved", errors: [], warnings: [], problems: [], revision: null };
}

export async function publishNavbarAction(_previous: BuilderState, formData: FormData): Promise<BuilderState> {
  const user = await requireAdminUser();
  const prepared = await prepare(formData);
  if (!prepared.ok) return prepared.state;

  try {
    await saveJsonDraft(NAVBAR_PAGE_KEY, prepared.value, user.email);
    const { revision } = await publishDraft(NAVBAR_PAGE_KEY, user.email, null);
    revalidatePath(BUILDER_PATH);
    return { status: "published", errors: [], warnings: [], problems: [], revision };
  } catch {
    return { status: "failed", errors: [], warnings: [], problems: ["เผยแพร่ไม่สำเร็จ"], revision: null };
  }
}
