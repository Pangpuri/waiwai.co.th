"use server";

import { revalidatePath } from "next/cache";
import { refreshPublicSite } from "@/lib/cache/refresh";

import { type BuilderState } from "@/features/admin/builder-state";
import { requireAdminUser } from "@/lib/auth/dal";
import { publishDraft, saveJsonDraft } from "@/lib/blocks/repository";
import { FOOTER_PAGE_KEY, footerErrorsOf, parseFooterConfig, validateFooterConfig } from "@/lib/chrome/footer";
import { getMessagesFor } from "@/lib/i18n/dictionaries";

/**
 * Server Actions ของ "ท้ายเว็บ" (W3)
 * ลำดับเดียวกับส่วนอื่น: ตรวจสิทธิ์ → parse (ไม่เชื่อเบราว์เซอร์) → validate → บันทึก/เผยแพร่
 * เก็บที่ `page_document` แถว `chrome-footer` ⇒ ได้ฉบับร่าง/เผยแพร่/ประวัติแบบเดียวกัน
 */

const CHROME_PATH = "/admin/builder/chrome";

type Prepared = { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly state: BuilderState };

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
  const parsed = parseFooterConfig(raw, messages);
  if (!parsed.ok) return { ok: false, state: failure(parsed.problems) };

  const errors = footerErrorsOf(validateFooterConfig(parsed.config));
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

export async function saveFooterDraftAction(_previous: BuilderState, formData: FormData): Promise<BuilderState> {
  const user = await requireAdminUser();
  const prepared = await prepare(formData);
  if (!prepared.ok) return prepared.state;

  try {
    await saveJsonDraft(FOOTER_PAGE_KEY, prepared.value, user.email);
  } catch {
    return { status: "failed", errors: [], warnings: [], problems: ["บันทึกลงฐานข้อมูลไม่สำเร็จ"], revision: null };
  }

  revalidatePath(CHROME_PATH);
  return { status: "draft-saved", errors: [], warnings: [], problems: [], revision: null };
}

export async function publishFooterAction(_previous: BuilderState, formData: FormData): Promise<BuilderState> {
  const user = await requireAdminUser();
  const prepared = await prepare(formData);
  if (!prepared.ok) return prepared.state;

  try {
    await saveJsonDraft(FOOTER_PAGE_KEY, prepared.value, user.email);
    const { revision } = await publishDraft(FOOTER_PAGE_KEY, user.email, null);
    revalidatePath(CHROME_PATH);
    await refreshPublicSite("chrome");
    return { status: "published", errors: [], warnings: [], problems: [], revision };
  } catch {
    return { status: "failed", errors: [], warnings: [], problems: ["เผยแพร่ไม่สำเร็จ"], revision: null };
  }
}
