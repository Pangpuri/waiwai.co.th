/**
 * ตรวจว่า **ภาพที่เอกสารหน้าเว็บอ้างถึงมีอยู่จริงบนฐานข้อมูลปลายทาง** (รอบที่ 305 · 2026-10-20)
 *
 * ## ปัญหาที่ปิด (เคสจริงบนเดโม)
 * `db:sync` / การกดเผยแพร่ ซิงก์ **`page_document`** ขึ้นคลาวด์ แต่ **ไม่ได้ซิงก์ตาราง `media`**
 * (โดยดีไซน์ เพราะ id ของภาพระหว่างเครื่องกับคลาวด์เป็นคนละชุด)
 * ⇒ เอกสารบนคลาวด์อ้าง `/media/<id ของเครื่อง>` ที่คลาวด์ไม่มี ⇒ **หน้าเว็บ 200 แต่ภาพ 404 ทุกใบ**
 * (เกิดจริงกับ `/about` 13 ใบ + `/about/executives` 1 ใบ — ตรวจไม่เจอด้วยตาเพราะหน้าเว็บไม่พัง)
 *
 * ⇒ ด่านนี้อ่านอย่างเดียว: ดึง id ภาพจากเอกสารทุกแถว แล้วเทียบกับตาราง `media`
 *    · แถว **published** ที่อ้างภาพหาย/ภาพอยู่ในถัง ⇒ **ตก** (เว็บจริงเสีย)
 *    · แถว **draft** ⇒ **เตือน** (พรีวิวเสีย แต่ยังไม่ขึ้นเว็บ)
 *
 * ⚠️ ตรรกะทั้งหมดบริสุทธิ์ (ไม่แตะ DB/Next) ⇒ เทสต์ได้ด้วย `node --test`
 */

export type PageDocumentRow = {
  readonly page: string;
  readonly status: string;
  readonly document: unknown;
};

export type MediaCatalogEntry = {
  readonly id: string;
  /** `deletedAt !== null` = อยู่ในถังขยะ ⇒ `/media/<id>` ตอบ 404 */
  readonly deletedAt: string | null;
};

export type MediaRefIssue = {
  readonly page: string;
  readonly status: string;
  readonly ids: readonly string[];
  readonly reason: "missing" | "trashed";
};

/** id ของภาพในคลัง (`/media/<id>`) ทั้งหมดที่เอกสารอ้าง — ไม่ซ้ำ · เรียงตามที่พบ */
export function mediaIdsOfDocument(document: unknown): readonly string[] {
  const text = typeof document === "string" ? document : JSON.stringify(document ?? null);
  const ids: string[] = [];
  for (const match of text.matchAll(/\/media\/([A-Za-z0-9_-]+)/g)) {
    const id = match[1];
    if (id !== undefined && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/**
 * หาแถวเอกสารที่อ้างภาพซึ่ง **ใช้ไม่ได้** บนปลายทาง (ไม่มีแถว หรืออยู่ในถังขยะ)
 * คืนเฉพาะแถวที่มีปัญหา — แถวปกติจะไม่ถูกคืนเลย
 */
export function mediaRefIssues(
  rows: readonly PageDocumentRow[],
  catalog: readonly MediaCatalogEntry[],
): readonly MediaRefIssue[] {
  const state = new Map<string, "ok" | "trashed">();
  for (const entry of catalog) state.set(entry.id, entry.deletedAt === null ? "ok" : "trashed");

  const issues: MediaRefIssue[] = [];
  for (const row of rows) {
    const missing: string[] = [];
    const trashed: string[] = [];
    for (const id of mediaIdsOfDocument(row.document)) {
      const found = state.get(id);
      if (found === undefined) missing.push(id);
      else if (found === "trashed") trashed.push(id);
    }
    if (missing.length > 0) {
      issues.push({ page: row.page, status: row.status, ids: missing, reason: "missing" });
    }
    if (trashed.length > 0) {
      issues.push({ page: row.page, status: row.status, ids: trashed, reason: "trashed" });
    }
  }
  return issues;
}

/** ข้อความสรุปสำหรับพิมพ์ในด่าน (ภาษาไทย · ใช้ทั้งผลปกติและผลมีปัญหา) */
export function describeMediaRefIssue(issue: MediaRefIssue): string {
  const what = issue.reason === "missing" ? "ไม่มีแถวในตาราง media" : "อยู่ในถังขยะ (ตอบ 404)";
  return `หน้า \`${issue.page}\` (${issue.status}) อ้างภาพ ${String(issue.ids.length)} ใบที่${what}: ${issue.ids.join(" · ")}`;
}
