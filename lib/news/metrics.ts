import { formQuery } from "@/lib/db/read";

/**
 * เพิ่มยอดวิวข่าว 1 ครั้ง — ผ่าน pool ของ **role ฟอร์มสาธารณะ**
 * (งานเขียนเดียวที่คนนอกทำได้นอกฟอร์ม · สิทธิ์ถูกจำกัดที่คอลัมน์ `view_count` — ดู `scripts/db-roles.ts`)
 *
 * ⚠️ ไม่คืนยอดใหม่ให้ client (ไม่เปิดช่องให้เดาข้อมูล) · ล้มเหลว = เงียบ
 *    เพราะตัวนับวิวต้องไม่ทำให้หน้าข่าวพัง
 */
export async function incrementNewsView(sourceId: string): Promise<boolean> {
  const value = sourceId.trim();
  if (!/^\d{3,}$/.test(value)) return false;

  try {
    const result = await formQuery(
      `update news
          set view_count = view_count + 1
        where source_id = $1
          and status = 'published'
          and deleted_at is null`,
      [value],
    );
    return (result.rowCount ?? 0) > 0;
  } catch {
    return false;
  }
}
