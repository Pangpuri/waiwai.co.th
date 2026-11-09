/*
  รอบที่ 338 (2026-11-09): SEO override รายข่าว — เครื่องมือสำหรับการตลาด

  ที่มา: ข่าวแต่ละชิ้นมี URL ของตัวเอง (`/news/<source_id>`) และถูกแชร์บ่อย
  แต่ metadata ใช้ชื่อข่าว/คำโปรย/ภาพปกอัตโนมัติเท่านั้น ⇒ แก้หัวข้อ/คำอธิบาย/รูปแชร์
  ให้เหมาะกับเครื่องค้นหา/โซเชียลไม่ได้

  หลักการ:
  - ทุกช่องเว้นว่างได้ = ใช้ค่าเดิมจากข้อมูลข่าว (ไม่ตั้งค่า = หน้าตาเว็บเหมือนเดิมเป๊ะ)
  - `og_image_path` เป็น **พาธ** `/media/<id>` ตามมติ D9 (ห้าม URL เต็ม)
  - `seo_noindex` ใช้สั่งไม่ให้เครื่องค้นหาเก็บข่าวชิ้นนั้น (ค่าเริ่มต้น = false)

  idempotent: `add column if not exists` ทุกคำสั่ง
*/

alter table news add column if not exists seo_title_th text not null default '';
alter table news add column if not exists seo_title_en text not null default '';
alter table news add column if not exists seo_description_th text not null default '';
alter table news add column if not exists seo_description_en text not null default '';
alter table news add column if not exists og_image_path text not null default '';
alter table news add column if not exists seo_noindex boolean not null default false;
