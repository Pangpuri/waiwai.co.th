-- ─────────────────────────────────────────────────────────────────────────────
-- waiwai.com — migration 0039: หลังบ้าน "หมวดสินค้า" (มติเจ้าของ 2026-10-14 · มติ D25 · รอบที่ 264)
--
-- ที่มา (คำเจ้าของ 2026-10-10):
--   *"ต้องมีหน้าหมวดสินค้า … เก็บรูปไว้ในฐานข้อมูลเป็นรูปค่าเริ่มต้น และโครงสร้างตามหน้าบ้านเป็นค่าเริ่มต้น
--     หลังบ้านมีค่าเริ่มต้นทั้งหมดของหน้าบ้าน และสามารถปรับเปลี่ยนรูปได้ เพิ่มหมวดได้ เผื่อมีสินค้าเพิ่มในอนาคต
--     และสามารถคืนค่าเริ่มต้นได้ เพราะงั้นค่าเริ่มต้นจะเก็บถาวรเสมอ เก็บพรัซเซ็ตได้"*
--
-- ข้อตัดสิน 5 ข้อ (ถาม-ตอบ 2026-10-14 · บันทึกใน PRODUCT_ROADMAP § 8/§ 9)
--   1. slug ของหมวดใหม่ = สร้างอัตโนมัติจากชื่ออังกฤษ และ **ล็อกแก้ทีหลัง** ⇒ ยังไม่ต้องมีระบบ 301
--   2. เพดานจำนวน = **12 หมวด** (`MAX_PRODUCT_CATEGORIES`)
--   3. ลบหมวด = **ยังไม่ให้ลบ** ⇒ ใช้ `is_hidden` = "ซ่อนจากเว็บ" แทน (ไม่มีสินค้าตกงาน)
--   4. "ค่าเริ่มต้น" = ชุด ณ วันนี้ (6 หมวดในโค้ด) **ล็อกถาวร** ⇒ ตาราง `product_category_default`
--      เป็น **ข้อมูลที่ UI ห้ามเขียน** (อ่านอย่างเดียวจากแอป · เติมด้วยสคริปต์แบบ fill-only)
--   5. พรีเซ็ต = เก็บไม่จำกัด · ไม่หมดอายุ · ไม่ขึ้นหน้า `/privacy` (ไม่ใช่ข้อมูลส่วนบุคคล)
--
-- สิ่งที่ migration นี้ทำ
--   · `product_category.sort_order` — ลำดับการแสดง (เดิมลำดับมาจากโค้ด `CATALOG_ITEMS` เท่านั้น)
--   · `product_category.is_hidden`  — ซ่อนจากเว็บโดยไม่ลบ (มติข้อ 3)
--   · `product_category_default`    — สำเนาค่าเริ่มต้นถาวร (immutable · 1 แถว/หมวด)
--   · `product_category_preset`     — ชุดสำเร็จของหมวด (payload JSONB)
--
-- ⚠️ **คอลัมน์ใหม่มีค่าเริ่มต้นที่ปลอดภัย** ⇒ ยังไม่รันสคริปต์/ยังไม่แก้ = หน้าเว็บหน้าตาเหมือนเดิมเป๊ะ
--    (`sort_order` สำหรับ 6 หมวดถูกเติมจากลำดับในโค้ดด้านล่าง · `is_hidden` = false ทุกแถว)
-- ⚠️ ตาราง `product_category_default` **ห้ามถูก UPDATE/DELETE จากแอป** (มีเทสต์สแกนซอร์สกันไว้)
--    ⇒ "คืนค่าเริ่มต้น" = อ่านจากตารางนี้แล้วเขียนลง `product_category` (ไม่ใช่กลับกัน)
-- ⚠️ ต้องรันกับฐานข้อมูลปลายทางด้วย (บทเรียนรอบที่ 105)
--    `DATABASE_URL=<ปลายทาง> npm run db:migrate` แล้ว `npm run db:status` ต้องขึ้น "ครบ"
-- ⚠️ ชื่อคอลัมน์/ตารางมาจากโค้ดเท่านั้น (ไม่มีค่าจากผู้ใช้ในไฟล์นี้)
-- ─────────────────────────────────────────────────────────────────────────────

/* ── 1) คอลัมน์ใหม่ของหมวดสินค้า ─────────────────────────────────────────────── */

/* ลำดับการแสดง: 100 = ต่อท้ายหมวดในโค้ด (10..60) — สคริปต์/หลังบ้านเป็นคนตั้งค่าจริง */
alter table product_category add column if not exists sort_order integer not null default 100;

/* ซ่อนจากเว็บโดยไม่ลบ (มติ D25 ข้อ 3) */
alter table product_category add column if not exists is_hidden boolean not null default false;

create index if not exists product_category_order_idx on product_category (sort_order, id);

/* ── 2) เติมลำดับตั้งต้นให้ 6 หมวดในโค้ด (10, 20, …, 60) ───────────────────────── */

-- idempotent: conditional-update
--   เติมเฉพาะแถวที่ **ยังอยู่ที่ค่าเริ่มต้น 100** ⇒ รันซ้ำไม่มีผล
--   และ **ไม่ทับลำดับที่ผู้ดูแลจัดเองแล้ว** (ค่าที่จัดเองจะไม่ใช่ 100)
update product_category
   set sort_order = v.sort_order
  from (values
    ('instant-noodles',  10),
    ('dried-vermicelli', 20),
    ('serda',            30),
    ('quick-zabb',       40),
    ('noodie',           50),
    ('rod-ded',          60)
  ) as v(id, sort_order)
 where product_category.id = v.id
   and product_category.sort_order = 100;

/* ── 3) ค่าเริ่มต้นถาวร (immutable) ──────────────────────────────────────────── */

/*
  สำเนา "ชุดค่าเริ่มต้น" ของหมวด — 1 แถวต่อหมวด · **แอปอ่านได้อย่างเดียว**
  · เติมด้วย `npm run products:category-defaults` (fill-only: `on conflict do nothing`)
  · "คืนค่าเริ่มต้น" = คัดลอกแถวนี้ลง `product_category`
  · ภาพ: ชี้ `media` (มติ D9/D11 — ไม่เก็บ URL เต็ม) · `on delete set null` = ลบภาพแล้วค่าเริ่มต้นไม่หาย
*/
create table if not exists product_category_default (
  /** id = slug ของหมวด (เฉพาะหมวดในโค้ด 6 หมวด — หมวดที่สร้างใหม่ไม่มีค่าเริ่มต้น) */
  id             text        primary key,
  name_th        text        not null default '',
  name_en        text        not null default '',
  description_th text        not null default '',
  description_en text        not null default '',
  image_media_id text        references media (id) on delete set null,
  logo_media_id  text        references media (id) on delete set null,
  sort_order     integer     not null default 100,
  captured_at    timestamptz not null default now(),
  captured_by    text        not null default ''
);

/* ── 4) พรีเซ็ตของหมวดสินค้า (มติ D25 ข้อ 5) ───────────────────────────────────── */

/*
  ชุดสำเร็จของหมวด: `payload` = JSONB `{ version: 1, categories: [CategorySnapshot, …] }`
  · ชื่อซ้ำ (ไม่สนตัวพิมพ์) = เขียนทับ (แบบเดียวกับพรีเซ็ตของส่วนกลาง W3b)
  · เก็บไม่จำกัดจำนวนชุด · ไม่หมดอายุ · **ไม่ขึ้นหน้า /privacy** (ไม่ใช่ข้อมูลส่วนบุคคล)
*/
create table if not exists product_category_preset (
  id         text        primary key,
  name       text        not null,
  payload    jsonb       not null,
  created_at timestamptz not null default now(),
  created_by text        not null default '',
  updated_at timestamptz not null default now(),
  updated_by text        not null default ''
);

/* ชื่อชุดต้องไม่ซ้ำแบบไม่สนตัวพิมพ์ (ผู้ใช้กด "บันทึกชุด" ชื่อเดิม = เขียนทับชุดเดิม) */
create unique index if not exists product_category_preset_name_idx
  on product_category_preset (lower(name));
