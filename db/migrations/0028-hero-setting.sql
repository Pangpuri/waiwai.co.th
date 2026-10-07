/*
  รอบที่ 185 — ตั้งค่า "เอฟเฟค + ความเร็ว" ของสไลด์หน้าแรก (โมดูล "สไลด์ & แคมเปญ")

  ที่มา: เจ้าของสั่ง *"แล้วสไลด์ มีเอฟเฟคให้เขาเลือกสักหน่อยนะครับ"* และยืนยันว่าให้เริ่มจากข้อนี้
  · ค่าเป็นของ **ระดับ hero ทั้งชุด** (ไม่ใช่รายใบ) ⇒ เก็บเป็นแถวเดียว (id = 'default')
  · เอฟเฟค/ความเร็วถูกใช้ที่ CSS + ตัวเลื่อนภาพฝั่งหน้าเว็บ (ไม่มี JS เพิ่ม)
  · ⚠️ หน้าเว็บอ่านผ่านประตูอ่านอย่างเดียว ⇒ ต้องเพิ่ม `hero_setting` ใน `PUBLIC_READ_TABLES` (บทเรียนรอบ 184)
  · ⚠️ ต้องรันกับปลายทาง (คลาวด์) ด้วย: `DATABASE_URL=<cloud> npm run db:migrate`
*/

create table if not exists hero_setting (
  id text primary key,
  /* เอฟเฟคเปลี่ยนภาพ: fade = จาง · slide = เลื่อน · zoom = ซูมเข้าช้า ๆ · none = ตัดภาพทันที */
  effect text not null default 'fade' check (effect in ('fade', 'slide', 'zoom', 'none')),
  /* เวลาต่อภาพ (มิลลิวินาที) — 2–15 วินาที กันค่าที่อ่านไม่ทัน/รอนานเกิน */
  interval_ms integer not null default 5000 check (interval_ms between 2000 and 15000),
  updated_at timestamptz not null default now(),
  updated_by text not null default ''
);

/* แถวเดียวของระบบ — ใส่ค่าเริ่มต้นให้เลย (รันซ้ำไม่มีผล) */
insert into hero_setting (id) values ('default') on conflict (id) do nothing;
