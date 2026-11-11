-- waiwai.com — migration 0047: ยอดวิวข่าว
--
-- ที่มา (เจ้าของ 2026-11-11): ต้องแสดงจำนวนผู้เข้าชมที่ข่าว
-- · นำยอดเดิมจากเว็บเดิม (waiwai.co.th/en/news/) มาเป็นค่าเริ่มต้น
-- · จากนั้นเพิ่มเมื่อเปิดหน้ารายละเอียดข่าว (กันนับซ้ำ 24 ชม. ต่อเครื่องด้วยคุกกี้)
--
-- เก็บเป็น bigint เพราะยอดสะสมระยะยาวจะเกิน int ได้
-- ⚠️ ตัวนำเข้าข่าว (`upsertNews`) ไม่เขียนคอลัมน์นี้ ⇒ นำเข้าซ้ำไม่ล้างยอดวิว
-- ⚠️ การเพิ่มยอดจากหน้าเว็บเป็นงานเขียนเดียวที่คนนอกทำได้นอกฟอร์ม
--    ⇒ ต้องให้สิทธิ์ระดับคอลัมน์กับ role ฟอร์ม (ดู scripts/db-roles.ts)

alter table news
  add column if not exists view_count bigint not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'news_view_count_check'
       and conrelid = 'news'::regclass
  ) then
    alter table news
      add constraint news_view_count_check check (view_count >= 0);
  end if;
end
$$;
