-- รอบที่ 123: หลังบ้าน "ข่าว/กิจกรรม"
--
-- เพิ่ม 2 คอลัมน์ให้ตาราง news เพื่อให้แก้จากหลังบ้านได้แบบ WordPress "Posts"
--   1. status      — 'draft' (ฉบับร่าง ยังไม่ขึ้นเว็บ) / 'published' (เผยแพร่)
--                     ค่าเริ่มต้น 'published' เพื่อให้ข่าว 151 ชิ้นที่นำเข้ามาแล้ว **ไม่หายจากเว็บ**
--   2. deleted_at  — ย้ายเข้าถังขยะ (soft delete) กู้คืนได้ · หน้าเว็บต้องกรองออก
--
-- ทำไม soft delete: การลบข่าวเป็นเรื่อง irreversible — ถ้าการตลาดกดพลาดต้องกู้คืนได้
-- (ถังขยะของภาพ/พรีเซ็ตใช้แนวคิดเดียวกัน เก็บ 30 วัน — ส่วนเนื้อหาจะผูกกับตัวลบกลางในรอบถัดไป)

alter table news add column if not exists status text not null default 'published';
alter table news add column if not exists deleted_at timestamptz;

/* ตรวจค่าสถานะ (Postgres ไม่มี `add constraint if not exists` ⇒ ต้องเช็คก่อนด้วย DO block) */
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'news_status_check') then
    alter table news add constraint news_status_check check (status in ('draft', 'published'));
  end if;
end $$;

/* ดัชนีสำหรับหน้ารายการหลังบ้าน (กรองถังขยะ/สถานะ แล้วเรียงใหม่สุดก่อน) */
create index if not exists news_admin_idx on news (deleted_at, status, published_at desc nulls last, id desc);
