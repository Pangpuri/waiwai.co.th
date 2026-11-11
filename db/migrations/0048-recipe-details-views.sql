-- waiwai.com — migration 0048: สูตรอาหาร (รายละเอียด/ภาพ) + ยอดวิว YouTube
--
-- ที่มา (เจ้าของ 2026-11-11):
-- · การ์ดเมนูอาหารต้องกางรายละเอียดได้เหมือนรายละเอียดสินค้า
-- · ใส่ภาพสูตรได้ (ภาพย่อพอดีการ์ด + กดดูภาพเต็มได้)
-- · คลิปที่ไม่มีสูตร (ไม่มีทั้งข้อความและภาพ) ต้องไม่มีการ์ดให้กดกาง
-- · แสดงยอดวิว YouTube ของแต่ละคลิป
--
-- `details_th`/`details_en` = ข้อความสูตร (เว้นว่างได้)
-- `recipe_image_media_id` = ภาพสูตร (ชี้ `media` · มติ D9/D11)
-- `view_count` = ยอดวิว YouTube ที่แคชไว้ (ตัวรีเฟรชคือ `npm run recipes:views`)
-- ⚠️ ตัวนำเข้าเมนู (`upsertRecipe`) ไม่เขียนคอลัมน์ใหม่ ⇒ นำเข้าซ้ำไม่ล้างสูตร/ยอดวิว

alter table recipe
  add column if not exists details_th text not null default '',
  add column if not exists details_en text not null default '',
  add column if not exists recipe_image_media_id text references media (id) on delete set null,
  add column if not exists view_count bigint not null default 0,
  add column if not exists view_count_updated_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'recipe_view_count_check'
       and conrelid = 'recipe'::regclass
  ) then
    alter table recipe
      add constraint recipe_view_count_check check (view_count >= 0);
  end if;
end
$$;
