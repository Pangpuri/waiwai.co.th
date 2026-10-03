/**
 * สร้างไฟล์ CSV ของผู้ติดต่อ (X1.9) — **บริสุทธิ์ ทดสอบได้**
 *
 * เหตุผลที่เขียนเอง (ไม่เพิ่ม dependency): ต้องการแค่ 4 อย่าง
 * 1. กันเครื่องหมาย `"` `,` ขึ้นบรรทัดใหม่ (มาตรฐาน CSV)
 * 2. **ใส่ BOM** เพื่อให้ Excel เปิดภาษาไทยไม่เพี้ยน
 * 3. **กัน CSV injection**: ช่องที่ขึ้นต้นด้วย `= + - @` ต้องเติม `'` นำหน้า
 *    (ไม่งั้นเปิดใน Excel แล้วกลายเป็นสูตร — ช่องทางโจมตีที่รู้จักกันดี)
 * 4. เรียงคอลัมน์คงที่
 */

export const CSV_BOM = "\uFEFF";

export type CsvColumn<Row> = {
  readonly header: string;
  readonly value: (row: Row) => string;
};

function escapeCell(raw: string): string {
  /* ตัดอักขระควบคุมที่ทำไฟล์เสีย (เหลือ \n \t ไว้) */
  let value = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

  /* CSV injection guard */
  if (/^[=+\-@\t\r]/.test(value)) value = `'${value}`;

  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function toCsv<Row>(rows: readonly Row[], columns: readonly CsvColumn<Row>[]): string {
  const header = columns.map((column) => escapeCell(column.header)).join(",");
  const lines = rows.map((row) => columns.map((column) => escapeCell(column.value(row))).join(","));
  return `${CSV_BOM}${[header, ...lines].join("\r\n")}\r\n`;
}
