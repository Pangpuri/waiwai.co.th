/*
  รอบที่ 188 — "การ์ดบนสไลด์" + ช่วงเวลาแคมเปญ (โมดูล "สไลด์ & แคมเปญ")

  ที่มา: เจ้าของบอกตั้งแต่ต้นว่า *"มันจะมีการ์ดที่วางบนสไลด์ด้วย ที่ต้องทำพาเนลมาจัดการอัปเดตกิจกรรมหรือแคมเปญ"*
  ⇒ การ์ดผูกกับสไลด์ (1 สไลด์มีได้หลายการ์ด) และ **มีช่วงเวลาเริ่ม–จบ** เพื่อให้แคมเปญขึ้น/ลงเองตามเวลา

  กติกา
  - ช่วงเวลา: `starts_at`/`ends_at` เป็น null ได้ (null = ไม่จำกัดฝั่งนั้น) · หน้าเว็บกรอง **ที่ SQL** ด้วย `now()`
    ⇒ ไม่ต้องมีตัวจับเวลาในแอป และหน้าเว็บไม่มีทางโชว์แคมเปญที่หมดอายุ
  - ถังขยะคู่กัน (`deleted_at` + `deleted_by`) เหมือนตารางอื่น
  - ลบสไลด์ ⇒ การ์ดของสไลด์นั้นหายตาม (`on delete cascade`)
  - ⚠️ ต้องเพิ่ม `hero_slide_card` ใน `PUBLIC_READ_TABLES` (บทเรียนรอบ 184)
  - ⚠️ ต้องรันกับปลายทาง (คลาวด์) ด้วย: `DATABASE_URL=<cloud> npm run db:migrate`
*/

create table if not exists hero_slide_card (
  id text primary key,
  slide_id text not null references hero_slide (id) on delete cascade,
  sort_order integer not null default 0,
  title_th text not null default '',
  title_en text not null default '',
  body_th text not null default '',
  body_en text not null default '',
  cta_label_th text not null default '',
  cta_label_en text not null default '',
  cta_href text not null default '',
  /* ตำแหน่งการ์ดบนภาพ */
  position text not null default 'left' check (position in ('left', 'center', 'right')),
  /* ช่วงเวลาแคมเปญ — null = ไม่จำกัด */
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  deleted_at timestamptz,
  deleted_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text not null default '',
  /* กันพิมพ์ผิดแล้วได้ช่วงเวลาที่จบก่อนเริ่ม */
  constraint hero_slide_card_window_check check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create index if not exists hero_slide_card_slide_idx on hero_slide_card (slide_id, sort_order) where deleted_at is null;
