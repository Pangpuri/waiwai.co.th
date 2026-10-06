-- ─────────────────────────────────────────────────────────────────────────────
-- waiwai.com — migration 0023: ช่อง "ภาษาอังกฤษ" ของสินค้าให้การตลาดกรอกเอง
--
-- รอบที่ 141 · มติเจ้าของ (2026-10-06):
--   *"รายละเอียดสินค้า EN ข้ามได้เลย เพราะเราจะไม่ได้รับผิดชอบส่วนนี้ เป็นของการตลาด
--     เขาใส่ข้อมูลเอง อาจจะทำฟิลด์ภาษาอังกฤษไว้ให้เผื่อเขาอยากจะใส่เอง"*
--
-- ⇒ **ทีมเว็บไม่แปล** แต่ต้อง **มีช่องให้กรอก** ครบทุกช่องที่ผู้อ่านภาษาอังกฤษควรเห็น
--   ก่อนรอบนี้ `product` มี `_en` แค่ name/group/tagline ⇒ รายละเอียด/ส่วนผสม/น้ำหนัก/บรรจุภัณฑ์
--   การตลาดกรอก EN ไม่ได้เลย (และ `tagline_en` ที่มีอยู่ก็ไม่เคยถูกแสดงบนหน้าเว็บ — แก้ที่โค้ด)
--
-- ค่าเริ่มต้น = '' (ว่าง) ⇒ หน้า EN **ถอยไปใช้ไทย** ตามมติ D3/D19 (ไม่ต้องมีข้อมูลครบก่อนเปิดเว็บ)
--
-- ⚠️ หลังรันในเครื่องแล้ว **ต้องรันกับฐานข้อมูลปลายทางด้วย** (บทเรียนรอบที่ 105)
--    `DATABASE_URL=<ปลายทาง> npm run db:migrate` แล้ว `npm run db:status` ต้องขึ้น "ครบ"
-- ⚠️ `fda_number` เป็นรหัส (ตัวเลข/อักษร) ⇒ ไม่มีคู่ EN โดยเจตนา
-- ⚠️ idempotent ทุกคำสั่ง
-- ─────────────────────────────────────────────────────────────────────────────

alter table product add column if not exists details_en     text not null default '';
alter table product add column if not exists allergens_en   text not null default '';
alter table product add column if not exists net_weight_en  text not null default '';
alter table product add column if not exists packaging_en   text not null default '';
