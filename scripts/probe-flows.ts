import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { getPool } from "@/db/pool";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { hashSessionId } from "@/lib/auth/sessions-repository";
import { isDatabaseConfigured } from "@/lib/content/repository";
import { th } from "@/lib/i18n/messages/th";
import { searchMedia } from "@/lib/media/repository";
import { storeImageFile } from "@/lib/media/upload";
import { findPage } from "@/lib/pages/repository";
import { listProductsForAdmin } from "@/lib/products/repository";
import { formFieldsOf, formWithField, formWithFileInput, formsOf } from "@/lib/probe/forms";
import { isLocalProbeUrl, selectProbeFlows, type ProbeFlowId } from "@/lib/probe/flow-plan";
import { mintProbeSession, releaseProbeSession, type ProbeSession } from "./probe-session.ts";

/**
 * flow หลายขั้นของเครื่องมือ probe (รอบที่ 293) — **ฝั่งเซิร์ฟเวอร์เท่านั้น (แตะ DB)**
 *
 * flow ที่เคยพิสูจน์ด้วยสคริปต์ชั่วคราวใน `.next` (รอบ 292) แล้วถูกย้ายมาเป็นของถาวร:
 * จำกัดการล็อกอิน · เพิกถอนเซสชัน · ด่านอัปโหลดภาพ · ลิงก์พรีวิว · **SQL injection (รอบ 294)** · **ฟอร์มติดต่อถึงกล่องข้อความ (รอบ 296)**
 *
 * วินัยที่บังคับในไฟล์นี้
 * - **refuse ถ้าไม่ใช่เซิร์ฟเวอร์ในเครื่อง** (ยกเว้น `--allow-remote`) — flow มีการเขียนแถวจริง
 * - ทุก flow **เก็บกวาดของตัวเอง** ใน `finally` และรายงานว่าเก็บอะไร
 * - **ตัดสินจากหลักฐานที่เชื่อได้**: จำนวนแถวก่อน/หลัง · สถานะ HTTP · เหตุผลระดับฟังก์ชัน
 *   (ไม่ใช้การ grep ข้อความพจนานุกรม — บทเรียนรอบ 117/291/292)
 * - **ไม่ใช้รหัสผ่านของเจ้าของ** และ **ไม่แตะเนื้อหาจริง** (ใช้ข้อมูลทิ้ง/ไฟล์ทิ้งแล้วลบ)
 */

export type FlowStep = {
  readonly label: string;
  readonly ok: boolean;
  readonly detail: string;
};

export type FlowOutcome = {
  readonly id: ProbeFlowId;
  readonly title: string;
  readonly steps: readonly FlowStep[];
  readonly cleanup: string;
  readonly ok: boolean;
};

export type FlowRunResult = {
  readonly outcomes: readonly FlowOutcome[];
  /** เหตุผลที่ข้ามทั้งชุด (ไม่ใช่ "ผ่าน") */
  readonly skippedReason: string | null;
};

type FlowDeps = {
  readonly baseUrl: string;
  /** เซสชันผู้ดูแลที่มินต์ไว้ให้ flow (null = ไม่มี ⇒ flow ที่ต้องใช้ sẽถูกรายงานว่าไม่ผ่าน) */
  readonly session: ProbeSession | null;
};

/* ── ตัวช่วย HTTP ─────────────────────────────────────────────────────────── */

function adminHeaders(session: ProbeSession | null): Record<string, string> {
  const headers: Record<string, string> = { "user-agent": "waiwai-probe-flows/1.0" };
  if (session !== null) headers.cookie = `${SESSION_COOKIE_NAME}=${session.cookie}`;
  return headers;
}

async function getStatus(url: string, session: ProbeSession | null): Promise<{ status: number; body: string }> {
  const response = await fetch(url, { redirect: "manual", headers: adminHeaders(session) });
  return { status: response.status, body: await response.text() };
}

/**
 * ส่งฟอร์มแบบ no-JS (multipart) · `override` = แทนที่ค่าช่องที่มีชื่อซ้ำ (เช่น `page`)
 * `fileFieldName` = ชื่อช่องไฟล์ในฟอร์มนั้น (ฟอร์มสมัครงานใช้ `resume` · ตัวอื่นใช้ `file`)
 */
async function postForm(
  url: string,
  form: string,
  session: ProbeSession | null,
  override: Readonly<Record<string, string>> = {},
  file: { readonly bytes: Uint8Array<ArrayBuffer>; readonly name: string; readonly mime: string } | null = null,
  fileFieldName = "file",
): Promise<{ status: number; body: string }> {
  const body = new FormData();
  const replaceNames = new Set(Object.keys(override));

  for (const [name, value] of formFieldsOf(form)) {
    if (replaceNames.has(name)) continue;
    body.append(name, value);
  }
  for (const [name, value] of Object.entries(override)) body.append(name, value);
  if (file !== null) body.append(fileFieldName, new Blob([file.bytes], { type: file.mime }), file.name);

  const response = await fetch(url, { method: "POST", redirect: "manual", headers: { ...adminHeaders(session), origin: new URL(url).origin }, body });
  return { status: response.status, body: await response.text() };
}

/** ข้อความ **ในกล่อง alert ที่เรนเดอร์จริง** เท่านั้น (ไม่ใช่ข้อความใน RSC payload ที่มีทุกหน้า) */
function alertTextOf(html: string): string {
  return /<p role="alert"[^>]*>([\s\S]*?)<\/p>/.exec(html)?.[1]?.trim() ?? "";
}

/** ข้อความต้นของพจนานุกรม (ก่อนตัวแทนค่า `{n}`) — ไม่พิมพ์ข้อความซ้ำในโค้ด */
function dictionaryPrefix(text: string): string {
  const marker = text.indexOf("{");
  return marker === -1 ? text : text.slice(0, marker).trim();
}

const cleanupNotes: string[] = [];

/* ── flow 1: จำกัดการล็อกอินผิดซ้ำ ─────────────────────────────────────────── */

async function runRateLimitFlow(deps: FlowDeps): Promise<FlowOutcome> {
  const email = `probe-flow-${String(Date.now())}@example.com`;
  const steps: FlowStep[] = [];
  const lockedPrefix = dictionaryPrefix(th.admin.loginLocked);
  const invalidText = th.admin.errorInvalid;

  try {
    const login = await getStatus(`${deps.baseUrl}/admin/login`, null);
    const form = formsOf(login.body).find((candidate) => /name="password"/.test(candidate));

    if (form === undefined) {
      steps.push({ label: "อ่านฟอร์มล็อกอินจากหน้า /admin/login", ok: false, detail: "ไม่พบฟอร์ม" });
      return { id: "rate-limit", title: "จำกัดการล็อกอินผิดซ้ำ", steps, cleanup: "ไม่มีอะไรต้องเก็บ", ok: false };
    }

    let firstLockedAttempt: number | null = null;
    let invalidSeen = 0;

    for (let attempt = 1; attempt <= 7; attempt += 1) {
      const result = await postForm(`${deps.baseUrl}/admin/login`, form, null, { email, password: "definitely-not-the-password" });
      const alert = alertTextOf(result.body);
      if (alert.startsWith(lockedPrefix)) firstLockedAttempt ??= attempt;
      else if (alert.includes(invalidText)) invalidSeen += 1;
    }

    steps.push({
      label: "ครั้งที่ 1–5 = รหัสผิดปกติ · ครั้งที่ 6 = เริ่มล็อก",
      ok: invalidSeen === 5 && firstLockedAttempt === 6,
      detail: `รหัสผิด ${String(invalidSeen)} ครั้ง · ล็อกครั้งแรกที่ ${firstLockedAttempt === null ? "ไม่ล็อกเลย" : String(firstLockedAttempt)}`,
    });

    const attempts = await countRows("login_attempt", "email = $1", [email]);
    steps.push({
      label: "ฐานข้อมูลบันทึกความพยายาม 5 แถวพอดี (ครั้งที่ถูกล็อกไม่ถูกบันทึก)",
      ok: attempts === 5,
      detail: `${String(attempts)} แถว`,
    });

    return { id: "rate-limit", title: "จำกัดการล็อกอินผิดซ้ำ", steps, cleanup: "ยังไม่ได้เก็บ (จะเก็บในขั้นถัดไป)", ok: steps.every((step) => step.ok) };
  } finally {
    const removed = await deleteRows("login_attempt", "email = $1", [email]);
    cleanupNotes.push(`ลบความพยายามล็อกอินของอีเมลทิ้ง ${String(removed)} แถว`);
  }
}

/* ── flow 2: เพิกถอนเซสชันรายตัว ───────────────────────────────────────────── */

async function runSessionRevokeFlow(deps: FlowDeps): Promise<FlowOutcome> {
  const steps: FlowStep[] = [];
  const actor = await mintProbeSession("probe-flow-session-a");
  const victim = await mintProbeSession("probe-flow-session-b");

  if (actor === null || victim === null) {
    steps.push({ label: "มินต์เซสชัน A/B", ok: false, detail: "มินต์ไม่ได้ (ไม่มี SESSION_SECRET/บัญชีผู้ดูแล)" });
    return { id: "session-revoke", title: "เพิกถอนเซสชันรายตัว", steps, cleanup: "ไม่มีอะไรต้องเก็บ", ok: false };
  }

  const victimHash = hashSessionId(victim.sessionId);

  try {
    const before = await getStatus(`${deps.baseUrl}/admin`, victim);
    steps.push({ label: "เซสชัน B ใช้งานได้ก่อนถูกตัด", ok: before.status === 200, detail: `/admin = ${String(before.status)}` });

    const usersPage = await getStatus(`${deps.baseUrl}/admin/users`, actor);
    const forms = formsOf(usersPage.body);
    const revokeForm = forms.find((form) => form.includes(`value="${victimHash}"`));

    if (revokeForm === undefined) {
      steps.push({ label: "หาฟอร์มตัดเซสชันของ B บน /admin/users", ok: false, detail: `ไม่พบ (ฟอร์มทั้งหมด ${String(forms.length)})` });
      return { id: "session-revoke", title: "เพิกถอนเซสชันรายตัว", steps, cleanup: "เก็บกวาดเซสชันที่มินต์ไว้", ok: false };
    }

    const revoked = await postForm(`${deps.baseUrl}/admin/users`, revokeForm, actor);
    steps.push({ label: "ส่งฟอร์มตัดเซสชัน", ok: revoked.status < 400, detail: `HTTP ${String(revoked.status)}` });

    const afterVictim = await getStatus(`${deps.baseUrl}/admin`, victim);
    const afterActor = await getStatus(`${deps.baseUrl}/admin`, actor);
    steps.push({ label: "เซสชัน B ถูกกันทันที", ok: afterVictim.status === 307, detail: `/admin = ${String(afterVictim.status)}` });
    steps.push({ label: "เซสชัน A (ผู้กระทำ) ยังใช้ได้", ok: afterActor.status === 200, detail: `/admin = ${String(afterActor.status)}` });

    const revokedAtRow = await countRows("admin_session", "token_hash = $1 and revoked_at is not null", [victimHash]);
    steps.push({ label: "แถวในฐานข้อมูลถูกเพิกถอนจริง", ok: revokedAtRow === 1, detail: `${String(revokedAtRow)} แถว` });

    return { id: "session-revoke", title: "เพิกถอนเซสชันรายตัว", steps, cleanup: "ยังไม่ได้เก็บ (จะเก็บในขั้นถัดไป)", ok: steps.every((step) => step.ok) };
  } finally {
    const releasedActor = await releaseProbeSession(actor);
    const releasedVictim = await releaseProbeSession(victim);
    cleanupNotes.push(`เพิกถอนเซสชันทดสอบ A/B (${String(Number(releasedActor) + Number(releasedVictim))}/2 สำเร็จ)`);
  }
}

/* ── flow 3: ด่านอัปโหลดภาพ ────────────────────────────────────────────────── */

function firstProductPng(): { readonly bytes: Uint8Array<ArrayBuffer>; readonly name: string } | null {
  try {
    const directory = path.join(process.cwd(), "public", "products");
    const file = readdirSync(directory)
      .filter((name) => name.endsWith(".png"))
      .sort()[0];
    if (file === undefined) return null;
    /* คัดลอกเป็น Uint8Array<ArrayBuffer> — `Blob` รับ Buffer ที่ห่อ SharedArrayBuffer ไม่ได้ */
    return { bytes: new Uint8Array(readFileSync(path.join(directory, file))), name: file };
  } catch {
    return null;
  }
}

async function runUploadGuardFlow(deps: FlowDeps): Promise<FlowOutcome> {
  const steps: FlowStep[] = [];

  if (deps.session === null) {
    steps.push({ label: "ต้องมีเซสชันผู้ดูแล", ok: false, detail: "ไม่มีเซสชัน" });
    return { id: "upload-guard", title: "ด่านอัปโหลดภาพ", steps, cleanup: "ไม่มีอะไรต้องเก็บ", ok: false };
  }

  const source = firstProductPng();
  if (source === null) {
    steps.push({ label: "หาไฟล์ PNG ตัวอย่างใน public/products", ok: false, detail: "ไม่พบไฟล์" });
    return { id: "upload-guard", title: "ด่านอัปโหลดภาพ", steps, cleanup: "ไม่มีอะไรต้องเก็บ", ok: false };
  }

  try {
    const page = await getStatus(`${deps.baseUrl}/admin/media`, deps.session);
    const uploadForm = formWithFileInput(formsOf(page.body));
    if (uploadForm === undefined) {
      steps.push({ label: "หาฟอร์มอัปโหลดบน /admin/media", ok: false, detail: "ไม่พบ" });
      return { id: "upload-guard", title: "ด่านอัปโหลดภาพ", steps, cleanup: "ไม่มีอะไรต้องเก็บ", ok: false };
    }

    const stamp = String(Date.now());
    const before = await countRows("media", "deleted_at is null", []);

    const accepted = await postForm(`${deps.baseUrl}/admin/media`, uploadForm, deps.session, {}, {
      bytes: source.bytes,
      name: `probe-upload-${stamp}.png`,
      mime: "image/png",
    });
    const afterAccepted = await countRows("media", "deleted_at is null", []);
    steps.push({
      label: "PNG จริงผ่านด่าน (สร้างแถวใหม่)",
      ok: accepted.status < 400 && afterAccepted === before + 1,
      detail: `HTTP ${String(accepted.status)} · แถว ${String(before)} → ${String(afterAccepted)}`,
    });

    const rejects: readonly { readonly label: string; readonly bytes: Uint8Array<ArrayBuffer>; readonly name: string; readonly mime: string }[] = [
      { label: "ไฟล์ 6MB (เกินเพดาน 5MB)", bytes: new Uint8Array(6 * 1024 * 1024), name: `probe-big-${stamp}.png`, mime: "image/png" },
      { label: "ข้อความธรรมดาแต่นามสกุล .png", bytes: new TextEncoder().encode("not an image"), name: `probe-fake-${stamp}.png`, mime: "image/png" },
      { label: "ไฟล์ 0 ไบต์", bytes: new Uint8Array(0), name: `probe-empty-${stamp}.png`, mime: "image/png" },
    ];

    for (const item of rejects) {
      const countBefore = await countRows("media", "deleted_at is null", []);
      const response = await postForm(`${deps.baseUrl}/admin/media`, uploadForm, deps.session, {}, item);
      const countAfter = await countRows("media", "deleted_at is null", []);
      steps.push({
        label: `${item.label} → ถูกปฏิเสธ (ไม่สร้างแถว)`,
        ok: countAfter === countBefore,
        detail: `HTTP ${String(response.status)} · แถว ${String(countBefore)} → ${String(countAfter)}`,
      });
    }

    /* เหตุผลที่แน่ชัดระดับฟังก์ชัน (Server Action ใช้ตัวเดียวกัน) */
    const reasons: string[] = [];
    for (const item of rejects) {
      const result = await storeImageFile(new File([item.bytes], item.name, { type: item.mime }), "probe@waiwai.co.th");
      reasons.push(result.ok ? "ผ่าน(?)" : result.reason);
    }
    steps.push({
      label: "เหตุผลระดับฟังก์ชัน: too-large · not-image · empty-file",
      ok: reasons.join(",") === "too-large,not-image,empty-file",
      detail: reasons.join(" · "),
    });

    return { id: "upload-guard", title: "ด่านอัปโหลดภาพ", steps, cleanup: "ยังไม่ได้เก็บ (จะเก็บในขั้นถัดไป)", ok: steps.every((step) => step.ok) };
  } finally {
    const removed = await deleteRows("media", "filename like 'probe-%'", []);
    cleanupNotes.push(`ลบภาพทดสอบในคลัง ${String(removed)} แถว`);
  }
}

/* ── flow 4: ลิงก์พรีวิว 24 ชม. ─────────────────────────────────────────────── */

async function runPreviewLinkFlow(deps: FlowDeps): Promise<FlowOutcome> {
  const steps: FlowStep[] = [];
  const createdIds: (string | null)[] = [];

  if (deps.session === null) {
    steps.push({ label: "ต้องมีเซสชันผู้ดูแล", ok: false, detail: "ไม่มีเซสชัน" });
    return { id: "preview-link", title: "ลิงก์พรีวิว 24 ชม.", steps, cleanup: "ไม่มีอะไรต้องเก็บ", ok: false };
  }

  try {
    const createLink = async (page: string): Promise<string | null> => {
      const list = await getStatus(`${deps.baseUrl}/admin/preview-links`, deps.session);
      const form = formsOf(list.body)[0];
      if (form === undefined) return null;
      const created = await postForm(`${deps.baseUrl}/admin/preview-links`, form, deps.session, { page });
      const token = /preview\/t\/([A-Za-z0-9_-]{10,})/.exec(created.body)?.[1] ?? null;
      if (token !== null) createdIds.push(await newestId("preview_link"));
      return token;
    };

    const token = await createLink("about");
    steps.push({ label: "สร้างลิงก์จากจอหลังบ้าน (no-JS)", ok: token !== null, detail: token === null ? "ไม่เห็นโทเคนในคำตอบ" : "ได้โทเคน" });

    if (token !== null) {
      /* เปิดโดย **ไม่มีคุกกี้ผู้ดูแล** — ต้องเห็นฉบับร่าง แต่ห้ามให้เครื่องค้นหาจำ */
      const opened = await fetch(`${deps.baseUrl}/th/preview/t/${token}`);
      const robots = opened.headers.get("x-robots-tag") ?? "";
      await opened.text();
      steps.push({
        label: "เปิดได้โดยไม่มีบัญชี + noindex",
        ok: opened.status === 200 && robots.includes("noindex"),
        detail: `HTTP ${String(opened.status)} · x-robots-tag: ${robots === "" ? "(ไม่มี)" : robots}`,
      });

      const storedHours = await newestLinkLifetimeHours();
      steps.push({ label: "อายุที่เก็บ = 24 ชม.", ok: storedHours !== null && storedHours >= 23 && storedHours <= 25, detail: storedHours === null ? "อ่านไม่ได้" : `${String(storedHours)} ชม.` });

      const list = await getStatus(`${deps.baseUrl}/admin/preview-links`, deps.session);
      const revokeForm = formWithField(formsOf(list.body), "id");
      if (revokeForm === undefined) {
        steps.push({ label: "หาฟอร์มยกเลิกลิงก์", ok: false, detail: "ไม่พบ" });
      } else {
        await postForm(`${deps.baseUrl}/admin/preview-links`, revokeForm, deps.session);
        const afterRevoke = await fetch(`${deps.baseUrl}/th/preview/t/${token}`, { redirect: "manual" });
        await afterRevoke.text();
        steps.push({ label: "ยกเลิกแล้วโทเคนเดิมใช้ไม่ได้ (404)", ok: afterRevoke.status === 404, detail: `HTTP ${String(afterRevoke.status)}` });
      }

      const expiredToken = await createLink("home");
      const expireId = await newestId("preview_link");
      if (expiredToken !== null && expireId !== null && isDatabaseConfigured()) {
        await getPool().query("update preview_link set expires_at = now() - interval '1 minute' where id = $1", [expireId]);
        const expired = await fetch(`${deps.baseUrl}/th/preview/t/${expiredToken}`, { redirect: "manual" });
        await expired.text();
        steps.push({ label: "ลิงก์ที่หมดอายุใช้ไม่ได้ (404)", ok: expired.status === 404, detail: `HTTP ${String(expired.status)}` });
      }
    }

    const junk = await fetch(`${deps.baseUrl}/th/preview/t/definitely-not-a-real-token-xx`, { redirect: "manual" });
    await junk.text();
    steps.push({ label: "โทเคนมั่ว = 404 (fail-closed)", ok: junk.status === 404, detail: `HTTP ${String(junk.status)}` });

    return { id: "preview-link", title: "ลิงก์พรีวิว 24 ชม.", steps, cleanup: "ยังไม่ได้เก็บ (จะเก็บในขั้นถัดไป)", ok: steps.every((step) => step.ok) };
  } finally {
    let removed = 0;
    for (const id of createdIds) {
      if (id === null) continue;
      removed += await deleteRows("preview_link", "id = $1", [id]);
    }
    cleanupNotes.push(`ลบแถวลิงก์พรีวิวที่สร้าง ${String(removed)} แถว`);
  }
}

/* ── ตัวช่วยฐานข้อมูล (อ่าน/ลบเฉพาะแถวของ probe) ────────────────────────────── */

function requireDatabase(): boolean {
  return isDatabaseConfigured();
}

async function countRows(table: string, where: string, params: readonly unknown[]): Promise<number> {
  if (!requireDatabase()) return -1;
  try {
    const { rows } = await getPool().query<{ count: string }>(
      `select count(*)::text as count from ${table} where ${where}`,
      [...params],
    );
    return Number.parseInt(rows[0]?.count ?? "0", 10);
  } catch {
    return -1;
  }
}

async function deleteRows(table: string, where: string, params: readonly unknown[]): Promise<number> {
  if (!requireDatabase()) return 0;
  try {
    const { rowCount } = await getPool().query(`delete from ${table} where ${where}`, [...params]);
    return rowCount ?? 0;
  } catch {
    return 0;
  }
}

async function newestId(table: string): Promise<string | null> {
  if (!requireDatabase()) return null;
  try {
    const { rows } = await getPool().query<{ id: string }>(`select id from ${table} order by created_at desc limit 1`);
    return rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

async function newestLinkLifetimeHours(): Promise<number | null> {
  if (!requireDatabase()) return null;
  try {
    const { rows } = await getPool().query<{ expires_at: Date }>("select expires_at from preview_link order by created_at desc limit 1");
    const row = rows[0];
    if (row === undefined) return null;
    return Math.round((new Date(row.expires_at).getTime() - Date.now()) / 3_600_000);
  } catch {
    return null;
  }
}

/* ── flow 5: SQL injection (อ่านอย่างเดียว · รอบที่ 294) ──────────────────────── */

/**
 * payload ที่ถ้าถูก "ต่อสตริงเข้า SQL" จะต้องพังหรือคืนทุกแถว
 * ⚠️ ใช้กับ **การอ่านเท่านั้น** (ห้ามใส่ DDL/DML ที่เขียนจริงลงในชุดทดสอบ)
 */
const SQL_INJECTION_PAYLOADS: readonly string[] = [
  "' or 1=1--",
  "' OR '1'='1",
  "1' union select null--",
  "'; select pg_sleep(0);--",
  "' or ''='",
];

const SQL_ERROR_SIGNS: readonly string[] = [
  "syntax error at or near",
  "unterminated quoted string",
  "invalid input syntax",
  "SQLSTATE",
  "pg_",
  "must be owner of",
];

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

/**
 * ตรวจว่า payload ถูกส่งเป็น **ค่า (parameter)** ไม่ใช่ถูกต่อเป็น SQL
 *
 * หลักฐานที่ใช้: จำนวนแถวที่ได้ต้องเท่ากับ "คำที่ไม่มีทางตรง" และ **น้อยกว่าทั้งคลัง**
 * (ถ้าฉีดได้จริง `' or 1=1--` จะคืนทุกแถว · ถ้าต่อสตริงตรง ๆ มักได้ error ของ Postgres)
 */
async function runSqlInjectionFlow(deps: FlowDeps): Promise<FlowOutcome> {
  const steps: FlowStep[] = [];

  if (!isDatabaseConfigured()) {
    steps.push({ label: "ต้องมีฐานข้อมูล", ok: false, detail: "ไม่ตั้ง DATABASE_URL" });
    return { id: "sql-injection", title: "SQL injection", steps, cleanup: "อ่านอย่างเดียว ไม่มีอะไรต้องเก็บ", ok: false };
  }

  const impossible = "zzz-ไม่มีทางตรง-zzz";
  const baselineMedia = await searchMedia(impossible, 200);
  const allMedia = await searchMedia("", 200);

  if (allMedia.length === 0) {
    steps.push({ label: "ต้องมีภาพในคลังอย่างน้อย 1 ใบ", ok: false, detail: "คลังว่าง — เทียบไม่ได้" });
    return { id: "sql-injection", title: "SQL injection", steps, cleanup: "อ่านอย่างเดียว ไม่มีอะไรต้องเก็บ", ok: false };
  }

  const mediaHits: number[] = [];
  for (const payload of SQL_INJECTION_PAYLOADS) mediaHits.push((await searchMedia(payload, 200)).length);

  steps.push({
    label: `ค้นหาภาพด้วย payload ${String(SQL_INJECTION_PAYLOADS.length)} ตัว → ต้องได้เท่าคำที่ไม่ตรง (${String(baselineMedia.length)}) และน้อยกว่าทั้งคลัง (${String(allMedia.length)})`,
    ok: mediaHits.every((count) => count === baselineMedia.length && count < allMedia.length),
    detail: mediaHits.join(" · "),
  });

  const productTotal: number[] = [];
  for (const payload of SQL_INJECTION_PAYLOADS) {
    const result = await listProductsForAdmin({ search: payload, tab: "all" });
    productTotal.push(result.total);
  }
  steps.push({
    label: "ค้นหาสินค้า (เส้นทางหลังบ้าน) ด้วย payload เดียวกัน → ต้องได้ 0 รายการ",
    ok: productTotal.every((total) => total === 0),
    detail: productTotal.join(" · "),
  });

  const pages = await Promise.all(SQL_INJECTION_PAYLOADS.map((payload) => findPage(payload)));
  steps.push({
    label: "หาหน้าด้วยรหัสที่เป็น payload → ต้องไม่เจอ (null)",
    ok: pages.every((page) => page === null),
    detail: `${String(pages.filter((page) => page === null).length)}/${String(pages.length)} เป็น null`,
  });

  /* ผ่าน HTTP จริงด้วย (ทางที่ผู้ใช้ยิงได้) — ต้อง 200 และไม่มีสัญญาณ error ของ Postgres */
  if (deps.session !== null) {
    const badStatus: string[] = [];
    const leaked: string[] = [];

    for (const payload of SQL_INJECTION_PAYLOADS.slice(0, 3)) {
      const url = `${deps.baseUrl}/admin/media?q=${encodeURIComponent(payload)}`;
      const response = await getStatus(url, deps.session);
      if (response.status !== 200) badStatus.push(`${String(response.status)}`);
      for (const sign of SQL_ERROR_SIGNS) if (response.body.includes(sign)) leaked.push(sign);

      const hits = countOccurrences(response.body, "/media/");
      if (hits >= allMedia.length) leaked.push(`คืนทุกแถว (${String(hits)})`);
    }

    steps.push({
      label: "ยิงทาง URL จริง (/admin/media?q=payload) → 200 · ไม่มีข้อความ error ของ Postgres · ไม่คืนทั้งคลัง",
      ok: badStatus.length === 0 && leaked.length === 0,
      detail: badStatus.length === 0 && leaked.length === 0 ? "สะอาดทั้ง 3 payload" : [...badStatus, ...leaked].join(" · "),
    });
  }

  return { id: "sql-injection", title: "SQL injection", steps, cleanup: "อ่านอย่างเดียว ไม่มีอะไรต้องเก็บ", ok: steps.every((step) => step.ok) };
}

/* ── flow 6: ฟอร์มติดต่อถึงกล่องข้อความจริง (รอบที่ 296) ─────────────────────── */

/**
 * 🐞 บั๊กจริงที่ทำให้ flow นี้เกิด (2026-10-16 · เจ้าของแจ้ง):
 * *"ทดสอบยิงฟอร์มติดต่อ หน้า contact ผมทดสอบกรอกฟอร์มแล้วยังไม่มีข้อความเข้าหลังบ้าน"*
 * ต้นเหตุ 2 ชั้น:
 *  ① หน้าจอตั้งชื่อช่องข้อความว่า `details` แต่ validator อ่าน `message` ⇒ **กรอกครบแล้วระบบตอบ
 *     "ข้อมูลไม่ครบ" และไม่บันทึกอะไรเลย** (silent-ish failure — ผู้ใช้คิดว่าส่งแล้ว)
 *  ② บนเดโม การเขียนฐานข้อมูลถูกปฏิเสธ (`DATABASE_URL` เป็น role อ่านอย่างเดียว) ⇒ "ระบบขัดข้องชั่วคราว"
 *
 * ⇒ flow นี้ยิงฟอร์มจริงแบบ no-JS **ด้วยชื่อช่องที่หน้าเว็บส่งเอง** แล้วตรวจว่า "มีแถวเกิดขึ้นจริง"
 *    (ไม่ใช่ดูแค่ข้อความบนจอ — บทเรียนรอบ 117/291/292) · เก็บกวาดแถวที่สร้างทิ้งทุกครั้ง
 */
async function runContactFormFlow(deps: FlowDeps): Promise<FlowOutcome> {
  const steps: FlowStep[] = [];
  const email = `probe-form-${String(Date.now())}@example.com`;
  const stamp = `ทดสอบอัตโนมัติ ${new Date().toISOString()}`;

  try {
    const page = await getStatus(`${deps.baseUrl}/th/contact`, null);
    const form = formsOf(page.body).find((candidate) => /textarea|name="(message|details)"/.test(candidate));

    if (form === undefined) {
      steps.push({ label: "หาฟอร์มติดต่อบน /th/contact", ok: false, detail: `ไม่พบฟอร์ม (HTTP ${String(page.status)})` });
      return { id: "contact-form", title: "ฟอร์มติดต่อ → กล่องข้อความ", steps, cleanup: "ไม่มีอะไรต้องเก็บ", ok: false };
    }

    /* ชื่อช่องข้อความที่ "หน้าเว็บส่งจริง" — ถ้าเป็น `details` (รุ่นเก่า) ต้องถูกแปลงที่ประตูเดียวของ action */
    const textareaName = /name="(message|details)"/.exec(/<textarea\b[^>]*>/.exec(form)?.[0] ?? "")?.[1] ?? "(ไม่พบ)";
    const before = await countRows("form_submission", "email = $1", [email]);

    const posted = await postForm(`${deps.baseUrl}/th/contact`, form, null, {
      topic: "สอบถามสินค้า",
      name: "ทดสอบอัตโนมัติ (probe)",
      email,
      subject: stamp,
      message: "ข้อความทดสอบจากเครื่องมือ probe — ระบบจะลบให้อัตโนมัติหลังตรวจเสร็จ",
      consent: "on",
    });

    const box = /<p[^>]*role="(alert|status)"[^>]*>([\s\S]*?)<\/p>/.exec(posted.body);
    const state = box?.[1] ?? "(ไม่พบกล่องผลลัพธ์)";
    steps.push({
      label: "หน้าเว็บแจ้งผลว่าส่งสำเร็จ (role=status) และช่องข้อความถูกอ่านเจอ",
      ok: state === "status" && textareaName !== "(ไม่พบ)",
      detail: state === "status" ? `ช่องข้อความชื่อ "${textareaName}"` : `role=${state} · ${box?.[2]?.trim().slice(0, 60) ?? ""}`,
    });

    const after = await countRows("form_submission", "email = $1", [email]);
    steps.push({
      label: "เกิดแถวในฐานข้อมูลจริง (ไม่ใช่แค่ข้อความบนจอ)",
      ok: after === before + 1,
      detail: `แถว ${String(before)} → ${String(after)}`,
    });

    const stored = await countRows("form_submission", "email = $1 and status = 'new' and form = 'contact'", [email]);
    steps.push({ label: "แถวที่ได้เป็น form=contact · status=new (เข้าถล่องข้อความ)", ok: stored === 1, detail: `${String(stored)} แถว` });

    return { id: "contact-form", title: "ฟอร์มติดต่อ → กล่องข้อความ", steps, cleanup: "ยังไม่ได้เก็บ (จะเก็บในขั้นถัดไป)", ok: steps.every((step) => step.ok) };
  } finally {
    const removed = await deleteRows("form_submission", "email = $1", [email]);
    cleanupNotes.push(`ลบข้อความทดสอบ ${String(removed)} แถว`);
  }
}

/* ── flow 7–8: ฟอร์มรับข่าวสาร + ฟอร์มสมัครงาน (รอบที่ 297) ─────────────────── */

/**
 * ต่อจาก flow `contact-form` (รอบ 296) — เจ้าของทดสอบผ่านทั้ง 3 ฟอร์ม
 * ⇒ ล็อกทุกฟอร์มสาธารณะด้วยหลักฐาน "มีของเข้าหลังบ้านจริง" ไม่ใช่แค่ข้อความบนจอ
 */

/** กล่องแจ้งผลที่เรนเดอร์จริง: `status` = สำเร็จ · `alert` = ไม่สำเร็จ · `(ไม่พบ)` = ไม่มีกล่อง */
function statusRoleOf(html: string): string {
  if (html.includes('role="status"')) return "status";
  if (html.includes('role="alert"')) return "alert";
  return "(ไม่พบ)";
}

/** ไฟล์ PDF ขนาดเล็กที่ผ่านการตรวจหัวไฟล์ (`%PDF`) — ใช้ทดสอบฟอร์มสมัครงาน */
function minimalPdf(): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(["%PDF-1.4", "1 0 obj<</Type/Catalog>>endobj", "trailer<</Root 1 0 R>>", "%%EOF", ""].join("\n"));
}

/** หาฟอร์มของชนิดที่ต้องการจาก "ช่องซ่อน" ที่ระบบใส่เอง (`<input name="form" value="newsletter">`) */
function formOfKind(html: string, kind: string): string | undefined {
  return formsOf(html).find((candidate) => candidate.includes('name="form"') && candidate.includes(`value="${kind}"`));
}

/** ชื่อช่องไฟล์ในฟอร์มนั้น (ฟอร์มสมัครงานใช้ `resume` เป็นต้น) */
function fileFieldNameOf(form: string): string {
  const fileTag = /<input[^>]*type="file"[^>]*>/.exec(form)?.[0] ?? "";
  return /name="([^"]+)"/.exec(fileTag)?.[1] ?? "";
}

/**
 * ค่าแรกที่ **ไม่ว่าง** ของ `<select>` ชื่อที่กำหนด
 *
 * ⚠️ จำเป็นจริง (เจอตอนรัน flow ครั้งแรก): ฟอร์มสมัครงานมีตัวเลือกตำแหน่งที่ตัวแรกเป็นตัวบอก
 * ("— เลือกตำแหน่ง —" ซึ่งมีค่าว่าง) แต่ `formFieldsOf()` เลือก "ตัวแรก" ตามที่เบราว์เซอร์ทำ
 * ⇒ ส่งค่าว่างไป validator ตอบ `required` ทั้งที่ผู้ใช้จริงเลือกตำแหน่งจริงเสมอ
 */
function firstOptionValueOf(form: string, fieldName: string): string {
  const at = form.indexOf(`name="${fieldName}"`);
  if (at === -1) return "";
  const selectEnd = form.indexOf("</select>", at);
  if (selectEnd === -1) return "";

  for (const match of form.slice(at, selectEnd).matchAll(/value="([^"]*)"/g)) {
    const value = match[1] ?? "";
    if (value !== "") return value;
  }
  return "";
}

async function runNewsletterFormFlow(deps: FlowDeps): Promise<FlowOutcome> {
  const steps: FlowStep[] = [];
  const email = `probe-news-${String(Date.now())}@example.com`;

  try {
    const page = await getStatus(`${deps.baseUrl}/th`, null);
    const form = formOfKind(page.body, "newsletter");

    if (form === undefined) {
      steps.push({ label: "หาฟอร์มรับข่าวสารบนหน้าแรก", ok: false, detail: `ไม่พบ (HTTP ${String(page.status)})` });
      return { id: "newsletter-form", title: "ฟอร์มรับข่าวสาร", steps, cleanup: "ไม่มีอะไรต้องเก็บ", ok: false };
    }

    const before = await countRows("form_submission", "email = $1", [email]);
    const posted = await postForm(`${deps.baseUrl}/th`, form, null, { email, consent: "on" });
    const role = statusRoleOf(posted.body);

    steps.push({ label: "หน้าเว็บแจ้งว่าส่งสำเร็จ (role=status)", ok: role === "status", detail: role });
    const after = await countRows("form_submission", "email = $1", [email]);
    steps.push({ label: "เกิดแถวในฐานข้อมูลจริง", ok: after === before + 1, detail: `แถว ${String(before)} → ${String(after)}` });
    const stored = await countRows("form_submission", "email = $1 and form = 'newsletter' and status = 'new'", [email]);
    steps.push({ label: "เป็น form=newsletter · status=new (เข้าถล่องข้อความ)", ok: stored === 1, detail: `${String(stored)} แถว` });

    return { id: "newsletter-form", title: "ฟอร์มรับข่าวสาร", steps, cleanup: "ยังไม่ได้เก็บ (จะเก็บในขั้นถัดไป)", ok: steps.every((step) => step.ok) };
  } finally {
    const removed = await deleteRows("form_submission", "email = $1", [email]);
    cleanupNotes.push(`ลบข้อความรับข่าวสารทดสอบ ${String(removed)} แถว`);
  }
}

async function runCareersFormFlow(deps: FlowDeps): Promise<FlowOutcome> {
  const steps: FlowStep[] = [];
  const email = `probe-job-${String(Date.now())}@example.com`;

  try {
    const page = await getStatus(`${deps.baseUrl}/th/careers`, null);
    const form = formOfKind(page.body, "careers");

    if (form === undefined) {
      steps.push({ label: "หาฟอร์มสมัครงานบน /th/careers", ok: false, detail: `ไม่พบ (HTTP ${String(page.status)})` });
      return { id: "careers-form", title: "ฟอร์มสมัครงาน (มีไฟล์แนบ)", steps, cleanup: "ไม่มีอะไรต้องเก็บ", ok: false };
    }

    const fileField = fileFieldNameOf(form);
    if (fileField === "") {
      steps.push({ label: "หาช่องไฟล์แนบในฟอร์มสมัครงาน", ok: false, detail: "ไม่พบช่องไฟล์" });
      return { id: "careers-form", title: "ฟอร์มสมัครงาน (มีไฟล์แนบ)", steps, cleanup: "ไม่มีอะไรต้องเก็บ", ok: false };
    }

    const posted = await postForm(
      `${deps.baseUrl}/th/careers`,
      form,
      null,
      {
        email,
        name: "ทดสอบอัตโนมัติ (probe)",
        /* ตำแหน่ง: ต้องเลือกค่าจริง (ตัวเลือกแรกของฟอร์มเป็นตัวบอกที่มีค่าว่าง) */
        topic: firstOptionValueOf(form, "topic"),
        message: "ใบสมัครทดสอบจากเครื่องมือ probe — จะถูกลบอัตโนมัติ",
        consent: "on",
      },
      { bytes: minimalPdf(), name: "probe-resume.pdf", mime: "application/pdf" },
      fileField,
    );
    const role = statusRoleOf(posted.body);

    steps.push({
      label: `หน้าเว็บแจ้งว่าส่งสำเร็จ (role=status) · ช่องไฟล์ "${fileField}"`,
      ok: role === "status",
      detail: role,
    });
    const stored = await countRows("form_submission", "email = $1 and form = 'careers' and status = 'new'", [email]);
    steps.push({ label: "เป็น form=careers · status=new (เข้าถล่องข้อความ)", ok: stored === 1, detail: `${String(stored)} แถว` });

    const files = await countRows(
      "form_attachment a join form_submission s on s.id = a.submission_id",
      "s.email = $1 and a.mime = 'application/pdf' and a.size_bytes > 0",
      [email],
    );
    steps.push({ label: "ไฟล์แนบ (เรซูเม่) ถูกเก็บจริงเป็น PDF", ok: files === 1, detail: `${String(files)} ไฟล์` });

    return { id: "careers-form", title: "ฟอร์มสมัครงาน (มีไฟล์แนบ)", steps, cleanup: "ยังไม่ได้เก็บ (จะเก็บในขั้นถัดไป)", ok: steps.every((step) => step.ok) };
  } finally {
    const removed = await deleteRows("form_submission", "email = $1", [email]);
    cleanupNotes.push(`ลบใบสมัครทดสอบ ${String(removed)} แถว (ไฟล์แนบลบตาม FK)`);
  }
}

/* ── จุดเข้าใช้ ────────────────────────────────────────────────────────────── */

export type RunProbeFlowsOptions = {
  readonly baseUrl: string;
  readonly only?: string;
  readonly allowRemote?: boolean;
};

/**
 * รัน flow ตามตัวเลือก — คืนผลรายขั้น + ข้อความเก็บกวาด
 * **ปฏิเสธที่จะรันกับเซิร์ฟเวอร์ไกล** เว้นแต่ `allowRemote` (เพราะ flow เขียนแถวจริง)
 */
export async function runProbeFlows(options: RunProbeFlowsOptions): Promise<FlowRunResult> {
  if (!isLocalProbeUrl(options.baseUrl) && options.allowRemote !== true) {
    return {
      outcomes: [],
      skippedReason:
        `ข้าม flow: ${options.baseUrl} ไม่ใช่เซิร์ฟเวอร์ในเครื่อง — flow มีการเขียนแถวจริง ` +
        "(เซสชัน · ความพยายามล็อกอิน · ภาพ · ลิงก์พรีวิว) ⇒ ถ้าตั้งใจให้รันกับเซิร์ฟเวอร์นั้นจริง ๆ ให้เพิ่ม --allow-remote",
    };
  }

  const selected = selectProbeFlows(options.only);
  if (selected.length === 0) return { outcomes: [], skippedReason: "ไม่พบ flow ที่ตรงกับ --only" };

  const session = selected.some((flow) => flow.needsSession) ? await mintProbeSession("probe-flows") : null;
  const outcomes: FlowOutcome[] = [];

  for (const flow of selected) {
    cleanupNotes.length = 0;

    if (flow.id === "rate-limit") outcomes.push(await runRateLimitFlow({ baseUrl: options.baseUrl, session }));
    else if (flow.id === "session-revoke") outcomes.push(await runSessionRevokeFlow({ baseUrl: options.baseUrl, session }));
    else if (flow.id === "upload-guard") outcomes.push(await runUploadGuardFlow({ baseUrl: options.baseUrl, session }));
    else if (flow.id === "preview-link") outcomes.push(await runPreviewLinkFlow({ baseUrl: options.baseUrl, session }));
    else if (flow.id === "sql-injection") outcomes.push(await runSqlInjectionFlow({ baseUrl: options.baseUrl, session }));
    else if (flow.id === "contact-form") outcomes.push(await runContactFormFlow({ baseUrl: options.baseUrl, session }));
    else if (flow.id === "newsletter-form") outcomes.push(await runNewsletterFormFlow({ baseUrl: options.baseUrl, session }));
    else outcomes.push(await runCareersFormFlow({ baseUrl: options.baseUrl, session }));

    const last = outcomes[outcomes.length - 1];
    if (last !== undefined) {
      outcomes[outcomes.length - 1] = { ...last, cleanup: cleanupNotes.join(" · ") === "" ? "ไม่มีอะไรต้องเก็บ" : cleanupNotes.join(" · ") };
    }
  }

  if (session !== null) {
    const released = await releaseProbeSession(session);
    if (!released) outcomes.push({
      id: "session-revoke",
      title: "เพิกถอนเซสชันของ probe เอง",
      steps: [{ label: "เพิกถอนเซสชันที่มินต์ให้ flow", ok: false, detail: "เพิกถอนไม่สำเร็จ — ตรวจที่ /admin/users" }],
      cleanup: "ต้องตรวจมือ",
      ok: false,
    });
  }

  return { outcomes, skippedReason: null };
}
