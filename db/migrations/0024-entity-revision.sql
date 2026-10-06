-- ─────────────────────────────────────────────────────────────────────────────
-- waiwai.com — migration 0024: ประวัติรุ่นของ "สินค้า / เมนูอาหาร / ข่าว" (B1 รอบที่ 143)
--
-- มติเจ้าของ (2026-10-06): ทำประวัติรุ่นย้อนกลับของ สินค้า · เมนูอาหาร · ข่าว
--   **แบบเดียวกับตัวสร้างหน้าเว็บ** = เก็บทุกครั้งที่บันทึก · ระยะเก็บ 1 ปี · เทียบความต่างก่อนกู้คืน
--   · ย้อนได้เฉพาะผู้มีสิทธิ์ `content`
--
-- ทำไมใช้ตารางเดียว (`entity_revision`) แทน 3 ตาราง:
--   กลไกเหมือนกันทุกประการ (รุ่น + สแนปช็อต JSONB + ใคร/เมื่อไร) ⇒ ตัวอ่าน/ตัวกู้คืน/ตัวลบ
--   ใช้ชุดเดียว ลดโค้ดซ้ำ และมีเทสต์ชุดเดียวคุม (แบบเดียวกับ `page_document_revision`)
--
-- ⚠️ ค่าใน `snapshot` เป็น **สำเนาทั้งก้อนของแถว ณ ตอนนั้น** (รวมส่วนผสม/เนื้อหาข่าว/ภาพ)
--    ⇒ ตอนกู้คืนจะเขียนกลับผ่านตัวเขียนเดิมของแต่ละชนิด (ไม่เขียน SQL ดิบ)
-- ⚠️ การกู้คืนก็ถูกบันทึกเป็นอีกรุ่นหนึ่งเสมอ ⇒ กู้คืนผิดก็ย้อนกลับได้ (ประวัติไม่ขาด)
-- ⚠️ หลังรันในเครื่องต้องรันกับฐานข้อมูลปลายทางด้วย (บทเรียนรอบที่ 105)
-- ⚠️ idempotent ทุกคำสั่ง
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists entity_revision (
  id         bigint      generated always as identity primary key,
  kind       text        not null check (kind in ('product', 'recipe', 'news')),
  entity_id  text        not null,
  revision   integer     not null,
  snapshot   jsonb       not null,
  note       text,
  created_by text,
  created_at timestamptz not null default now(),
  unique (kind, entity_id, revision)
);

create index if not exists entity_revision_lookup_idx on entity_revision (kind, entity_id, revision desc);
