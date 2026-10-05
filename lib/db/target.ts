/**
 * การ์ดกันพลาดสำหรับ "ปลายทางที่จะดันข้อมูลขึ้น" (รอบที่ 114)
 *
 * บริบทจริง: ข้อมูลเดโม (สินค้า 54 · เมนู 18 · ข่าว 151 · ภาพ 843) ต้องขึ้นไปอยู่บน
 * ฐานข้อมูลคลาวด์ (Neon · สิงคโปร์) เพื่อให้การตลาดดูตัวอย่างหน้าเว็บได้
 *
 * ⚠️ ความเสี่ยงที่ต้องกันให้ได้
 * - **เขียนทับฐานข้อมูลในเครื่อง (dev) โดยไม่ตั้งใจ** ⇒ ถ้า `TARGET_DATABASE_URL` ถูกตั้งเป็นค่าเดียวกับ
 *   `DATABASE_URL` (หรือเป็น localhost) ต้อง **ปฏิเสธทันที** ไม่ใช่เตือนแล้วไปต่อ
 * - **พิมพ์รหัสผ่านลง log/หน้าจอ** ⇒ ทุกครั้งที่จะแสดง URL ต้องผ่าน `redactUrl()` เท่านั้น
 *
 * ตรรกะทั้งหมดเป็น pure (ทดสอบได้โดยไม่ต้องมีฐานข้อมูล) — ตัวรันอยู่ที่ `scripts/db-push.ts`
 */

export type TargetIssueCode =
  /** ไม่ได้ตั้งค่า */
  | "missing"
  /** ชี้ไปฐานข้อมูลเดียวกับที่ใช้พัฒนา (DATABASE_URL) */
  | "same-as-dev"
  /** ชี้ไปเครื่องตัวเอง (localhost) — ต้องเป็นปลายทางคลาวด์/เซิร์ฟเวอร์จริง */
  | "local-host"
  /** รูปแบบ connection string ไม่ถูกต้อง (ต้องเป็น postgres:// หรือ postgresql://) */
  | "bad-scheme";

export type TargetIssue = {
  readonly code: TargetIssueCode;
  readonly detail: string | null;
  /** ข้อความพร้อมใช้ (ภาษาไทย) สำหรับแสดงให้ผู้รันเห็นว่าต้องแก้ตรงไหน */
  readonly message: string;
};

/** โฮสต์ของ connection string (null = อ่านไม่ได้) — ใช้ URL ของ WHATWG ไม่พึ่ง dependency */
export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** เครื่องตัวเอง/เครือข่ายภายใน — ห้ามใช้เป็นปลายทาง "ดันขึ้นคลาวด์" */
export function isLocalHost(host: string): boolean {
  /* ไม่สนตัวพิมพ์ — `hostOf()` คืนค่าเล็กอยู่แล้ว แต่ให้ฟังก์ชันนี้ปลอดภัยเมื่อเรียกตรง ๆ */
  const bare = host.trim().toLowerCase().replace(/^\[|\]$/g, "");
  return (
    bare === "localhost" ||
    bare === "127.0.0.1" ||
    bare === "::1" ||
    bare === "0.0.0.0" ||
    bare.endsWith(".local") ||
    bare.startsWith("192.168.") ||
    bare.startsWith("10.") ||
    bare.startsWith("172.16.") ||
    bare.startsWith("172.17.") ||
    bare.startsWith("172.18.") ||
    bare.startsWith("172.19.") ||
    bare.startsWith("172.2") ||
    bare.startsWith("172.30.") ||
    bare.startsWith("172.31.")
  );
}

/**
 * ซ่อนรหัสผ่านก่อนแสดง/log — เก็บเฉพาะโครงที่จำเป็นต่อการตรวจสอบ
 * เช่น `postgresql://user:****@host/db?sslmode=require`
 */
export function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password !== "") parsed.password = "****";
    return parsed.toString();
  } catch {
    /* อ่านเป็น URL ไม่ได้ = อย่าเสี่ยงโชว์ทั้งก้อน */
    return "<อ่าน connection string ไม่ได้>";
  }
}

/**
 * ตรวจว่าปลายทางนี้ "ดันข้อมูลขึ้นได้จริงไหม" — คืนรายการปัญหา (ว่าง = ผ่าน)
 * เป็น pure function: ไม่ต่อฐานข้อมูล ไม่แตะ env เอง (ผู้เรียกอ่าน env แล้วส่งเข้ามา)
 */
export function validateRemoteTarget(
  targetUrl: string | undefined,
  devUrl: string | undefined,
): readonly TargetIssue[] {
  const issues: TargetIssue[] = [];
  const target = targetUrl?.trim() ?? "";

  if (target === "") {
    issues.push({
      code: "missing",
      detail: null,
      message:
        "ไม่พบ TARGET_DATABASE_URL — ใส่ connection string ของฐานข้อมูลปลายทางใน .env.local (ห้าม commit) แล้วรันใหม่",
    });
    return issues;
  }

  if (!target.startsWith("postgres://") && !target.startsWith("postgresql://")) {
    issues.push({
      code: "bad-scheme",
      detail: null,
      message: "TARGET_DATABASE_URL ต้องเริ่มด้วย postgres:// หรือ postgresql://",
    });
  }

  if (devUrl !== undefined && devUrl.trim() !== "" && target === devUrl.trim()) {
    issues.push({
      code: "same-as-dev",
      detail: null,
      message:
        "TARGET_DATABASE_URL เป็นค่าเดียวกับ DATABASE_URL (ฐานข้อมูลที่ใช้พัฒนา) — คำสั่งนี้จะเขียนทับข้อมูลในเครื่อง ปฏิเสธไว้ก่อนเพื่อความปลอดภัย",
    });
  }

  const host = hostOf(target);
  if (host === null) {
    issues.push({
      code: "bad-scheme",
      detail: null,
      message: "อ่านโฮสต์จาก TARGET_DATABASE_URL ไม่ได้ — ตรวจรูปแบบ connection string อีกครั้ง",
    });
  } else if (isLocalHost(host)) {
    issues.push({
      code: "local-host",
      detail: host,
      message: `ปลายทางชี้ไปเครื่องตัวเอง (${host}) — งานนี้ต้องเป็นฐานข้อมูลคลาวด์/เซิร์ฟเวอร์จริงเท่านั้น`,
    });
  }

  return issues;
}
