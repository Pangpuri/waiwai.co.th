/*
  รอบที่ 278 (ปิดหนี้ D-265-3): เพิ่ม "ประกาศรับสมัครงาน" เข้าตารางประวัติรุ่น (`entity_revision`)

  ⚠️ ต้นเหตุที่ต้องมีไฟล์นี้ (เคสจริงจากการพิสูจน์): ตาราง `entity_revision` (migration 0024) มี
     `check (kind in ('product','recipe','news'))` ⇒ พอเพิ่ม kind `job` ฝั่งโค้ด
     insert ถูก Postgres ปฏิเสธและ **ถูกกลืนเป็น `null` เงียบ ๆ** (ตามดีไซน์ "ประวัติคือตาข่ายกันพลาด")
     ⇒ เทสต์/หน้าเว็บดูเหมือนทำงานได้ แต่ประวัติไม่ถูกเก็บเลย

  idempotent: DDL — ปลด constraint เดิม (ถ้ามี) แล้วสร้างใหม่ให้ครอบ `job` (รันซ้ำได้)
*/

alter table entity_revision drop constraint if exists entity_revision_kind_check;

alter table entity_revision
  add constraint entity_revision_kind_check check (kind in ('product', 'recipe', 'news', 'job'));
