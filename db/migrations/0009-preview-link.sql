-- ─────────────────────────────────────────────────────────────────────────────
-- waiwai.com — migration 0009: ลิงก์พรีวิวชั่วคราว (X2.6)
--
-- เป้าหมาย (จากคิวที่ผู้ใช้อนุมัติ รอบที่ 64 · ข้อ 2.5 ของเอกสารต้นทาง)
--   "ให้ผู้จัดการดูงานที่ยังไม่เผยแพร่ได้ โดยไม่ต้องมีบัญชีหลังบ้าน"
--   ⇒ ผู้ดูแลสร้าง **ลิงก์อายุสั้น** ส่งให้ผู้จัดการเปิดดูฉบับร่างได้ชั่วคราว
--
-- กติกาความปลอดภัยที่ออกแบบไว้
--   1. **เก็บเฉพาะ hash ของโทเคน** (sha256) — ฐานข้อมูลรั่วก็เอาโทเคนไปใช้ต่อไม่ได้
--      (แบบเดียวกับ `admin_session.token_hash`) · โทเคนดิบเห็นได้ครั้งเดียวตอนสร้าง
--   2. **มีวันหมดอายุ** (`expires_at`) ⇒ ตรวจที่เซิร์ฟเวอร์ทุกครั้ง (ไม่เชื่อฝั่งเบราว์เซอร์)
--   3. **ยกเลิกได้** (`revoked_at`) — เผลอส่งผิดคนก็ปิดลิงก์ได้ทันที
--   4. **มีร่องรอย**: ใครสร้าง (`created_by`) · ใช้ล่าสุดเมื่อไร · ใช้ไปกี่ครั้ง
--
-- ⚠️ idempotent ทุกคำสั่ง · ⚠️ ตัวเลข TTL/อายุเก็บกวาด **ห้ามพิมพ์ที่นี่** — อยู่ที่ `lib/preview-link/plan.ts`
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists preview_link (
  id           text        primary key,
  -- sha256(โทเคนดิบ) — ห้ามเก็บโทเคนดิบไม่ว่ากรณีใด
  token_hash   text        not null unique,
  /** หน้าเป้าหมายของลิงก์นี้ (ตอนนี้รองรับ `home` — ดู PREVIEWABLE_PAGES) */
  page         text        not null,
  expires_at   timestamptz not null,
  created_at   timestamptz not null default now(),
  created_by   text,
  /** ไม่ null = ลิงก์นี้ถูกยกเลิกแล้ว (ใช้ไม่ได้ทันที) */
  revoked_at   timestamptz,
  /** ร่องรอยการใช้งานล่าสุด — ช่วยให้ผู้ดูแลเห็นว่าลิงก์ถูกเปิดจริงไหม */
  last_used_at timestamptz,
  use_count    integer     not null default 0 check (use_count >= 0)
);

-- ไล่หาลิงก์ที่ยังใช้ได้ / เก็บกวาดของหมดอายุ
create index if not exists preview_link_expires_idx on preview_link (expires_at);
create index if not exists preview_link_page_idx on preview_link (page, created_at desc);

comment on table preview_link is
  'ลิงก์พรีวิวชั่วคราว (X2.6) — เก็บเฉพาะ hash ของโทเคน · มีวันหมดอายุ + ยกเลิกได้ · ดู lib/preview-link/plan.ts';
