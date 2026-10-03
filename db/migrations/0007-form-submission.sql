-- ─────────────────────────────────────────────────────────────────────────────
-- waiwai.com — migration 0007: เก็บผู้ติดต่อลงฐานข้อมูล (X1.9)
--
-- มติผู้ใช้ รอบที่ 64: "ฟอร์มรับผู้ติดต่อ = เก็บลงฐานข้อมูล"
--   เหตุผล: ฟอร์มที่ส่งทางอีเมลเท่านั้น = ข้อมูลหายได้ (อีเมลล่ม/เข้า spam/ไม่มีคนเปิด)
--   ⇒ เก็บลงฐานข้อมูลเป็นหลัก · การส่งอีเมลแจ้งเตือนเป็นเรื่องของภายหลัง
--
-- ⚠️ PDPA: เป็นข้อมูลส่วนบุคคล ⇒ ต้องมีระยะเก็บ + วิธีลบ (หนี้ในแผน X2b)
-- ⚠️ idempotent · เก็บ "ชื่อไฟล์/mime/ขนาด/ไบต์" ของไฟล์แนบในตารางแยก (ใช้กับใบสมัครงาน)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists form_submission (
  id         bigint      generated always as identity primary key,
  /** ฟอร์มไหน: ติดต่อ · รับข่าวสาร · สมัครงาน */
  form       text        not null check (form in ('contact', 'newsletter', 'careers')),
  email      text        not null,
  name       text        not null default '',
  phone      text        not null default '',
  topic      text        not null default '',
  subject    text        not null default '',
  message    text        not null default '',
  /** ฟิลด์เพิ่มเติมของแต่ละฟอร์ม (เก็บเป็น JSONB — ไม่ต้องแก้ตารางเมื่อเพิ่มช่อง) */
  payload    jsonb       not null default '{}'::jsonb,
  /** สถานะการจัดการ: ใหม่ · จัดการแล้ว · สแปม */
  status     text        not null default 'new' check (status in ('new', 'handled', 'spam')),
  consent    boolean     not null default false,
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by text
);

create index if not exists form_submission_status_idx on form_submission (status, created_at desc);
create index if not exists form_submission_form_idx on form_submission (form, created_at desc);
create index if not exists form_submission_recent_idx on form_submission (lower(email), created_at desc);

comment on table form_submission is
  'ผู้ติดต่อ/ผู้สมัคร จากฟอร์มหน้าเว็บ (มติผู้ใช้ รอบที่ 64: เก็บลงฐานข้อมูล ไม่พึ่งอีเมล)';

-- ไฟล์แนบ (ใบสมัครงาน) — เก็บไบต์ในฐานข้อมูลเหมือนภาพ (มติ D11: pg_dump พาไปได้ทั้งเว็บ)
create table if not exists form_attachment (
  id            bigint      generated always as identity primary key,
  submission_id bigint      not null references form_submission (id) on delete cascade,
  filename      text        not null,
  mime          text        not null,
  size_bytes    integer     not null,
  data          bytea       not null,
  created_at    timestamptz not null default now()
);

create index if not exists form_attachment_submission_idx on form_attachment (submission_id);
