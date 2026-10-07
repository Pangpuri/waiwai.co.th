/*
  รอบที่ 184 — โมดูล "สไลด์ & แคมเปญ" (ชั้นข้อมูล)

  ที่มา: เจ้าของเลือก (2026-10-07) ให้ **แยกเป็นโมดูลของตัวเอง** + เพิ่มเมนูในไซด์บาร์ ต่อจาก "ส่วนกลางของเว็บ"
  เหตุผล: สไลด์หน้าแรกเป็นของระดับเว็บ + มีมิติเวลา (แคมเปญมีวันเริ่ม–วันจบ) และจะมี **การ์ดวางบนสไลด์**
  ⇒ โมเดล "บล็อกในหน้า" (มีแค่ publish_at ของทั้งหน้า) ไม่พอ

  เฟส 1 (migration นี้): ตารางสไลด์ + ย้ายภาพ hero 3 ใบที่ฝังในโค้ด (`features/home/slides.ts`) ขึ้นฐานข้อมูล
  เฟสถัดไป: การ์ดบนสไลด์ (`hero_slide_card`) · ช่วงเวลาแคมเปญ · เอฟเฟค · หน้าจอหลังบ้าน

  กติกาที่ใช้ร่วมกับของเดิม
  - จุดโฟกัส/ซูม = เปอร์เซ็นต์ 0–100 และตัวคูณ 1–2 (ตรงกับ `lib/blocks/hero-slides.ts` ที่ทำไว้รอบ 183)
  - `media_path` เก็บ **พาธ** ไม่เก็บ URL เต็ม (มติ D9) · ภาพในคลังใช้ `/media/<id>`
  - ถังขยะ = `deleted_at` + `deleted_by` (คู่กันเสมอ · เหมือนตารางเนื้อหารอบ 177)
  - หน้าเว็บอ่านเฉพาะ `is_active and deleted_at is null` (ยังไม่เปิดใช้ในเฟสนี้ — ตัวอ่านอยู่ในเฟสถัดไป)
  - ⚠️ ต้องรันกับปลายทาง (คลาวด์) ด้วย: `DATABASE_URL=<cloud> npm run db:migrate` (บทเรียนรอบ 105)
*/

create table if not exists hero_slide (
  id text primary key,
  sort_order integer not null default 0,
  media_path text not null,
  alt_th text not null default '',
  alt_en text not null default '',
  /* จุดโฟกัส (เปอร์เซ็นต์ของภาพ) + ระดับซูม — ใช้เป็น object-position/scale เหมือนบล็อก hero */
  focus_x integer not null default 50 check (focus_x between 0 and 100),
  focus_y integer not null default 50 check (focus_y between 0 and 100),
  zoom numeric(4, 2) not null default 1 check (zoom between 1 and 2),
  /* เปิด/ปิดการแสดงโดยไม่ต้องลบ (เช่น ปิดชั่วคราว) */
  is_active boolean not null default true,
  deleted_at timestamptz,
  deleted_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text not null default ''
);

/* หน้าเว็บไล่ลำดับเฉพาะใบที่ใช้งานอยู่ ⇒ index บางส่วน (partial) พอและเล็กกว่า */
create index if not exists hero_slide_order_idx on hero_slide (sort_order) where deleted_at is null;
