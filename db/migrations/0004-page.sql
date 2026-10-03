-- ─────────────────────────────────────────────────────────────────────────────
-- waiwai.com — migration 0004: ตาราง "หน้า" (page) — W1
--
-- ผู้ใช้สั่ง รอบที่ 61: *"เมนูก็คงเอาไว้ตามหน้า … ซึ่งแต่ละหน้าก็เปลี่ยนชื่อได้ด้วยไปเลย"*
-- ⇒ "หน้า" กลายเป็นวัตถุจริงในฐานข้อมูล (แบบ WordPress: Posts/Pages) และ **ชื่อหน้า = ชื่อเมนูของหน้านั้น**
--
-- ⚠️ idempotent ทุกคำสั่ง ⇒ รันกับฐานข้อมูลที่มีข้อมูลอยู่แล้วได้
-- ⚠️ seed 9 หน้าให้ตรงกับเมนูปัจจุบันในโค้ด (features/shell/nav.ts + พจนานุกรม)
--    ค่าเริ่มต้นต้องเหมือนเดิมเป๊ะ ⇒ ถ้าลบข้อมูลออก หน้าเว็บยังใช้เมนูในโค้ดได้ตามปกติ
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists page (
  id           text        primary key,
  name_th      text        not null,
  name_en      text        not null default '',
  /** ลำดับในเมนู (น้อย = ซ้าย/บน) */
  menu_order   integer     not null default 0,
  /** เปิดแสดงในเมนูหรือไม่ (ปิดไว้ = ซ่อนจากเมนู ยังเข้าหน้าได้) */
  in_menu      boolean     not null default true,
  /**
   * วิธีแก้เนื้อหาของหน้านี้
   *   blocks   = แก้ด้วยบล็อกได้ (มีเอกสารใน page_document)
   *   designed = ใช้เลย์เอาต์ที่ออกแบบไว้ในโค้ด (ยังไม่แปลงเป็นบล็อก)
   */
  editor       text        not null default 'designed' check (editor in ('blocks', 'designed')),
  updated_at   timestamptz not null default now(),
  updated_by   text
);

create index if not exists page_menu_order_idx on page (menu_order, id);

-- ── seed 9 หน้าตามเมนูปัจจุบัน (ค่าไทย/อังกฤษตรงกับพจนานุกรม) ──────────────────
insert into page (id, name_th, name_en, menu_order, editor) values
  ('home',           'หน้าแรก',            'Home',             10, 'blocks'),
  ('about',          'บริษัท',              'Company',          20, 'designed'),
  ('certifications', 'ใบรับรองมาตรฐาน',    'Certifications',   30, 'designed'),
  ('executives',     'คณะผู้บริหาร',        'Management team',  40, 'designed'),
  ('products',       'ผลิตภัณฑ์',           'Products',         50, 'designed'),
  ('recipes',        'เมนูอาหาร',           'Recipes',          60, 'designed'),
  ('news',           'ข่าวสาร & กิจกรรม',  'News & Activities',70, 'designed'),
  ('careers',        'ร่วมงานกับไวไว',      'Careers',          80, 'designed'),
  ('contact',        'ติดต่อเรา',           'Contact us',       90, 'designed')
on conflict (id) do nothing;
