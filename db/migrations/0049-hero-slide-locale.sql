-- waiwai.com — migration 0049: สไลด์ hero แยกตามภาษา
--
-- ที่มา (เจ้าของ 2026-11-11): เมื่อเว็บเป็นภาษาอังกฤษ ต้องการภาพเดี่ยว `en_hero.gif`
-- แทนสไลด์ชุดเดิม (ภาษาไทยยังใช้สไลด์เดิม)
--
-- `locale`:
--   · 'all' = ใช้ได้ทั้งสองภาษา (ค่าเริ่มต้นของสไลด์เดิม)
--   · 'th'  = เฉพาะภาษาไทย
--   · 'en'  = เฉพาะภาษาอังกฤษ
--
-- ตรรกะการเลือกอยู่ใน `lib/hero/model.ts` (มีเทสต์):
--   · ถ้ามีสไลด์ของภาษานั้นอย่างน้อย 1 ใบ → ใช้เฉพาะของภาษานั้น
--   · ถ้าไม่มี → ใช้สไลด์ 'all' (พฤติกรรมเดิม)
-- ⇒ สไลด์ EN 1 ใบ = ภาพเดี่ยว ไม่มีปุ่มสไลด์

alter table hero_slide
  add column if not exists locale text not null default 'all';

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'hero_slide_locale_check'
       and conrelid = 'hero_slide'::regclass
  ) then
    alter table hero_slide
      add constraint hero_slide_locale_check check (locale in ('all', 'th', 'en'));
  end if;
end
$$;

create index if not exists hero_slide_locale_order_idx
  on hero_slide (locale, sort_order, id)
  where deleted_at is null;
