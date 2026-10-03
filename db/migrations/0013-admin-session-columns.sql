-- ─────────────────────────────────────────────────────────────────────────────
-- waiwai.com — migration 0013: เติมคอลัมน์ให้ตาราง `admin_session` ที่มีอยู่แล้ว (รอบที่ 95)
--
-- ทำไมต้องมีไฟล์นี้ (ทั้งที่ 0012 สร้างตารางอยู่แล้ว)
--   ตาราง `admin_session` ถูกสร้างไว้ตั้งแต่ `0001-init.sql` ด้วยรูปทรงเดิม (token_hash · user_id · expires_at · created_at · revoked_at)
--   ⇒ `create table if not exists` ใน 0012 **ไม่ทำอะไรเลย** บนฐานข้อมูลที่มีอยู่แล้ว (และห้ามแก้ไฟล์ที่รันไปแล้ว)
--   ไฟล์นี้จึงเติมคอลัมน์/ดัชนีที่ยังขาดด้วยคำสั่ง idempotent — ใช้ได้ทั้งกับ DB เก่าและ DB ที่สร้างใหม่จาก 0012
--
-- ⚠️ idempotent ทุกคำสั่ง · ไม่แตะข้อมูลเดิม
-- ─────────────────────────────────────────────────────────────────────────────

alter table admin_session add column if not exists last_seen_at timestamptz not null default now();
alter table admin_session add column if not exists revoked_by   text;
alter table admin_session add column if not exists user_agent   text;

-- ดัชนีเดิม (0001) เป็น (user_id) เฉย ๆ ⇒ เปลี่ยนเป็น (user_id, created_at desc) ให้ตรงกับคำสั่งที่ใช้จริง
drop index if exists admin_session_user_idx;
create index if not exists admin_session_user_idx on admin_session (user_id, created_at desc);

create index if not exists admin_session_active_idx on admin_session (expires_at) where revoked_at is null;

comment on table admin_session is
  'เซสชันหลังบ้านที่เพิกถอนได้ — เก็บเป็น hash ของ sid · ตรวจทุกคำขอ · เก็บ 30 วันหลังหมดอายุ/เพิกถอน (รอบที่ 95)';
