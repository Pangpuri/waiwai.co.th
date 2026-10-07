/*
  รอบที่ 177 — ตารางเนื้อหา (สินค้า/เมนูอาหาร/ข่าว) มี **`deleted_by`** ของตัวเอง

  ที่มา: รอบที่ 176 ยก "ถังขยะ" ของเนื้อหามาไว้ที่ `/admin/trash` รวมกับภาพ/พรีเซ็ต
  ⇒ คอลัมน์ "ทำโดย" ของแถวเนื้อหาต้องอ่านจาก `updated_by` แทน (เพราะไม่มี `deleted_by`)
  ปัญหาจริง: `updated_by` ถูกเขียนทุกครั้งที่มีคนแก้แถวนั้น ⇒ ถ้ามีคนแก้ของที่ **อยู่ในถัง**
  หน้าถังขยะจะโชว์ชื่อคนแก้ ไม่ใช่คนที่ลบ (ผู้ดูแลสืบย้อนหลังไม่ได้ว่าใครทำ)

  ทำไมต้องเป็นคอลัมน์แยก (ไม่ใช้ `updated_by` ต่อ)
  - `media` / `block_preset` / `chrome_preset` มี `deleted_by` มาตั้งแต่รอบที่ 78/80 ⇒ สคีมาไม่สม่ำเสมอ
  - กู้คืนแล้วต้อง **ล้างค่า** (`deleted_by = null`) ให้ตรงกับ `deleted_at = null` เสมอ
    ⇒ สองคอลัมน์นี้เป็นคู่กัน (ของอยู่ในถัง = มีทั้ง deleted_at และ deleted_by)

  ⚠️ `nullable` โดยเจตนา — แถวที่ยังใช้งานอยู่ต้องเป็น null
  ⚠️ ต้องรันกับปลายทาง (คลาวด์) ด้วย: `DATABASE_URL=<cloud> npm run db:migrate` (บทเรียนรอบ 105)
  ⚠️ ชื่อคอลัมน์/ตารางมาจากโค้ดเท่านั้น (ไม่มีค่าจากผู้ใช้ในไฟล์นี้)
*/

alter table product add column if not exists deleted_by text;
alter table recipe add column if not exists deleted_by text;
alter table news add column if not exists deleted_by text;

/*
  เติมค่าย้อนหลังให้ของที่อยู่ในถังอยู่แล้ว — ใช้ `updated_by` เป็นค่าประมาณที่ดีที่สุดที่มี
  (ตอนที่ย้ายเข้าถัง ฟังก์ชันเดิมเขียน `updated_by = ผู้ทำ` พร้อม `deleted_at` ⇒ ค่าตรงกัน ณ เวลานั้น)
  ⚠️ รันซ้ำไม่มีผล: เงื่อนไข `deleted_by is null` ทำให้รอบถัดไปไม่เหลือแถวให้แก้
  idempotent: conditional-update
*/
update product set deleted_by = updated_by where deleted_at is not null and deleted_by is null;
update recipe set deleted_by = updated_by where deleted_at is not null and deleted_by is null;
update news set deleted_by = updated_by where deleted_at is not null and deleted_by is null;
