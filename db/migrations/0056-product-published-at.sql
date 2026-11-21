-- ป้าย "ใหม่" ของสินค้าต้องอิงวันเผยแพร่ ไม่ใช่วันแก้ไข (รอบ 367)
-- สินค้าเดิมยังไม่มีวันเผยแพร่ ⇒ ใช้ updated_at ที่มีอยู่เป็นค่าประมาณที่ดีที่สุด
-- หลังจากนี้การแก้ไขสินค้าจะไม่เปลี่ยน published_at (upsert ไม่แตะคอลัมน์นี้)

alter table public.product add column if not exists published_at timestamptz;

update public.product
   set published_at = updated_at
 where published_at is null;

alter table public.product alter column published_at set default now();
alter table public.product alter column published_at set not null;
