-- ─────────────────────────────────────────────────────────────────────────────
-- waiwai.com — migration 0002: พรีเซ็ตบล็อก (คลังแบบสำเร็จ)
-- ผู้ใช้สั่ง รอบที่ 52 · idempotent
-- ─────────────────────────────────────────────────────────────────────────────

-- ── พรีเซ็ตบล็อก (คลังแบบสำเร็จ) ──────────────────────────────────────────────
-- ผู้ใช้สั่ง รอบที่ 52: "บันทึกบล็อก/แบนเนอร์ที่ทำไว้เป็นพรีเซ็ต แล้วดึงมาวาง/ทับของเดิม"
-- เก็บ "บล็อก" ทั้งก้อนเป็น JSONB (รวมภาพ/สไตล์) ⇒ ใช้ซ้ำได้ทุกหน้า
-- หมายเหตุ: ภาพที่พรีเซ็ตอ้างถึงอยู่ในตาราง `media` ⇒ อย่าลบภาพที่พรีเซ็ตยังใช้อยู่
create table if not exists block_preset (
  id         text        primary key,
  name       text        not null,
  block_type text        not null,
  block      jsonb       not null,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists block_preset_name_idx on block_preset (lower(name));
create index if not exists block_preset_created_idx on block_preset (created_at desc);
