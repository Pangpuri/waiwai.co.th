/**
 * เติมค่าลงในข้อความพจนานุกรม เช่น `"บันทึกแล้ว · เขียน {written} แถว"` + `{ written: 140 }`
 *
 * ทำไมต้องมี
 * - ข้อความที่มีตัวเลขต้องประกอบจากพจนานุกรม ไม่ใช่ต่อสตริงใน `.tsx` (จะกลายเป็นข้อความไทยในโค้ด)
 * - ตัวเลขต้องจัดรูปแบบตามภาษาได้ (`1,234` / `๑,๒๓๔` ในอนาคต) จึงรับค่าที่จัดรูปแล้วเป็นสตริง
 * - คีย์ที่ไม่มีใน `values` **คง `{key}` ไว้** เพื่อให้เห็นทันทีว่าลืมส่งค่ามา (ไม่กลายเป็นช่องว่างเงียบ ๆ)
 */

export function fillTemplate(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (match, rawKey: string) => {
    const value = values[rawKey];
    return value === undefined ? match : String(value);
  });
}
