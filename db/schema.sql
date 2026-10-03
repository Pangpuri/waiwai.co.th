-- ─────────────────────────────────────────────────────────────────────────────
-- waiwai.com — สคีมาเนื้อหาสำหรับหลังบ้าน (เอกสารอ้างอิง)
--
-- ⚠️ **แหล่งความจริงของโครงตารางคือ `db/migrations/*.sql`** (รอบที่ 60)
--    - สร้าง/อัปเดตฐานข้อมูล:  `npm run db:migrate`  (รันเฉพาะไฟล์ที่ยังไม่รัน + จดประวัติ)
--    - ไฟล์นี้ = "ภาพรวมปัจจุบัน" ไว้เปิดอ่าน/ส่งมอบงาน ⇒ แก้ migration ก่อน แล้วอัปเดตไฟล์นี้ให้ตรง
--    - ใช้ `psql "$DATABASE_URL" -f db/schema.sql` ได้เฉพาะกับฐานข้อมูล **ว่างใหม่** เท่านั้น
--
-- หมายเหตุ: ไม่ใช้ ORM โดยเจตนา (มติ D8 — ใช้ `pg` + SQL เขียนเอง · ผู้ใช้ยืนยันซ้ำ รอบที่ 60)
--           ทุกคอลัมน์ต้องมีเหตุผลอยู่ในใบตัดสินใจ
-- ─────────────────────────────────────────────────────────────────────────────

-- ── เนื้อหา: หนึ่งแถว = หนึ่งฟิลด์ ────────────────────────────────────────────
-- ทำไมเป็นรายฟิลด์ (ไม่ใช่ตารางกว้างต่อ section)
--   เพราะแต่ละ section มีชุดฟิลด์ไม่เหมือนกัน และเราจะ "ไล่ทำทีละหน้า" —
--   เพิ่มฟิลด์ใหม่ต้องไม่ต้อง migrate ตาราง
--
-- มติที่บังคับใช้ในสคีมานี้
--   D3 — th/en อยู่แถวเดียวกัน · th บังคับตอน publish (en บังคับเฉพาะฟิลด์ระดับส่วน/หน้า)
--   D9 — เก็บ **พาธ** ของไฟล์ (เช่น `/slide/x.jpg`) ไม่เก็บ URL เต็ม
--        → ย้ายที่เก็บรูป/ย้ายโดเมน = แก้ที่ `ASSET_BASE_URL` ไม่ต้องแก้ข้อมูล
create table if not exists content_field (
  page                text    not null,              -- 'home' · 'news' · …
  section             text    not null,              -- คีย์ section เช่น 'hero'
  item_key            text    not null default '',   -- '' = ฟิลด์ระดับ section · อื่น ๆ = กลุ่มรายการ เช่น 'slides'
  item_order          integer,                       -- ลำดับรายการ (เริ่มที่ 1) · null สำหรับฟิลด์ระดับ section
  field               text    not null,              -- คีย์ฟิลด์ เช่น 'title'
  kind                text    not null               -- ตรงกับ ValueKind ใน lib/content/types.ts
                        check (kind in ('text', 'url', 'date', 'media')),

  th                  text,                          -- ข้อความไทย (ว่าง/null = ยังไม่ได้กรอก)
  en                  text,                          -- ข้อความอังกฤษ (ว่าง = ยังไม่มีคำแปล)

  media_path          text,                          -- พาธใต้ที่เก็บไฟล์ (D9)
  media_alt_th        text,                          -- คำบรรยายภาพไทย (บังคับเมื่อมีไฟล์)
  media_alt_en        text,                          -- คำบรรยายภาพอังกฤษ (เว้นว่างได้)
  media_has_watermark boolean not null default false, -- true = ติดลายน้ำเจ้าของต้นทาง → ห้ามเผยแพร่

  -- ข้อมูลส่วนบุคคลแบบเบา: ใครเป็นคนแก้ (PDPA — ดู § 3.1 ของใบตัดสินใจ · retention 90 วัน)
  updated_at          timestamptz not null default now(),
  updated_by          text,

  primary key (page, section, item_key, field)
);

-- ดึงเนื้อหาทั้งหน้าเรียงตามลำดับที่แสดง (ใช้ตอน build)
create index if not exists content_field_page_order_idx
  on content_field (page, section, item_order, field);

-- ── ประวัติ/สถานะการเผยแพร่ ──────────────────────────────────────────────────
-- เฟส B2 (หลังบ้านหน้าแรก) ใช้ตารางนี้ทำ draft → publish → ย้อนกลับ
-- snapshot เก็บเนื้อหาทั้งหน้าเป็น JSONB → ย้อนเวอร์ชันได้โดยไม่ต้องเก็บ diff
create table if not exists content_revision (
  id           bigint generated always as identity primary key,
  page         text        not null,
  revision     integer     not null,
  status       text        not null check (status in ('draft', 'published', 'archived')),
  snapshot     jsonb       not null,
  note         text,
  created_at   timestamptz not null default now(),
  created_by   text,
  published_at timestamptz,
  unique (page, revision)
);

-- ── ผู้ดูแลหลังบ้าน + เซสชัน + บันทึกการกระทำ (เฟส B3) ────────────────────────
-- ⚠️ สถานะปัจจุบัน (2026-10-02): แอปยังล็อกอินด้วย **โหมด env** (`ADMIN_EMAIL`/`ADMIN_PASSWORD_HASH`)
--    ตารางชุดนี้คือเป้าหมายถัดไป — เปิดใช้เมื่อมี `DATABASE_URL` แล้วเขียน `createDbUserStore()`
--    (สัญญาของ store เหมือนกันทั้งสองโหมด → สลับได้ที่ lib/auth/dal.ts ที่เดียว)
--
-- เหตุผลที่ไม่มีคอลัมน์รหัสผ่านธรรมดา: เก็บเฉพาะ hash แบบ scrypt (มติความปลอดภัย § Security Baseline)
create table if not exists admin_user (
  id            text        primary key,
  email         text        not null unique,
  display_name  text        not null default '',
  -- scrypt:N:r:p:<salt b64>:<hash b64> — ตรวจ/ตรวจซ้ำด้วย lib/auth/password.ts
  -- ⚠️ ห้ามใช้ `$` เป็นตัวคั่น: dotenv-expand ของ Next จะตัดค่าเป็นตัวแปร (เคสจริง 2026-10-02)
  password_hash text        not null,
  role          text        not null check (role in ('editor', 'publisher', 'admin')),
  disabled      boolean     not null default false,
  last_login_at timestamptz,
  created_at    timestamptz not null default now()
);

-- เซสชันเก็บเป็น **hash ของโทเคน** (ถ้าฐานข้อมูลรั่ว ก็เอาโทเคนไปใช้ต่อไม่ได้)
-- และมีไว้เพื่อ "เพิกถอนได้" ซึ่งเป็นเหตุผลที่เลือก opaque token แทน JWT
create table if not exists admin_session (
  token_hash text        primary key,
  user_id    text        not null references admin_user (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists admin_session_user_idx on admin_session (user_id);

-- บันทึกว่า "ใครทำอะไร เมื่อไร" — ต้องมีทุกครั้งที่แตะข้อมูล (กติกา Security Baseline / PDPA)
-- retention: 90 วัน (มติ Q16) → ต้องมีงานลบตามกำหนดในเฟส B6
create table if not exists audit_log (
  id          bigint generated always as identity primary key,
  actor_id    text,
  actor_email text,
  action      text        not null,
  target      text,
  detail      text,
  created_at  timestamptz not null default now()
);

create index if not exists audit_log_created_idx on audit_log (created_at);

-- ── เอกสารบล็อก (page builder) — มติผู้ใช้ 2026-10-02: "บล็อกอิสระ + แบรนด์คุมด้วยพรีเซ็ต" ──
-- หน้าเว็บ 1 หน้า = 1 เอกสาร JSONB · แยกสถานะ draft/published เป็น 2 แถวในตารางเดียว
-- เหตุผลที่เก็บ JSONB (ไม่ใช่ EAV เหมือน content_field):
--   เนื้อหาแบบอิสระมีรูปทรงต่างกันทุกบล็อก (การ์ด 1-4 ใบ · ภาพซ้าย/ขวา · ข้อความล้วน)
--   การยัดลง EAV จะได้คีย์ที่เดาไม่ได้และตรวจยาก · เอกสารก้อนเดียวอ่าน/เขียน/ย้อนกลับจบในรายการเดียว
create table if not exists page_document (
  page         text        not null,
  -- draft = ฉบับร่างที่แก้อยู่ · published = ฉบับที่หน้าเว็บสาธารณะใช้
  status       text        not null check (status in ('draft', 'published')),
  document     jsonb       not null,
  updated_at   timestamptz not null default now(),
  updated_by   text,
  published_at timestamptz,
  primary key (page, status)
);

-- "ใช้เนื้อหานี้กับหน้าเว็บจริง" (เซสชั่น S1) — เฉพาะแถว published ที่เป็น true
-- ⇒ หน้าเว็บสาธารณะจะเรนเดอร์เอกสารนี้แทนเลย์เอาต์ที่ออกแบบไว้ · ค่าเริ่มต้น false = ไม่เปลี่ยนหน้าเว็บ
-- (เพิ่มทีหลังใน migration 0003 · เขียนเป็น alter เพื่อให้ไฟล์นี้ตรงกับประวัติ migration)
alter table page_document add column if not exists is_live boolean not null default false;

-- ประวัติทุกครั้งที่ "เผยแพร่" (และตอนกู้คืน) → ย้อนกลับได้ ของเดิมไม่หายแม้เผยแพร่ทับ
create table if not exists page_document_revision (
  id         bigint generated always as identity primary key,
  page       text        not null,
  revision   integer     not null,
  document   jsonb       not null,
  note       text,
  created_by text,
  created_at timestamptz not null default now(),
  unique (page, revision)
);

create index if not exists page_document_revision_page_idx on page_document_revision (page, revision desc);

-- ── คลังภาพ (มติ D9/D11: เก็บ "ไฟล์" ไว้ในฐานข้อมูล ⇒ ย้ายเซิร์ฟเวอร์/สำรองข้อมูลได้ก้อนเดียว) ──
-- ทำไมเก็บ bytea ไม่เก็บไฟล์บนดิสก์:
--   แผนจริงของผู้ใช้คือ "สำรองข้อมูล → ยัด Docker → ย้ายไปเซิร์ฟเวอร์ที่เช่า" ⇒ ให้ `pg_dump` ก้อนเดียวพาทุกอย่างไป
--   ไม่มีไฟล์ค้างบนดิสก์ที่ต้อง sync/ลืม backup · พาธที่เก็บในบล็อกคือ `/media/<id>` (พาธ ไม่ใช่ URL เต็ม — D9)
create table if not exists media (
  id         text        primary key,
  filename   text        not null,
  mime       text        not null check (mime in ('image/png', 'image/jpeg', 'image/webp')),
  size_bytes integer     not null check (size_bytes > 0),
  -- ขนาดภาพจริง (อ่านจากหัวไฟล์เอง ไม่เชื่อที่เบราว์เซอร์บอก) — ใช้ตั้งสัดส่วนภาพ/กันภาพบิด
  width      integer     check (width  is null or width  > 0),
  height     integer     check (height is null or height > 0),
  data       bytea       not null,
  alt_th     text        not null default '',
  alt_en     text        not null default '',
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists media_created_idx on media (created_at desc);

-- ── พรีเซ็ตบล็อก (คลังแบบสำเร็จ) ──────────────────────────────────────────────
-- ผู้ใช้สั่ง รอบที่ 52: "บันทึกบล็อก/แบนเนอร์ที่ทำไว้เป็นพรีเซ็ต แล้วดึงมาวาง/ทับของเดิม"
-- เก็บ "บล็อก" ทั้งก้อนเป็น JSONB (รวมภาพ/สไตล์) ⇒ ใช้ซ้ำได้ทุกหน้า
-- หมายเหตุ: ภาพที่พรีเซ็ตอ้างถึงอยู่ในตาราง `media` ⇒ อย่าลบภาพที่พรีเซ็ตยังใช้อยู่
create table if not exists block_preset (
  id         text        primary key,
  name       text        not null,
  block_type text        not null,
  block      jsonb       not null,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists block_preset_name_idx on block_preset (lower(name));
create index if not exists block_preset_created_idx on block_preset (created_at desc);

-- ── ยังไม่สร้างในเฟสนี้ (ตั้งใจ) ───────────────────────────────────────────────
--  * ถังเก็บไฟล์แยก (S3/R2) → ใช้เมื่อหน้าเว็บจริงไม่ได้อยู่ในเครื่องเดียวกับฐานข้อมูล
