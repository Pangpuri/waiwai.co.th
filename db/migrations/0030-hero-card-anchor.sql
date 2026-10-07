/*
  รอบที่ 189 — การ์ดแคมเปญ "ขยับได้อิสระ" บนสไลด์ (โมดูล "สไลด์ & แคมเปญ")

  ที่มา: เจ้าของสั่ง *"เราต้องเพิ่มหน้าที่ตั้งค่าตัวแคมเปญ ที่เป็นหน้าต่างขยับได้บนสไลด์นั่นแหล่ะ"*
  ⇒ เดิมเลือกได้แค่ ซ้าย/กลาง/ขวา · รอบนี้เก็บ **จุดยึดเป็นเปอร์เซ็นต์ของพื้นที่สไลด์** ⇒ ลากวางได้อิสระ

  วิธีตีความค่า (ใช้ทั้งหลังบ้านและหน้าเว็บ — ที่เดียว)
  - `anchor_x`/`anchor_y` = เปอร์เซ็นต์ 0–100 ของพื้นที่สไลด์ (0 = ชิดซ้าย/บน · 50 = กลาง · 100 = ชิดขวา/ล่าง)
  - หน้าเว็บวางการ์ดด้วย `left: X%` + `top: Y%` + `transform: translate(-X%, -Y%)`
    ⇒ ค่า 0/50/100 ให้ผลเหมือน "ชิดขอบ/กลาง" พอดี และค่าอื่นคือตำแหน่งอิสระ
  - ค่าเริ่มต้นมาจาก "ตำแหน่งสำเร็จรูป" เดิม (left/center/right) ⇒ การ์ดที่มีอยู่แล้วไม่เปลี่ยนหน้าตา

  ⚠️ ไม่มีตารางใหม่ ⇒ ไม่ต้องแก้ `PUBLIC_READ_TABLES`
  ⚠️ ต้องรันกับปลายทาง (คลาวด์) ด้วย: `DATABASE_URL=<cloud> npm run db:migrate`
*/

alter table hero_slide_card add column if not exists anchor_x integer not null default 8;
alter table hero_slide_card add column if not exists anchor_y integer not null default 50;

/* บีบค่าให้อยู่ในช่วง 0–100 (แถวเก่าที่ไม่มีค่าใช้ค่าเริ่มต้นจาก default ด้านบน) */
alter table hero_slide_card drop constraint if exists hero_slide_card_anchor_x_check;
alter table hero_slide_card add constraint hero_slide_card_anchor_x_check check (anchor_x between 0 and 100);
alter table hero_slide_card drop constraint if exists hero_slide_card_anchor_y_check;
alter table hero_slide_card add constraint hero_slide_card_anchor_y_check check (anchor_y between 0 and 100);

/*
  ย้ายค่าจาก "ตำแหน่งสำเร็จรูป" เดิม → จุดยึด (ทำครั้งเดียวต่อแถว)
  · left = 8% (เว้นระยะขอบเท่ากับที่หน้าจอเดิมใช้) · center = 50% · right = 92%
  idempotent: conditional-update
*/
update hero_slide_card set anchor_x = case position when 'center' then 50 when 'right' then 92 else 8 end
 where anchor_x = 8 and anchor_y = 50;
