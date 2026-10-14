/*
  รอบที่ 279 (มติเจ้าของ D30) — ฐานรากสำหรับ "หมวดสินค้าแบบไดนามิก + เปลี่ยน slug ได้ + 301"

  ที่มา: เจ้าของเลือก (2026-10-14)
    · slug ของหมวด **แก้ได้ภายหลัง** ⇒ ต้องมี **ตารางประวัติ slug** เพื่อทำ 301
    · ทำ 301 รอบนี้เลย · หมวดใหม่มีจอตัวสร้างหน้าเว็บอัตโนมัติ · หมวดว่างลบได้

  ⚠️ ทำไมเพิ่ม "คอลัมน์ slug" แทนการแก้ `id` ตรง ๆ
     `product_category.id` เป็น **คีย์ที่ตารางอื่นอ้างอยู่** (`product.category_id`, ค่าเริ่มต้น/พรีเซ็ตของหมวด)
     ถ้าเปลี่ยน `id` = ต้องไล่แก้ FK/ข้อมูลอ้างอิงทุกที่ (เสี่ยงข้อมูลพัง)
     ⇒ แยก `slug` เป็น "ที่อยู่บนเว็บ" ที่แก้ได้อิสระ · `id` ยังเป็นรหัสภายในที่ไม่เปลี่ยนตลอดชีพ
     ⇒ รันไฟล์นี้แล้ว **URL เดิมไม่เปลี่ยนสักเส้น** เพราะ slug เริ่มต้น = id เดิม

  idempotent: DDL (add column if not exists / create table if not exists) + เติมค่าเฉพาะแถวที่ยังว่าง
*/

/* ── 1) คอลัมน์ slug (ที่อยู่บนเว็บ · แก้ได้) ─────────────────────────────────── */
alter table product_category add column if not exists slug text;

/* เติมค่าเริ่มต้น = id เดิม ⇒ URL ปัจจุบันไม่เปลี่ยน */
update product_category set slug = id where slug is null or slug = '';

alter table product_category alter column slug set not null;

create unique index if not exists product_category_slug_key on product_category (slug);

/* ── 2) ประวัติ slug (ใช้ทำ 301 เมื่อเปลี่ยนที่อยู่) ───────────────────────────── */
create table if not exists product_category_slug_history (
  /* slug เก่า = คีย์หลัก ⇒ หนึ่งที่อยู่ชี้ไปได้แค่หมวดเดียว (ห้ามชนกัน) */
  slug        text        primary key,
  category_id text        not null references product_category (id) on delete cascade,
  created_at  timestamp with time zone not null default now(),
  created_by  text        not null default ''
);

create index if not exists product_category_slug_history_category_idx
  on product_category_slug_history (category_id, created_at desc);
