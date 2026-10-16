/**
 * แผนของ "flow หลายขั้น" ในเครื่องมือ probe (รอบที่ 293) — **ตรรกะล้วน ไม่มี I/O**
 *
 * ต่างจาก `probe:routes` (ยิง GET เส้นเดียวจบ) — flow คือลำดับที่มี **การเขียน** เกิดขึ้นจริง
 * (สร้างเซสชัน · ล็อกอินผิดซ้ำ · อัปโหลดไฟล์ · สร้างลิงก์พรีวิว) ⇒ ต้องมีวินัยพิเศษ:
 * 1. **ห้ามรันกับเซิร์ฟเวอร์ที่ไม่ใช่ในเครื่อง** เว้นแต่สั่ง `--allow-remote` (กันสร้างแถวขยะบนเดโม/โปรดักชัน)
 * 2. ทุก flow ต้อง **เก็บกวาดของที่ตัวเองสร้าง** และรายงานว่าเก็บอะไร
 * 3. ตัดสินจาก "หลักฐานที่เชื่อได้" (จำนวนแถวในฐานข้อมูล · สถานะ HTTP) ไม่ใช่ข้อความบนจอ
 *    (บทเรียนรอบ 117/291/292: ข้อความพจนานุกรมถูก serialize ลงทุกหน้า ⇒ grep ข้อความ = หลักฐานปลอม)
 */

export const PROBE_FLOW_IDS = ["rate-limit", "session-revoke", "upload-guard", "preview-link", "sql-injection"] as const;
export type ProbeFlowId = (typeof PROBE_FLOW_IDS)[number];

export const PROBE_FLOWS: readonly { readonly id: ProbeFlowId; readonly title: string; readonly needsSession: boolean }[] = [
  { id: "rate-limit", title: "จำกัดการล็อกอินผิดซ้ำ (5 ครั้ง → ล็อก 15 นาที) ด้วยอีเมลทิ้ง", needsSession: false },
  { id: "session-revoke", title: "เพิกถอนเซสชันรายตัวจากจอจัดการบัญชี (อีกเซสชันถูกกันทันที)", needsSession: true },
  { id: "upload-guard", title: "ด่านอัปโหลดภาพ (ขนาด 5MB · sniff หัวไฟล์ · ไฟล์ว่าง)", needsSession: true },
  { id: "preview-link", title: "ลิงก์พรีวิว 24 ชม. (เปิดได้โดยไม่มีบัญชี · ยกเลิก/หมดอายุ = 404)", needsSession: true },
  { id: "sql-injection", title: "SQL injection: payload ต้องถูกมองเป็น \"ค่า\" ไม่ใช่คำสั่ง (อ่านอย่างเดียว)", needsSession: true },
];

export function isProbeFlowId(value: string): value is ProbeFlowId {
  return (PROBE_FLOW_IDS as readonly string[]).includes(value);
}

/** เลือก flow ที่จะรัน (`--only=` กรองด้วย id หรือชื่อเรื่อง) */
export function selectProbeFlows(only?: string): readonly (typeof PROBE_FLOWS)[number][] {
  const needle = (only ?? "").trim();
  if (needle === "") return PROBE_FLOWS;
  return PROBE_FLOWS.filter((flow) => flow.id.includes(needle) || flow.title.includes(needle));
}

/**
 * URL นี้เป็น "เซิร์ฟเวอร์ในเครื่อง" ไหม (อนุญาตให้ flow เขียนข้อมูลได้โดยไม่ต้องยืนยันเพิ่ม)
 * รับเฉพาะ localhost/127.0.0.1/::1 (มีหรือไม่มีพอร์ต) — ที่เหลือถือว่าไกล
 */
export function isLocalProbeUrl(baseUrl: string): boolean {
  try {
    const { hostname } = new URL(baseUrl);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
  } catch {
    return false;
  }
}
