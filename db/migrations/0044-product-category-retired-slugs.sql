/*
  รอบที่ 286 (ปิดหนี้ D-280-3): ที่อยู่เดิมของ "หมวดที่ถูกลบ" ต้องไม่ตายทาง

  ที่มา: มติเจ้าของ 2026-10-15 — *"เด้งไปหน้า /products (308)"*
    · รอบที่ 280 ให้หมวดที่ว่าง "ลบถาวร" ได้ แต่ FK ของตารางประวัติเป็น `on delete cascade`
      ⇒ พอหมวดหาย **ประวัติที่อยู่ถูกล้างทั้งชุด** ⇒ `/products/<ที่อยู่เดิม>` กลายเป็น 404
      และระบบแยกไม่ออกระหว่าง "ไม่เคยมีที่อยู่นี้" กับ "เคยมีแล้วถูกยกเลิก"
    · ไฟล์นี้เปลี่ยน FK เป็น `on delete set null` + เพิ่มคอลัมน์ `retired_at`/`retired_by`
      ⇒ แถวประวัติ **อยู่ต่อ** พร้อมสถานะ "ปลดระวาง" แล้วหน้าเว็บทำ 308 ไปหน้า `/products`

  ⚠️ ทำไมต้องมีคอลัมน์ `retired_at` ไม่ใช่ดูจาก `category_id is null` อย่างเดียว
     · แถวที่ `category_id` เป็น null = "ไม่มีหมวดแล้ว" (สาเหตุเดียวคือหมวดถูกลบ)
     · เก็บเวลา/คนลบไว้เพื่อ **ตรวจย้อนหลังได้** ว่าที่อยู่ที่ตายไปนี้ตายเพราะคำสั่งใคร (audit ในตาราง)

  idempotent: DDL — `drop constraint if exists` / `add column if not exists` / `create index if not exists`
*/
alter table product_category_slug_history alter column category_id drop not null;

alter table product_category_slug_history
  drop constraint if exists product_category_slug_history_category_id_fkey;

/* หมวดถูกลบ ⇒ ประวัติ **ไม่ถูกลบ** แต่ถูกปลดออกจากหมวด (แถวอยู่ต่อเพื่อให้รู้ว่า "เคยมีที่อยู่นี้") */
alter table product_category_slug_history
  add constraint product_category_slug_history_category_id_fkey
  foreign key (category_id) references product_category (id) on delete set null;

alter table product_category_slug_history add column if not exists retired_at timestamp with time zone;
alter table product_category_slug_history add column if not exists retired_by text not null default '';

/* มองหาเฉพาะแถวที่ปลดระวาง (มีไม่มาก) — ใช้ตอนหน้าเว็บตัดสินว่าจะเด้งไป /products ไหม */
create index if not exists product_category_slug_history_retired_idx
  on product_category_slug_history (retired_at)
  where retired_at is not null;
