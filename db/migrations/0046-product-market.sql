-- waiwai.com — migration 0046: แยก "สินค้าในประเทศ" / "สินค้าส่งออก"
--
-- ที่มา (เจ้าของ 2026-11-11): หมวดสินค้าเดิมมีเฉพาะสินค้าขายในประเทศ
-- แต่ละหมวดมี "สินค้าส่งออก" ของตัวเอง (ดึงจากหน้า /en/pages/<id> ของเว็บเดิม)
-- หน้าเว็บต้องมีแท็บให้ดูทั้งสองประเภท โดยค่าเริ่มต้น:
--   · ภาษาไทย  → แท็บ "สินค้าในประเทศ"
--   · ภาษาอังกฤษ → แท็บ "สินค้าส่งออก"
--
-- ค่าเริ่มต้นของสินค้าที่มีอยู่เดิม = 'domestic' (ไม่กระทบข้อมูล/หน้าเว็บเดิม)
-- ⚠️ ต้องรัน migration นี้ก่อน deploy โค้ดที่อ่านคอลัมน์ `market`

alter table product
  add column if not exists market text not null default 'domestic';

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'product_market_check'
       and conrelid = 'product'::regclass
  ) then
    alter table product
      add constraint product_market_check check (market in ('domestic', 'export'));
  end if;
end
$$;

-- คิวรีหลักของหน้าเว็บ: สินค้าในหมวดตามประเภท แล้วเรียงตามลำดับ
create index if not exists product_market_order_idx
  on product (category_id, market, sort_order, id)
  where deleted_at is null;
