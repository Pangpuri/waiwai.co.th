/**
 * ตรวจว่า "ภาพถูกใช้ที่ไหน" (X1.2) — **ตรรกะล้วน ทดสอบได้**
 *
 * เหตุผล (เอกสารอ้างอิง เฟส 4.6): *"Block deletion of media still in use, or warn clearly"*
 *   ⇒ ก่อนลบภาพ ต้องรู้ว่ามีที่ไหนอ้างถึง `/media/<id>` อยู่ จะได้ไม่ทำหน้าเว็บพัง
 *
 * วิธีตรวจ: เดินดูค่า JSON ทั้งก้อน (เอกสารหน้า · navbar · footer · ป้ายประกาศ · ตั้งค่าเว็บ)
 * แล้วเก็บสตริงที่ขึ้นต้นด้วย `/media/`
 */

export const MEDIA_PATH_PREFIX = "/media/";

/** ดึง id ของภาพจากพาธ (`/media/abc123` → `abc123`) — คืน null ถ้าไม่ใช่พาธภาพของเรา */
export function mediaIdFromPath(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith(MEDIA_PATH_PREFIX)) return null;

  const rest = trimmed.slice(MEDIA_PATH_PREFIX.length);
  if (rest === "") return null;

  /* ตัด query/hash ที่อาจติดมา แล้วเอาเฉพาะส่วนแรกของเส้นทาง */
  const id = rest.split(/[?#]/)[0]?.split("/")[0] ?? "";
  return id === "" ? null : id;
}

/** เดินดู JSON ทุกชั้น (ออบเจ็กต์/อาร์เรย์/สตริง) แล้วคืนพาธภาพทั้งหมดที่เจอ (ไม่ซ้ำ) */
export function extractMediaPaths(value: unknown): readonly string[] {
  const found = new Set<string>();

  const visit = (node: unknown): void => {
    if (typeof node === "string") {
      const id = mediaIdFromPath(node);
      /* เก็บเป็นพาธมาตรฐาน (ไม่มี query/hash) เพื่อเทียบกันได้ */
      if (id !== null) found.add(`${MEDIA_PATH_PREFIX}${id}`);
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (typeof node === "object" && node !== null) {
      for (const item of Object.values(node as Record<string, unknown>)) visit(item);
    }
  };

  visit(value);
  return [...found];
}

/** มีภาพนี้อยู่ในก้อน JSON ไหม */
export function containsMediaId(value: unknown, mediaId: string): boolean {
  return extractMediaPaths(value).includes(`${MEDIA_PATH_PREFIX}${mediaId}`);
}
