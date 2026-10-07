/*
  รอบที่ 193 — "ภาพของแคมเปญ" (migration 0032)

  เจ้าของแจ้ง: *"แคมเปญยังไม่มีการนำเข้าภาพมาใช้"* ⇒ การ์ดแคมเปญควรมีภาพของตัวเองได้
  (เลือกจากคลังภาพในเว็บ หรืออัปโหลดจากเครื่องผ่านช่องภาพกลาง `ImageDrop` ตัวเดียวกับที่อื่น)

  กติกา
  - เก็บเป็น **พาธในเว็บ** (`/media/<id>` หรือ `/slide/…`) ตามมติ D9 (ห้ามเก็บ URL เต็ม)
  - ว่างได้ = การ์ดข้อความล้วน (พฤติกรรมเดิมของแคมเปญที่ทำไว้รอบก่อน ไม่พัง)
  - คำอธิบายภาพ (alt) แยก 2 ภาษา โดยภาษาไทยบังคับเมื่อมีภาพ (`check:content`/validator)
  - ⚠️ ไม่มีตารางใหม่ ⇒ ไม่ต้องแก้ `PUBLIC_READ_TABLES`
  - ⚠️ ต้องรันกับปลายทาง (คลาวด์) ด้วย: `DATABASE_URL=<cloud> npm run db:migrate`
*/

alter table campaign add column if not exists image_path text not null default '';
alter table campaign add column if not exists image_alt_th text not null default '';
alter table campaign add column if not exists image_alt_en text not null default '';
