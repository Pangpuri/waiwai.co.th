/*
  รอบที่ 190 — "แคมเปญ" เป็นเอนทิตีของตัวเอง (migration 0031)

  มติเจ้าของ 2026-10-07 (คำต่อคำ): *"การ์ดบนสไลด์แคมเปญไปต่อท้ายทีละแคมเปญเพื่อเปลี่ยนไปเรื่อย ๆ ไม่ดีนะครับ
  แคมเปญซ้ำซ้อน เอฟเฟคซ้ำซ้อนไม่อิสระจากกัน ต้องทำหน้าเฉพาะแคมปญขึ้นมาแล้วตัดแคมเปญที่ต่อกับสไลด์แบบ 1:1 ออก"*

  ดีไซน์ใหม่
  -------------
  - `campaign` = แคมเปญหนึ่งใบ (ของตัวเอง): ชื่อไว้ดูในหลังบ้าน · ข้อความ 2 ภาษา · ปุ่ม+ลิงก์ ·
    จุดยึดบนสไลด์ · ช่วงเวลาเริ่ม-จบ · เปิด-ปิด · **สถานะฉบับร่าง/เผยแพร่** · ถังขยะ · audit
  - `campaign_slide` = "แคมเปญนี้ไปแสดงบนสไลด์ไหน" (ผูกได้หลายสไลด์ ไม่ใช่ 1:1)
    · **ไม่ผูกสไลด์เลย = แสดงบนทุกสไลด์** (ค่าเริ่มต้น — เอกสารไว้ใน `lib/campaigns/model.ts`)
  - ย้ายการ์ดเดิมจากรอบ 188 (`hero_slide_card`) → แคมเปญใบละ 1 อัน + ผูกกับสไลด์เดิมของมัน
    · id ใหม่คิดจาก md5 ของ id เดิม ⇒ **รันซ้ำไม่มีผล** (idempotent)
    · ⚠️ **ยังไม่ลบตาราง `hero_slide_card`** ในรอบนี้ (เก็บไว้ตรวจย้อนหลัง) — จะถอดโค้ดที่ใช้ทีหลังอย่างมีสติ
  - ⚠️ ไม่มีตารางใหม่ที่หน้าเว็บอ่าน ⇒ ยังไม่ต้องแก้ `PUBLIC_READ_TABLES` ในรอบนี้
  - ⚠️ ต้องรันกับปลายทาง (คลาวด์) ด้วย: `DATABASE_URL=<cloud> npm run db:migrate`
*/

create table if not exists campaign (
  id text primary key,
  /* ชื่อสำหรับดูในหลังบ้าน (ไม่ขึ้นเว็บ) — ช่วยกัน "แคมเปญว่าง/ซ้ำ" ตามที่เจ้าของกังวล */
  name text not null default '',
  title_th text not null default '',
  title_en text not null default '',
  body_th text not null default '',
  body_en text not null default '',
  cta_label_th text not null default '',
  cta_label_en text not null default '',
  cta_href text not null default '',
  /* จุดยึดการ์ดบนพื้นที่สไลด์ (เปอร์เซ็นต์ 0–100) */
  anchor_x integer not null default 8,
  anchor_y integer not null default 50,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  /* ร่าง/เผยแพร่ — คุมการมองเห็นของหน้าเว็บ (แบบเดียวกับข่าว/เมนู) */
  status text not null default 'draft' check (status in ('draft', 'published')),
  sort_order integer not null default 0,
  deleted_at timestamptz,
  deleted_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text not null default '',
  constraint campaign_anchor_x_check check (anchor_x between 0 and 100),
  constraint campaign_anchor_y_check check (anchor_y between 0 and 100),
  constraint campaign_window_check check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create index if not exists campaign_live_idx on campaign (sort_order) where deleted_at is null;

/* "แคมเปญไปแสดงบนสไลด์ไหน" — ผูกได้หลายสไลด์ (N:M) */
create table if not exists campaign_slide (
  campaign_id text not null references campaign (id) on delete cascade,
  slide_id text not null references hero_slide (id) on delete cascade,
  sort_order integer not null default 0,
  primary key (campaign_id, slide_id)
);

/*
  ย้ายการ์ดเดิม (รอบ 188) → แคมเปญ
  · ตั้งเป็น "เผยแพร่" เพราะเป็นการ์ดที่เคยขึ้นหน้าเว็บอยู่ · ใช้หัวข้อเป็นการชื่อในหลังบ้านด้วย
  idempotent: conditional-update
*/
insert into campaign (
  id, name, title_th, title_en, body_th, body_en, cta_label_th, cta_label_en, cta_href,
  anchor_x, anchor_y, starts_at, ends_at, is_active, status, sort_order, updated_by
)
select
  'c' || substr(md5(card.id), 1, 12), card.title_th, card.title_th, card.title_en, card.body_th, card.body_en,
  card.cta_label_th, card.cta_label_en, card.cta_href, card.anchor_x, card.anchor_y,
  card.starts_at, card.ends_at, card.is_active, 'published', card.sort_order, card.updated_by
from hero_slide_card card
where card.deleted_at is null
  and not exists (select 1 from campaign where campaign.id = 'c' || substr(md5(card.id), 1, 12))
on conflict (id) do nothing;

/* ผูกแคมเปญที่ย้ายมา กับสไลด์เดิมของมัน */
insert into campaign_slide (campaign_id, slide_id, sort_order)
select 'c' || substr(md5(card.id), 1, 12), card.slide_id, card.sort_order
from hero_slide_card card
where card.deleted_at is null
on conflict (campaign_id, slide_id) do nothing;
