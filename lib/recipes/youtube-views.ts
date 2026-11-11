/**
 * อ่านยอดวิว YouTube จาก HTML หน้า watch — pure module (ทดสอบได้ ไม่ต่อเน็ต)
 *
 * YouTube ฝังค่า `"viewCount":"12345"` ไว้ในข้อมูลเริ่มต้นของหน้า
 * ⚠️ ไม่ใช้ API key (ไม่เพิ่ม dependency/ค่าใช้จ่าย) · ถ้า YouTube เปลี่ยนรูปแบบ ต้องแก้ที่เดียวนี้
 */
export function parseYouTubeViewCount(html: string): number | null {
  const match = html.match(/"viewCount":"(\d+)"/);
  if (match?.[1] === undefined) return null;
  const value = Number.parseInt(match[1], 10);
  return Number.isFinite(value) && value >= 0 ? value : null;
}
