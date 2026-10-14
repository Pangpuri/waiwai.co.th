/*
  รอบที่ 281 (ปิดหนี้ D-280-1): เติม "แถวหน้าตัวสร้าง" (`page`) ให้ **หมวดสินค้าทุกหมวดที่มีอยู่แล้ว**

  ที่มา: มติเจ้าของ D30 ข้อ 3 — *"หมวดใหม่ได้จอตัวสร้างหน้าเว็บอัตโนมัติ"*
    · รอบที่ 280 ทำให้หน้าเว็บจริง/sitemap/301 ทำงานกับหมวดใหม่ได้แล้ว แต่ **จอตัวสร้างยังเปิดไม่ได้**
      เพราะจอ `/admin/builder/[page]` หา `currentPage` จาก **ตาราง `page`** — หมวดที่สร้างใหม่ไม่มีแถว
    · ตั้งแต่รอบนี้ `createProductCategoryAdmin()` สร้างแถว `page` (`product-<รหัสภายในหมวด>`) ให้พร้อมหมวด
      ใน transaction เดียว ⇒ ไฟล์นี้เก็บ **หมวดที่มีอยู่ก่อนหน้า** ให้มีแถวเหมือนกัน (idempotent)

  ⚠️ `page_document` ไม่มี FK กับ `page` ⇒ ไฟล์นี้แตะแค่ตาราง `page` (ไม่แตะเอกสาร/ประวัติ)
  ⚠️ หมวดในโค้ด 6 ใบมีแถวอยู่แล้ว (migration 0015) ⇒ ไฟล์นี้จะ **ไม่ทับค่าเดิม** (`on conflict do nothing`)

  idempotent: DML — `insert … select … on conflict (id) do nothing`
*/

insert into page (id, name_th, name_en, menu_order, in_menu, editor, updated_at, updated_by)
select
  /* id ของหน้า = `product-` + รหัสภายในของหมวด (ไม่ใช่ slug — เจ้าของแก้ slug ได้) */
  'product-' || c.id,
  /* `name_th` ห้ามว่าง (สคีมา not null) ⇒ ถอยไปใช้รหัสหมวด */
  coalesce(nullif(trim(c.name_th), ''), c.id),
  coalesce(c.name_en, ''),
  /* ต่อท้ายลำดับของเดิม · หน้าเหล่านี้ `in_menu = false` ⇒ ลำดับมีผลแค่ในตาราง */
  coalesce((select max(menu_order) from page), 50) + c.sort_order,
  false,
  'blocks',
  now(),
  'migration-0043'
from product_category c
on conflict (id) do nothing;
