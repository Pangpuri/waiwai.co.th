-- ─────────────────────────────────────────────────────────────────────────────
-- waiwai.com — migration 0008: ถังขยะ (X2.4)
--
-- ผู้ใช้เลือกในรอบที่ 64 (คิว X2b) และยืนยันลำดับในรอบที่ 78 ว่าให้ทำต่อจากรอบที่ 77
-- ปัญหาที่กำลังปิด: ทุกวันนี้ "ลบ" = **ลบถาวรทันที** (ภาพในคลัง · พรีเซ็ตบล็อก)
--   ⇒ เผลอกดลบภาพที่ยังไม่ใช้ = ไบต์ของภาพหายจากฐานข้อมูลถาวร กู้ได้จาก backup ทั้งก้อนเท่านั้น
--
-- วิธีที่เลือก: **soft delete** (ทำเครื่องหมายว่าอยู่ในถัง) ไม่ใช่คัดลอกไปตารางถังขยะ
--   เหตุผล
--     1. ไบต์ของภาพ (bytea) ไม่ถูกคัดลอกซ้ำ ⇒ ฐานข้อมูล/ไฟล์สำรองไม่บวมเป็นสองเท่า
--     2. `/media/<id>` ยังเป็นพาธเดิม ⇒ **กดกู้คืนแล้วทุกที่ที่อ้างถึงภาพนี้กลับมาใช้ได้ทันที**
--        (ถ้าคัดลอกไปตารางใหม่แล้วออก id ใหม่ ทุกบล็อกที่อ้างพาธเดิมจะพัง)
--     3. ตัวลบตามกำหนดลบได้ตรงไปตรงมา (`deleted_at < cutoff`)
--
-- ⚠️ idempotent ทุกคำสั่ง (รันซ้ำได้ ไม่พังกับฐานข้อมูลที่มีข้อมูลอยู่แล้ว)
-- ⚠️ ตัวเลขระยะเก็บ (30 วัน) **ห้ามพิมพ์ที่นี่** — อยู่ที่ `lib/retention/plan.ts` ที่เดียว
-- ─────────────────────────────────────────────────────────────────────────────

-- ── คลังภาพ ──────────────────────────────────────────────────────────────────
alter table media add column if not exists deleted_at timestamptz;
alter table media add column if not exists deleted_by text;

comment on column media.deleted_at is
  'เวลาเข้าถังขยะ (null = ใช้งานปกติ) · ลบถาวรอัตโนมัติเมื่อพ้นระยะเก็บ — ดู lib/retention/plan.ts';

-- ── พรีเซ็ตบล็อก ─────────────────────────────────────────────────────────────
alter table block_preset add column if not exists deleted_at timestamptz;
alter table block_preset add column if not exists deleted_by text;

comment on column block_preset.deleted_at is
  'เวลาเข้าถังขยะ (null = ใช้งานปกติ) · 🔑 บันทึกพรีเซ็ตชื่อเดิมทับ = กู้คืนกลับมาใช้อัตโนมัติ';

-- ── ดัชนี: แยก "ของที่ใช้อยู่" กับ "ของในถัง" ให้อ่านเร็วทั้งสองทาง ──────────────
-- ของเดิม (media_created_idx / block_preset_created_idx) ถูกแทนด้วยดัชนีแบบมีเงื่อนไข
-- ⇒ เก็บเฉพาะของที่ใช้งานปกติ และมีตัวแยกไว้ไล่ของในถังสำหรับงานลบตามกำหนด
drop index if exists media_created_idx;
drop index if exists block_preset_created_idx;

create index if not exists media_alive_created_idx on media (created_at desc) where deleted_at is null;
create index if not exists media_trash_idx on media (deleted_at) where deleted_at is not null;

create index if not exists block_preset_alive_created_idx on block_preset (created_at desc) where deleted_at is null;
create index if not exists block_preset_trash_idx on block_preset (deleted_at) where deleted_at is not null;
