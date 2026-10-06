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

-- เซสชันเก็บเป็น **hash ของรหัสเซสชัน (sid)** (ถ้าฐานข้อมูลรั่ว ก็เอาไปสวมรอยต่อไม่ได้)
-- และมีไว้เพื่อ "เพิกถอนได้" ซึ่งเป็นเหตุผลที่เลือก opaque token แทน JWT (ทำจริงรอบที่ 95)
-- ⚠️ ไม่เก็บ IP · เก็บ user-agent ที่ตัดความยาว · ระยะเก็บ 30 วันหลังหมดอายุ/เพิกถอน (`lib/retention/plan.ts`)
create table if not exists admin_session (
  token_hash   text        primary key,
  user_id      text        not null references admin_user (id) on delete cascade,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at   timestamptz not null,
  revoked_at   timestamptz,
  revoked_by   text,
  user_agent   text
);

create index if not exists admin_session_user_idx on admin_session (user_id, created_at desc);
create index if not exists admin_session_active_idx on admin_session (expires_at) where revoked_at is null;

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

-- ตั้งเวลาเผยแพร่อัตโนมัติ (X2.7 · migration 0014): null = ไม่ได้ตั้ง · เก็บกับแถวฉบับร่าง
alter table page_document add column if not exists publish_at   timestamptz;
alter table page_document add column if not exists scheduled_by text;

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
  created_at timestamptz not null default now(),
  -- ถังขยะ (X2.4 · migration 0008): null = ใช้งานปกติ · มีค่า = อยู่ในถัง (ลบถาวรอัตโนมัติเมื่อพ้นระยะเก็บ)
  deleted_at timestamptz,
  deleted_by text
);

create index if not exists media_alive_created_idx on media (created_at desc) where deleted_at is null;
create index if not exists media_trash_idx on media (deleted_at) where deleted_at is not null;

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
  updated_at timestamptz not null default now(),
  -- ถังขยะ (X2.4): กดลบ = ย้ายเข้าถัง · บันทึกชื่อเดิมทับ = กู้คืนอัตโนมัติ (deleted_at = null)
  deleted_at timestamptz,
  deleted_by text
);

create unique index if not exists block_preset_name_idx on block_preset (lower(name));
create index if not exists block_preset_alive_created_idx on block_preset (created_at desc) where deleted_at is null;
create index if not exists block_preset_trash_idx on block_preset (deleted_at) where deleted_at is not null;

-- ── หน้าเป็นวัตถุ (W1 · migration 0004) ──────────────────────────────────────
-- "หน้า" กลายเป็นวัตถุจริง (แบบ WordPress: Posts/Pages) · ชื่อหน้า = ชื่อเมนูของหน้านั้น
-- seed 9 หน้าให้ตรงเมนูปัจจุบัน — ทำใน migration 0004 (ไฟล์นี้ไม่ใส่ seed เพื่อไม่ทับของจริง)
-- หมายเหตุ: migration 0005 เพิ่มคอลัมน์ SEO ต่อหน้า ⇒ รวมไว้ในตารางนี้แล้ว (บรรทัด seo_*)
create table if not exists page (
  id                 text        primary key,
  name_th            text        not null,
  name_en            text        not null default '',
  menu_order         integer     not null default 0,
  in_menu            boolean     not null default true,
  -- blocks = แก้ด้วยบล็อกได้ (มีเอกสารใน page_document) · designed = ใช้เลย์เอาต์ในโค้ด
  editor             text        not null default 'designed' check (editor in ('blocks', 'designed')),
  seo_title_th       text        not null default '',
  seo_title_en       text        not null default '',
  seo_description_th text        not null default '',
  seo_description_en text        not null default '',
  og_image_path      text        not null default '',   -- พาธในเว็บ (มติ D9) เช่น /media/<id>
  seo_noindex        boolean     not null default false,
  updated_at         timestamptz not null default now(),
  updated_by         text
);

create index if not exists page_menu_order_idx on page (menu_order, id);

-- ── ความพยายามล็อกอิน (X2.1 rate limit · migration 0006) ──────────────────────
-- PDPA: ข้อมูลส่วนบุคคล ⇒ ต้องลบตามระยะเก็บ (30 วัน · lib/retention/plan.ts)
create table if not exists login_attempt (
  id         bigint      generated always as identity primary key,
  email      text        not null,
  succeeded  boolean     not null default false,
  created_at timestamptz not null default now()
);

create index if not exists login_attempt_email_idx on login_attempt (lower(email), created_at desc);
create index if not exists login_attempt_created_idx on login_attempt (created_at desc);

-- ── ผู้ติดต่อ/ผู้สมัครจากฟอร์มหน้าเว็บ (X1.9 · migration 0007) ─────────────────
-- มติผู้ใช้ รอบที่ 64: เก็บลงฐานข้อมูลเป็นหลัก (ฟอร์มที่ส่งอีเมลเท่านั้น = ข้อมูลหายได้)
-- PDPA: ต้องลบตามระยะเก็บ (ติดต่อ/ข่าวสาร 1 ปี · ใบสมัครงาน 6 เดือน)
create table if not exists form_submission (
  id         bigint      generated always as identity primary key,
  form       text        not null check (form in ('contact', 'newsletter', 'careers')),
  email      text        not null,
  name       text        not null default '',
  phone      text        not null default '',
  topic      text        not null default '',
  subject    text        not null default '',
  message    text        not null default '',
  payload    jsonb       not null default '{}'::jsonb,
  status     text        not null default 'new' check (status in ('new', 'handled', 'spam')),
  consent    boolean     not null default false,
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by text
);

create index if not exists form_submission_status_idx on form_submission (status, created_at desc);
create index if not exists form_submission_form_idx on form_submission (form, created_at desc);
create index if not exists form_submission_recent_idx on form_submission (lower(email), created_at desc);

-- ไฟล์แนบ (ใบสมัครงาน) — เก็บไบต์ในฐานข้อมูลเหมือนภาพ (มติ D11: pg_dump พาไปได้ทั้งเว็บ)
-- ลบตามใบสมัครอัตโนมัติ (on delete cascade)
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

-- ── ลิงก์พรีวิวชั่วคราว (X2.6 · migration 0009) ────────────────────────────────
-- ให้ผู้จัดการดูฉบับร่างโดยไม่ต้องมีบัญชี · ⚠️ เก็บเฉพาะ sha256 ของโทเคน (โทเคนดิบเห็นครั้งเดียว)
-- มีวันหมดอายุ + ยกเลิกได้ + เก็บร่องรอยการใช้งาน · ตัวเลข TTL อยู่ที่ lib/preview-link/plan.ts
create table if not exists preview_link (
  id           text        primary key,
  token_hash   text        not null unique,
  page         text        not null,
  expires_at   timestamptz not null,
  created_at   timestamptz not null default now(),
  created_by   text,
  revoked_at   timestamptz,
  last_used_at timestamptz,
  use_count    integer     not null default 0 check (use_count >= 0)
);

create index if not exists preview_link_expires_idx on preview_link (expires_at);
create index if not exists preview_link_page_idx on preview_link (page, created_at desc);

-- ── พรีเซ็ตของส่วนกลางของเว็บ (W3b · migration 0010) ───────────────────────────
-- ชุดสำเร็จของ navbar/footer/ป้ายประกาศ · ชื่อซ้ำ (ไม่สนตัวพิมพ์) ทับได้ภายในชนิดเดียวกัน
-- deleted_at/deleted_by = ใช้ถังขยะกลาง (X2.4) · payload ต้องผ่าน parser ของส่วนนั้นเสมอ
create table if not exists chrome_preset (
  id         text        primary key,
  kind       text        not null check (kind in ('navbar', 'footer', 'mourning')),
  name       text        not null,
  payload    jsonb       not null,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by text
);

create unique index if not exists chrome_preset_kind_name_key on chrome_preset (kind, lower(name));
create index if not exists chrome_preset_alive_idx on chrome_preset (kind, created_at desc) where deleted_at is null;
create index if not exists chrome_preset_trash_idx on chrome_preset (deleted_at) where deleted_at is not null;

-- ── สินค้าที่นำเข้าจากเว็บเดิม (S4 · migration 0016) ───────────────────────────
-- ที่มา: เจ้าของสั่ง 2026-10-05 ให้นำเข้าข้อมูลสินค้าจาก waiwai.co.th (เว็บเดิม) ลงฐานข้อมูล แยกตามหมวด
-- · `product_category` เก็บ **เฉพาะเนื้อหาที่นำเข้า** (คำอธิบาย/ภาพ) — **ชื่อหมวดอยู่ในโค้ด**
--   `features/products/catalog.ts` (เจ้าของยืนยันแล้ว · กันชื่อหลุดจากกัน 2 ที่)
-- · `product.id` = `p<source_id>` ⇒ นำเข้าซ้ำได้แบบ idempotent (`npm run products:import`)
-- · รูปเก็บในตาราง `media` (มติ D11) · ที่นี่เก็บแค่ id ของภาพ (มติ D9) · `media.sha256` = ลายนิ้วมือไฟล์ (dedupe ตอนนำเข้า)
-- · `product_category.image_media_id` / `product.image_media_id` = on delete set null (ลบภาพในถังขยะแล้วสินค้าไม่หาย)
alter table media add column if not exists sha256 text;
create index if not exists media_sha256_idx on media (sha256);

create table if not exists product_category (
  id             text        primary key,
  source_id      text,
  description_th text        not null default '',
  description_en text        not null default '',
  image_media_id text        references media (id) on delete set null,
  updated_at     timestamptz not null default now(),
  updated_by     text
);

create table if not exists product (
  id             text        primary key,
  category_id    text        not null references product_category (id) on delete cascade,
  source_id      text        not null,
  source_url     text        not null default '',
  name_th        text        not null,
  name_en        text        not null default '',
  group_th       text        not null default '',
  group_en       text        not null default '',
  tagline_th     text        not null default '',
  tagline_en     text        not null default '',
  details_th     text        not null default '',
  allergens_th   text        not null default '',
  net_weight_th  text        not null default '',
  fda_number     text        not null default '',
  packaging_th   text        not null default '',
  image_media_id text        references media (id) on delete set null,
  sort_order     integer     not null default 0,
  /* ถังขยะของสินค้า (migration 0022 · รอบที่ 139) — null = ใช้งาน · มีค่า = อยู่ในถัง (กู้คืนได้) */
  deleted_at     timestamptz,
  updated_at     timestamptz not null default now(),
  updated_by     text
);

create index if not exists product_category_order_idx on product (category_id, sort_order, id);
create index if not exists product_source_idx on product (source_id);
create index if not exists product_admin_idx on product (deleted_at, category_id, sort_order, id);

create table if not exists product_ingredient (
  product_id   text    not null references product (id) on delete cascade,
  sort_order   integer not null,
  name_th      text    not null,
  name_en      text    not null default '',
  percent_text text    not null default '',
  primary key (product_id, sort_order)
);

-- ── เมนูอาหาร (วิดีโอ) ที่นำเข้าจากเว็บเดิม (S3 ส่วนที่ 4 · migration 0017) ─────
-- ⚠️ ของจริงคือ **วิดีโอ** ไม่ใช่สูตรข้อความ — 18 บทความในหมวด 12586 มีแต่ iframe YouTube
--  · เก็บ **id ของวิดีโอ** ไม่เก็บ URL (ประกอบ URL ในโค้ด · ผู้ใช้กดก่อนจึงโหลด = youtube-nocookie)
--  · ภาพปกเก็บใน `media` (มติ D11) · ที่นี่เก็บแค่ id (มติ D9) · นำเข้าซ้ำได้ผ่าน `npm run recipes:import`
--  · เมนูแบบข้อความที่การตลาดพิมพ์เองยังใช้บล็อก `recipeCards` บนหน้า `/recipes` (มติรอบที่ 101)
create table if not exists recipe (
  id             text        primary key,
  source_id      text        not null,
  source_url     text        not null default '',
  title_th       text        not null,
  title_en       text        not null default '',
  cover_media_id text        references media (id) on delete set null,
  video_provider text        not null default 'youtube' check (video_provider in ('youtube')),
  video_id       text        not null,
  published_on   date,
  sort_order     integer     not null default 0,
  /* หลังบ้านเมนูอาหาร (migration 0021 · รอบที่ 135) — ร่าง/เผยแพร่ + ถังขยะ */
  status         text        not null default 'published' check (status in ('draft', 'published')),
  deleted_at     timestamptz,
  updated_at     timestamptz not null default now(),
  updated_by     text
);

create index if not exists recipe_order_idx on recipe (sort_order, id);
create index if not exists recipe_source_idx on recipe (source_id);
create index if not exists recipe_admin_idx on recipe (deleted_at, status, sort_order, id);

-- ── ข่าวสาร & กิจกรรม ที่นำเข้าจากเว็บเดิม (S5 · migration 0018) ────────────────
-- 151 ข่าว (2018–2026) · เนื้อหาเก็บเป็น **บล็อกเรียงลำดับ** (ย่อหน้า/หัวข้อ/รูป) ไม่เก็บ HTML ดิบ
--   ⚠️ ต้นฉบับวางมาจาก Facebook (HTML เละ + รูปไม่มี alt) ⇒ ต้องผ่าน `parseNewsBody()` เสมอ
-- · id = 'n' + source_id และพาธหน้าเว็บ = `/news/<source_id>` (ตัวเลขล้วน)
-- · published_at เป็น timestamptz (ต้นฉบับเป็นเวลาไทย) · อ่านกลับด้วย `at time zone 'Asia/Bangkok'`
-- · ภาพ (ปก/ในเนื้อหา) เก็บใน `media` · ใน `body` เก็บ **mediaId** (มติ D9/D11)
create table if not exists news (
  id              text        primary key,
  source_id       text        not null,
  source_url      text        not null default '',
  title_th        text        not null,
  title_en        text        not null default '',
  excerpt_th      text        not null default '',
  excerpt_en      text        not null default '',
  cover_media_id  text        references media (id) on delete set null,
  body            jsonb       not null default '[]'::jsonb,
  published_at    timestamptz,
  published_label text        not null default '',
  updated_at      timestamptz not null default now(),
  updated_by      text,
  -- รอบที่ 123: หลังบ้านข่าว (แบบ WP Posts)
  status text not null default 'published',   -- draft | published
  deleted_at timestamptz
);

create index if not exists news_published_idx on news (published_at desc nulls last, id desc);
create index if not exists news_source_idx on news (source_id);

-- ── ยังไม่สร้างในเฟสนี้ (ตั้งใจ) ───────────────────────────────────────────────
--  * ถังเก็บไฟล์แยก (S3/R2) → ใช้เมื่อหน้าเว็บจริงไม่ได้อยู่ในเครื่องเดียวกับฐานข้อมูล

-- รอบที่ 123: ดัชนีหน้ารายการหลังบ้าน (กรองถังขยะ/สถานะ แล้วเรียงใหม่สุดก่อน)
create index if not exists news_admin_idx on news (deleted_at, status, published_at desc nulls last, id desc);
