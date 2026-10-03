/**
 * Dictionary area: temporary preview link — **public side** (X2.6)
 *
 * อยู่ระดับบนสุด (ไม่ใช่ `admin`) เพราะหน้าลิงก์พรีวิวเปิดโดยคนที่ไม่มีบัญชีหลังบ้าน
 * ⚠️ ไม่ต้องประกาศชนิดเอง — ไฟล์ `en.ts` ประกาศเป็น `Messages` (derive จาก th) ⇒ คีย์ขาด/เกิน = compile error
 * ⚠️ ห้ามพิมพ์จำนวนชั่วโมง/วันในไฟล์นี้ — ตัวเลขมาจาก `lib/preview-link/plan.ts`
 */
export const previewLinkPage = {
  notice: "Temporary preview — not live yet (this link expires automatically)",
  noBlocks: "— This page has no blocks yet —",
  backToSite: "Go to the live site",
};
