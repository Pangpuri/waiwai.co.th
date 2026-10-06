-- ─────────────────────────────────────────────────────────────────────────────
-- waiwai.com — migration 0021: หลังบ้าน "เมนูอาหาร" (recipe)
--
-- รอบที่ 135 · เจ้าของเลือกขอบเขต "เต็มแบบข่าว" (2026-10-06) — ใช้แม่แบบเดียวกับ `news` (0020)
--
-- เพิ่ม 2 คอลัมน์
--   1. status      — 'draft' (ฉบับร่าง ยังไม่ขึ้นเว็บ) / 'published' (เผยแพร่)
--                     ค่าเริ่มต้น 'published' เพื่อให้เมนู 18 รายการที่นำเข้าแล้ว **ไม่หายจากเว็บ**
--   2. deleted_at  — ย้ายเข้าถังขยะ (soft delete) กู้คืนได้ · หน้าเว็บต้องกรองออก
--
-- ทำไม soft delete: การลบเมนูเป็นเรื่อง irreversible — ถ้าการตลาดกดพลาดต้องกู้คืนได้
-- (แนวคิดเดียวกับถังขยะของภาพ/พรีเซ็ต/ข่าว)
--
-- ⚠️ หลังรันในเครื่องแล้ว **ต้องรันกับฐานข้อมูลปลายทางด้วย** (บทเรียนรอบที่ 105)
--    `DATABASE_URL=<ปลายทาง> npm run db:migrate` แล้ว `npm run db:status` ต้องขึ้น "ครบ"
-- ⚠️ idempotent ทุกคำสั่ง
-- ─────────────────────────────────────────────────────────────────────────────

alter table recipe add column if not exists status text not null default 'published';
alter table recipe add column if not exists deleted_at timestamptz;

/* ตรวจค่าสถานะ (Postgres ไม่มี `add constraint if not exists` ⇒ ต้องเช็คก่อนด้วย DO block) */
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'recipe_status_check') then
    alter table recipe add constraint recipe_status_check check (status in ('draft', 'published'));
  end if;
end $$;

/* ดัชนีสำหรับหน้ารายการหลังบ้าน (กรองถังขยะ/สถานะ แล้วเรียงตามลำดับที่จัดไว้) */
create index if not exists recipe_admin_idx on recipe (deleted_at, status, sort_order, id);
