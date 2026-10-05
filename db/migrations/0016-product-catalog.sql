-- ─────────────────────────────────────────────────────────────────────────────
-- waiwai.com — migration 0016: สินค้า (นำเข้าจากเว็บเดิม) แยกตามหมวด
--
-- ที่มา: เจ้าของสั่ง (2026-10-05) *"สินค้าเราจะดึงข้อมูลมาจาก waiwai.co.th/… เอา[ข้อมูล]มาทั้งหมด
--        รวมถึงรายละเอียดแต่ละสินค้าด้วย ลงไว้ในฐานข้อมูลพร้อมแยกประเภทของแต่ละหมวดสินค้า"*
--
-- 3 ตาราง (มติเจ้าของ 2026-10-05: เลือก "ตารางใหม่" · รูป "โหลดเข้า DB")
--   product_category   — เนื้อหาที่ **นำเข้า** ของแต่ละหมวด (คำอธิบาย/ภาพ)
--                        ⚠️ **ไม่เก็บชื่อหมวด** — ชื่อที่เจ้าของยืนยันแล้วอยู่ในโค้ด `features/products/catalog.ts`
--                        (บทเรียนรอบที่ 22/101: ห้ามตีความชื่อแบรนด์เอง · และกันชื่อหลุดจากกัน 2 ที่)
--   product            — สินค้า 1 รายการ (ชื่อไทย/อังกฤษ · สายผลิตภัณฑ์ · คำโปรย · ข้อความรายละเอียด ·
--                        น้ำหนักสุทธิ · เลข อย. · ขนาดบรรจุ · ภาพ)
--   product_ingredient — ส่วนผสมต่อสินค้า (ไทย/อังกฤษ/%) เรียงตามลำดับในต้นฉบับ
--
-- ⚠️ รูปเก็บในตาราง `media` (มติ D11) · ที่นี่เก็บแค่ "id ของภาพ" (มติ D9 = ห้ามเก็บ URL เต็ม)
-- ⚠️ `media.sha256` ใหม่: ใช้ตรวจว่ารูปที่นำเข้าซ้ำเป็นไฟล์เดิม ⇒ ไม่กินที่ซ้ำ (import อีกรอบได้)
-- ⚠️ idempotent ทุกคำสั่ง (รันซ้ำได้ · ไม่ทับข้อมูล)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 0) ลายนิ้วมือไฟล์ภาพ (ใช้ dedupe ตอนนำเข้า · ไม่บังคับสำหรับภาพที่อัปโหลดจากหลังบ้าน) ──
alter table media add column if not exists sha256 text;

create index if not exists media_sha256_idx on media (sha256);

-- ── 1) หมวดสินค้า: เก็บเฉพาะ "เนื้อหาที่นำเข้า" (คำอธิบาย · ภาพ) ─────────────────
create table if not exists product_category (
  /** id = slug เดียวกับ `features/products/catalog.ts` (instant-noodles, quick-zabb, …) */
  id             text        primary key,
  /** id ของหน้าในเว็บเดิม (40599, 15235, …) — ใช้ตรวจย้อนหลังว่านำเข้าจากไหน */
  source_id      text,
  /** คำอธิบายหมวดจากเว็บเดิม (ไทยเท่านั้นที่มีจริง · อังกฤษเว้นว่างได้) */
  description_th text        not null default '',
  description_en text        not null default '',
  /** ภาพหัวหมวด (ถ้ามี) — ชี้ไป `media` (มติ D9/D11) */
  image_media_id text        references media (id) on delete set null,
  updated_at     timestamptz not null default now(),
  updated_by     text
);

-- ── 2) สินค้า ────────────────────────────────────────────────────────────────
create table if not exists product (
  /** id = 'p' + source_id (เช่น p15136) — คงที่เพื่อให้นำเข้าซ้ำได้แบบ idempotent */
  id             text        primary key,
  category_id    text        not null references product_category (id) on delete cascade,
  source_id      text        not null,
  source_url     text        not null default '',
  /** ชื่อสินค้า (มาจากเว็บเดิม) — ชื่ออังกฤษว่างได้ ⇒ หน้าเว็บถอยไปใช้ชื่อไทย */
  name_th        text        not null,
  name_en        text        not null default '',
  /** สายผลิตภัณฑ์ในตารางต้นฉบับ (เช่น 'บะหมี่กึ่งสำเร็จรูปควิกคัพ' / 'Instant Noodles Quick Cup') */
  group_th       text        not null default '',
  group_en       text        not null default '',
  /** คำโปรยสั้นจากหน้ารายละเอียด (เว็บเดิมมีแต่ไทย) */
  tagline_th     text        not null default '',
  tagline_en     text        not null default '',
  /** ข้อความรายละเอียดจากต้นฉบับ (วัตถุเจือปน ฯลฯ) — เก็บดิบตามต้นฉบับ ไม่แต่งเพิ่ม */
  details_th     text        not null default '',
  allergens_th   text        not null default '',
  net_weight_th  text        not null default '',
  fda_number     text        not null default '',
  packaging_th   text        not null default '',
  /** ภาพสินค้า — ชี้ไป `media` */
  image_media_id text        references media (id) on delete set null,
  /** ลำดับในหมวด (ตามลำดับที่ปรากฏบนเว็บเดิม) */
  sort_order     integer     not null default 0,
  updated_at     timestamptz not null default now(),
  updated_by     text
);

create index if not exists product_category_order_idx on product (category_id, sort_order, id);
create index if not exists product_source_idx on product (source_id);

-- ── 3) ส่วนผสมต่อสินค้า ─────────────────────────────────────────────────────
create table if not exists product_ingredient (
  product_id   text    not null references product (id) on delete cascade,
  sort_order   integer not null,
  name_th      text    not null,
  name_en      text    not null default '',
  /** เปอร์เซ็นต์ตามต้นฉบับ (ข้อความ — บางรายการว่าง/ไม่ใช่ตัวเลข) */
  percent_text text    not null default '',
  primary key (product_id, sort_order)
);
