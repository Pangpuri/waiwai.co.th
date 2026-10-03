-- ─────────────────────────────────────────────────────────────────────────────
-- waiwai.com — migration 0006: บันทึกความพยายามล็อกอิน (X2.1 rate limit)
--
-- ผู้ใช้เลือกครบทุกข้อในรอบที่ 64 · ข้อ X2.1 = "rate limit + ล็อกเมื่อล็อกอินผิดซ้ำ"
-- เก็บเฉพาะสิ่งที่ต้องใช้ตัดสินใจ: อีเมลที่พยายาม · ผลสำเร็จ/ล้มเหลว · เวลา
--   ⇒ ใช้คำนวณว่า "อีเมลนี้ล็อกอยู่ไหม" และใช้เป็นร่องรอยความปลอดภัย
--
-- ⚠️ PDPA: ข้อมูลนี้เป็นข้อมูลส่วนบุคคล ⇒ ต้องมีงานลบตามกำหนด (retention 30 วัน — หนี้ในแผน X2.3)
-- ⚠️ idempotent
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists login_attempt (
  id         bigint      generated always as identity primary key,
  email      text        not null,
  succeeded  boolean     not null default false,
  created_at timestamptz not null default now()
);

create index if not exists login_attempt_email_idx on login_attempt (lower(email), created_at desc);
create index if not exists login_attempt_created_idx on login_attempt (created_at desc);

comment on table login_attempt is
  'ร่องรอยการพยายามล็อกอิน (rate limit + ความปลอดภัย) · ต้องลบตามระยะเก็บ (ยังไม่ทำ — หนี้ X2)';
