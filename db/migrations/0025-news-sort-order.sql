/*
  รอบที่ 154 — เพิ่ม `news.sort_order` (ต้นเหตุที่แท็บ "ข่าว" ในหน้าจัดลำดับว่างเปล่า)

  หน้าที่ /admin/sort อ่าน `order by sort_order, id` แต่ตาราง news ยังไม่มีคอลัมน์นี้
  ⇒ คำสั่ง SQL ล้ม (ถูกกลืนเป็นรายการว่าง) ผู้ใช้เห็น "ยังไม่มีรายการในหมวดนี้" ทั้งที่มีข่าว 151 ชิ้น

  ⚠️ default 0 = ของเดิมทั้งหมดอยู่ "ลำดับเดียวกัน" แล้วเรียงต่อด้วย id → ลำดับเดิมไม่เปลี่ยน
  ⚠️ ต้องรันกับปลายทาง (คลาวด์) ด้วย: DATABASE_URL=<cloud> npm run db:migrate (บทเรียนรอบ 105)
*/

alter table news add column if not exists sort_order integer not null default 0;

create index if not exists news_admin_order_idx on news (deleted_at, sort_order, id);
