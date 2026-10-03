import { getPool } from "@/db/pool";
import { recordAudit } from "@/lib/audit/log";
import { loadDocumentRow, saveJsonDraft } from "@/lib/blocks/repository";
import {
  MAX_CHROME_PRESETS_PER_KIND,
  chromePresetPageKey,
  defaultChromePresetPayload,
  chromePresetsAreFull,
  newChromePresetId,
  normalizeChromePresetName,
  parseChromePresetPayload,
  validateChromePresetConfig,
  type ChromePreset,
  type ChromePresetKind,
  type ChromePresetPayload,
} from "@/lib/chrome/presets";
import { isDatabaseConfigured } from "@/lib/content/repository";
import type { Messages } from "@/lib/i18n/messages/th";

/**
 * พรีเซ็ตของส่วนกลางของเว็บ (W3b) — **ชั้นที่แตะฐานข้อมูล**
 *
 * สามฉากที่ผู้ใช้ขอไว้ (รอบที่ 58)
 * - **ของเก่า** = แถว `published` ของส่วนนั้น → `saveChromePresetFromRow({ source: "published" })` ใช้ "ดึงของเก่ามาเก็บเป็นชุด"
 * - **ของใหม่** = แถว `draft` ของส่วนนั้น → `applyChromePreset()` **เขียนทับเฉพาะฉบับร่าง** (เว็บจริงยังไม่เปลี่ยนจนกดเผยแพร่)
 * - **พรีเซ็ต** = ตาราง `chrome_preset` → `listChromePresets()` / `saveChromePresetFromRow()` (ลบ = `trashChromePreset()`)
 *
 * กติกาความปลอดภัย/ความถูกต้อง
 * - payload ที่จะบันทึก **ต้องผ่าน parser + validator ของส่วนนั้น** ก่อน (ห้ามเก็บชุดที่ใช้ไม่ได้ลงคลัง)
 * - ตอนอ่าน **ตรวจซ้ำทุกครั้ง** (แถวที่อ่านไม่ได้ = ข้าม ไม่ทำให้หน้าจอพัง)
 * - ชื่อซ้ำ (ไม่สนตัวพิมพ์) ภายในชนิดเดียวกัน = เขียนทับของเดิม · ชื่อซ้ำกับของในถัง = กู้คืนอัตโนมัติ (เหมือนพรีเซ็ตบล็อก)
 * - ทุกการบันทึก/ใช้ชุด ลง audit log
 * - **ไม่มี `DATABASE_URL` = คืนค่าว่าง/`null`** ไม่โยน error
 */

type ChromePresetRow = {
  readonly id: string;
  readonly kind: string;
  readonly name: string;
  readonly payload: unknown;
  readonly created_at: Date;
  readonly updated_at: Date;
  readonly created_by: string | null;
};

function toPreset(row: ChromePresetRow, messages: Messages): ChromePreset | null {
  if (row.kind !== "navbar" && row.kind !== "footer" && row.kind !== "mourning") return null;

  const payload = parseChromePresetPayload(row.kind, row.payload, messages);
  if (payload === null) return null;

  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    payload,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    createdBy: row.created_by,
  };
}

/** พรีเซ็ตที่ใช้งานอยู่ทั้งหมด (ไม่รวมของในถัง) — เรียงใหม่สุดก่อน · แถวที่อ่านไม่ได้ถูกข้าม */
export async function listChromePresets(messages: Messages): Promise<readonly ChromePreset[]> {
  if (!isDatabaseConfigured()) return [];

  const { rows } = await getPool().query<ChromePresetRow>(
    `select id, kind, name, payload, created_at, updated_at, created_by
       from chrome_preset
      where deleted_at is null
      order by created_at desc
      limit $1`,
    [MAX_CHROME_PRESETS_PER_KIND * 3],
  );

  return rows.map((row) => toPreset(row, messages)).filter((preset): preset is ChromePreset => preset !== null);
}

export async function countChromePresets(kind: ChromePresetKind): Promise<number> {
  if (!isDatabaseConfigured()) return 0;

  const { rows } = await getPool().query<{ readonly n: number }>(
    "select count(*)::int as n from chrome_preset where kind = $1 and deleted_at is null",
    [kind],
  );
  return rows[0]?.n ?? 0;
}

/** เลือก payload ตามชนิดจากค่าดิบที่อ่านจากฐานข้อมูล (คืน `null` ถ้าชุดนั้นใช้ไม่ได้) */
function payloadFromRaw(kind: ChromePresetKind, raw: unknown, messages: Messages): ChromePresetPayload | null {
  return parseChromePresetPayload(kind, raw, messages);
}

export type SaveChromePresetResult =
  | { readonly ok: true; readonly id: string; readonly replaced: boolean; readonly fromDefault: boolean }
  | { readonly ok: false; readonly reason: "no-database" | "bad-name" | "invalid" | "too-many" };

/**
 * บันทึกชุดปัจจุบันเป็นพรีเซ็ต
 *
 * `source` เลือกว่าจะเก็บ "ของใหม่" (ฉบับร่างที่กำลังแก้ — ค่าตั้งต้น) หรือ "ของเก่า" (ฉบับที่เว็บใช้อยู่)
 * ⇒ ตรงกับที่ผู้ใช้ขอ: *"มีของเก่าเก็บไว้ในฐานข้อมูลและโชว์ก่อน"* — กดเก็บของเก่าไว้ก่อนแก้ก็ได้
 */
export async function saveChromePresetFromRow(input: {
  readonly kind: ChromePresetKind;
  readonly name: string;
  readonly source: "draft" | "published";
  readonly actor: string;
  readonly messages: Messages;
}): Promise<SaveChromePresetResult> {
  if (!isDatabaseConfigured()) return { ok: false, reason: "no-database" };

  const name = normalizeChromePresetName(input.name);
  if (name === null) return { ok: false, reason: "bad-name" };

  /* เต็มเพดานไหม — เช็คก่อน เพื่อไม่ให้คลังบวมไม่จำกัด (ชื่อซ้ำเขียนทับได้เสมอ ไม่นับรวม) */
  const existing = await listChromePresets(input.messages);
  const sameName = existing.find((preset) => preset.kind === input.kind && preset.name.toLowerCase() === name.toLowerCase());
  const active = existing.filter((preset) => preset.kind === input.kind).length;
  if (sameName === undefined && chromePresetsAreFull(active)) return { ok: false, reason: "too-many" };

  /*
    อ่าน "ของเก่า/ของใหม่" จากฐานข้อมูล · ถ้ายังไม่มีแถวเลย (เพิ่งเริ่มใช้) ⇒ เก็บ **ค่าเริ่มต้น**
    ของส่วนนั้นให้ (นั่นคือสิ่งที่เว็บใช้อยู่จริงตอนนี้) — ไม่ต้องไปกดบันทึกเปล่า ๆ ก่อน
  */
  const row = await loadDocumentRow(chromePresetPageKey(input.kind), input.source);
  const fromDefault = row === null;

  const payload = fromDefault
    ? defaultChromePresetPayload(input.kind, input.messages)
    : payloadFromRaw(input.kind, row.raw, input.messages);
  if (payload === null) return { ok: false, reason: "invalid" };

  const errors = validateChromePresetConfig(payload);
  if (errors.length > 0) return { ok: false, reason: "invalid" };

  const id = sameName?.id ?? newChromePresetId();

  /* ชื่อซ้ำ (ไม่สนตัวพิมพ์) ในชนิดเดียวกัน = เขียนทับ + ล้างสถานะถังขยะ (กู้คืนอัตโนมัติ) */
  await getPool().query(
    `insert into chrome_preset (id, kind, name, payload, created_by)
       values ($1, $2, $3, $4::jsonb, $5)
     on conflict (kind, lower(name)) do update set
       name = excluded.name,
       payload = excluded.payload,
       updated_at = now(),
       created_by = excluded.created_by,
       deleted_at = null,
       deleted_by = null`,
    [id, input.kind, name, JSON.stringify(payload.config), input.actor],
  );

  await recordAudit({
    action: "chrome-preset-save",
    actorEmail: input.actor,
    target: `${input.kind}:${name}`,
    detail: `source=${fromDefault ? "default" : input.source}${sameName === undefined ? "" : " overwrite"}`,
  });

  return { ok: true, id, replaced: sameName !== undefined, fromDefault };
}

export type ApplyChromePresetResult =
  | { readonly ok: true; readonly kind: ChromePresetKind; readonly name: string }
  | { readonly ok: false; readonly reason: "no-database" | "not-found" | "invalid" };

/**
 * "ใช้ชุดนี้" — เขียนชุดที่เลือกทับ **ฉบับร่างของส่วนนั้น**
 *
 * 🔑 ไม่แตะฉบับเผยแพร่ (เว็บจริงยังเป็นของเดิม = "ของเก่า") ⇒ ผู้ใช้ดูพรีวิวแล้วค่อยกดเผยแพร่เอง
 * ⚠️ ชุดที่ตรวจไม่ผ่าน = ไม่เขียน (กันค่าที่ใช้ไม่ได้หลุดเข้าฉบับร่าง)
 */
export async function applyChromePreset(input: {
  readonly kind: ChromePresetKind;
  readonly id: string;
  readonly actor: string;
  readonly messages: Messages;
}): Promise<ApplyChromePresetResult> {
  if (!isDatabaseConfigured()) return { ok: false, reason: "no-database" };

  const { rows } = await getPool().query<ChromePresetRow>(
    `select id, kind, name, payload, created_at, updated_at, created_by
       from chrome_preset
      where id = $1 and kind = $2 and deleted_at is null`,
    [input.id, input.kind],
  );

  const row = rows[0];
  if (row === undefined) return { ok: false, reason: "not-found" };

  const preset = toPreset(row, input.messages);
  if (preset === null) return { ok: false, reason: "invalid" };

  const errors = validateChromePresetConfig(preset.payload);
  if (errors.length > 0) return { ok: false, reason: "invalid" };

  const pageKey = chromePresetPageKey(input.kind);

  /*
    เก็บ "ฉบับร่างก่อนใช้ชุด" ไว้ 1 ชุดต่อส่วน (รอบที่ 81)
    ⇒ เผลอกดใช้ชุดแล้วยังย้อนกลับได้ทันทีด้วยปุ่มเดียว (ก่อนหน้านี้ไม่มีทางย้อนเลย)
    ⚠️ ไม่มีฉบับร่างอยู่ = ไม่มีอะไรให้ย้อน ⇒ ไม่ต้องเขียนแถว (ปุ่มย้อนกลับจะบอกว่า "ไม่มีให้ย้อน")
  */
  const currentDraft = await loadDocumentRow(pageKey, "draft");
  if (currentDraft !== null) {
    await getPool().query(
      `insert into chrome_draft_undo (page, payload, replaced_at, replaced_by, preset_name)
         values ($1, $2::jsonb, now(), $3, $4)
       on conflict (page) do update set
         payload = excluded.payload,
         replaced_at = excluded.replaced_at,
         replaced_by = excluded.replaced_by,
         preset_name = excluded.preset_name`,
      [pageKey, JSON.stringify(currentDraft.raw), input.actor, preset.name],
    );
  }

  /*
    ทุกส่วนในนี้เก็บเป็น JSON ธรรมดายกเว้น navbar ที่มีตัวจัดเรียงเมนูจากตาราง `page` (W1)
    ⇒ ใช้ `saveJsonDraft` กับทุกส่วน: ค่าที่เก็บเป็นชุดดิบของส่วนนั้น (ไม่ใช่เอกสารบล็อก)
  */
  await saveJsonDraft(pageKey, preset.payload.config, input.actor);

  await recordAudit({
    action: "chrome-preset-apply",
    actorEmail: input.actor,
    target: `${input.kind}:${preset.name}`,
    detail: `draft <- preset ${preset.id}`,
  });

  return { ok: true, kind: input.kind, name: preset.name };
}

/*
  ⚠️ **การลบพรีเซ็ตของส่วนกลางย้ายไปถังขยะกลาง (X2.4)** — ไม่มีฟังก์ชันลบถาวรในไฟล์นี้
     ให้ใช้ `trashChromePreset()` ใน `lib/trash/repository.ts` (กู้คืนได้จาก /admin/trash)
*/

/** ข้อมูลย้อนกลับที่หน้าจอต้องรู้ (มี/ไม่มี + ย้อนจากชุดไหนเมื่อไร) */
export type ChromeDraftUndoInfo = {
  readonly replacedAt: string;
  readonly replacedBy: string | null;
  readonly presetName: string | null;
};

type UndoRow = {
  readonly payload: unknown;
  readonly replaced_at: Date;
  readonly replaced_by: string | null;
  readonly preset_name: string | null;
};

/** ฉบับร่างก่อนใช้ชุดของส่วนนี้ — `null` = ไม่มีให้ย้อน (ยังไม่เคยกดใช้ชุด หรือย้อนไปแล้ว) */
export async function readChromeDraftUndo(kind: ChromePresetKind): Promise<ChromeDraftUndoInfo | null> {
  if (!isDatabaseConfigured()) return null;

  const { rows } = await getPool().query<UndoRow>(
    `select payload, replaced_at, replaced_by, preset_name from chrome_draft_undo where page = $1`,
    [chromePresetPageKey(kind)],
  );

  const row = rows[0];
  if (row === undefined) return null;

  return {
    replacedAt: new Date(row.replaced_at).toISOString(),
    replacedBy: row.replaced_by,
    presetName: row.preset_name,
  };
}

export type UndoChromePresetResult =
  | { readonly ok: true; readonly kind: ChromePresetKind }
  | { readonly ok: false; readonly reason: "no-database" | "not-found" | "invalid" };

/**
 * "ย้อนกลับ" — เขียนฉบับร่างก่อนใช้ชุดกลับคืน **แล้วลบข้อมูลย้อนกลับ** (ย้อนได้ครั้งเดียว)
 *
 * 🔑 ยังไม่แตะฉบับเผยแพร่ — เหมือนการ "ใช้ชุด": ผู้ใช้ต้องกดเผยแพร่เองอีกครั้ง
 * ⚠️ payload ที่เก็บไว้อาจเป็นรูปทรงของโค้ดรุ่นก่อน ⇒ **ต้องผ่าน parser ของส่วนนั้นก่อนเขียนกลับ**
 */
export async function undoChromePreset(input: {
  readonly kind: ChromePresetKind;
  readonly actor: string;
  readonly messages: Messages;
}): Promise<UndoChromePresetResult> {
  if (!isDatabaseConfigured()) return { ok: false, reason: "no-database" };

  const pageKey = chromePresetPageKey(input.kind);
  const { rows } = await getPool().query<UndoRow>(
    `select payload, replaced_at, replaced_by, preset_name from chrome_draft_undo where page = $1`,
    [pageKey],
  );

  const row = rows[0];
  if (row === undefined) return { ok: false, reason: "not-found" };

  const payload = parseChromePresetPayload(input.kind, row.payload, input.messages);
  if (payload === null) return { ok: false, reason: "invalid" };

  await saveJsonDraft(pageKey, payload.config, input.actor);

  /* ย้อนกลับสำเร็จ ⇒ ลบข้อมูลย้อนกลับ (กันกดซ้ำสลับไปสลับมาโดยไม่รู้ตัว) */
  await getPool().query(`delete from chrome_draft_undo where page = $1`, [pageKey]);

  await recordAudit({
    action: "chrome-preset-undo",
    actorEmail: input.actor,
    target: `${input.kind}:${row.preset_name ?? "preset"}`,
    detail: "draft <- previous draft",
  });

  return { ok: true, kind: input.kind };
}
