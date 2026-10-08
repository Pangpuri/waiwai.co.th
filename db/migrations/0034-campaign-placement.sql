/*
  รอบที่ 198 — "การ์ดแคมเปญ" แสดงได้หลายหน้า โดย **ตำแหน่ง (จุดยึด) แยกกันต่อหน้า** (migration 0034)

  ที่มา: มติเจ้าของ 2026-10-08 *"รวมแคมเปญและข่าวสารล่าสุดไว้ที่หน้าข่าวสาร"* + เลือกแบบ
  *"ยกการ์ดแคมเปญไปหน้าข่าวสารด้วย (ตำแหน่งแยกต่อหน้า)"*

  โครง
  - `campaign_placement` = ตำแหน่งของ **แคมเปญหนึ่งใบ บนหน้าหนึ่ง** (คีย์คู่ campaign_id + page)
  - `page` = หน้าปลายทาง (`news` เป็นค่าแรกที่เปิดใช้) · `is_enabled` = เปิด/ปิดการ์ดบนหน้านั้น
  - **หน้าแรกไม่ย้ายข้อมูล**: ยังใช้ `campaign.anchor_x`/`anchor_y` เดิมเป๊ะ (ไม่แตะการ์ดที่ขึ้นอยู่จริง)
    ⇒ ตารางนี้เก็บ "หน้าเพิ่มเติม" — ประตูอ่านของหน้าแรกจึงไม่เปลี่ยนพฤติกรรมแม้แต่ไบต์เดียวถ้าไม่ตั้งค่าเพิ่ม

  กติกา
  - `campaign_id` อ้าง `campaign(id)` แบบ `on delete cascade` ⇒ ลบแคมเปญถาวร = ตำแหน่งหายตาม
  - จุดยึดเป็นเปอร์เซ็นต์ 0–100 (บังคับที่ DB ด้วย check) — ค่าเดียวกันกับที่ตัวเรนเดอร์ใช้ทั้งหน้าเว็บ/พรีวิว
  - `create table if not exists` + `create index if not exists` = รันซ้ำได้ ไม่พัง
  - ⚠️ ต้องรันกับปลายทาง (คลาวด์) ด้วย: `DATABASE_URL=<cloud> npm run db:migrate`
*/

create table if not exists campaign_placement (
  campaign_id text not null references campaign(id) on delete cascade,
  page text not null,
  anchor_x integer not null default 8,
  anchor_y integer not null default 50,
  is_enabled boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  updated_by text not null default '',
  primary key (campaign_id, page),
  constraint campaign_placement_anchor_x_check check (anchor_x >= 0 and anchor_x <= 100),
  constraint campaign_placement_anchor_y_check check (anchor_y >= 0 and anchor_y <= 100)
);

/* หน้าเว็บอ่าน "การ์ดของหน้านี้" ⇒ ดัชนีเฉพาะแถวที่เปิดใช้ */
create index if not exists campaign_placement_page_idx
  on campaign_placement (page)
  where is_enabled;
