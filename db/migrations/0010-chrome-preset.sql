-- ─────────────────────────────────────────────────────────────────────────────
-- waiwai.com — migration 0010: พรีเซ็ตของส่วนกลางของเว็บ (W3b)
--
-- เป้าหมาย (คำสั่งผู้ใช้ รอบที่ 58 · งาน W3b ที่ค้างจากรอบที่ 52)
--   > "ชุดพรีเซ็ตเราต้องบันทึกลงฐานข้อมูล ... มีของเก่าเก็บไว้ในฐานข้อมูลและโชว์ก่อน
--   >  มีของใหม่เตรียมฐานข้อมูลรับ มีพรีเซ็ตที่ต้องเตรียมฐานข้อมูลรับ"
--
--   ⇒ ส่วนกลางของเว็บ (แถบเมนู · ท้ายเว็บ · ป้ายประกาศ) ต้อง **บันทึกเป็นชุดสำเร็จ** ได้
--     แล้วดึงชุดนั้นมา "เสียบแทน" ฉบับร่าง โดยที่ **ของเก่า (ฉบับเผยแพร่) ยังอยู่** จนกว่าจะกดเผยแพร่
--
-- ตารางนี้เก็บ "คลังชุดสำเร็จ" ของส่วนกลาง — payload คือ JSONB ทั้งก้อนของส่วนนั้น
--   · `kind = 'navbar'`  → รูปทรงเดียวกับ `chrome-navbar` (parseNavbarConfig)
--   · `kind = 'footer'`  → รูปทรงเดียวกับ `chrome-footer` (parseFooterConfig)
--   · `kind = 'mourning'`→ รูปทรงเดียวกับ `mourning`      (parseMourningConfig)
--   ⚠️ ตรวจรูปทรงด้วย parser ของส่วนนั้น **ทุกครั้งที่อ่าน** (เหมือน page_document)
--
-- ชื่อซ้ำ = เขียนทับของเดิม **ภายในชนิดเดียวกัน** (unique ที่ `kind` + `lower(name)`)
--   ⇒ แถบเมนู "แบบเรียบ" กับท้ายเว็บ "แบบเรียบ" อยู่ด้วยกันได้
-- คอลัมน์ `deleted_at`/`deleted_by` = ใช้ถังขยะกลาง (X2.4) ⇒ ลบแล้วกู้คืนได้
--
-- ⚠️ idempotent ทุกคำสั่ง
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists chrome_preset (
  id         text        primary key,
  /** ส่วนของเว็บ: navbar | footer | mourning (ตรวจซ้ำที่ชั้นแอปด้วย isChromePresetKind) */
  kind       text        not null check (kind in ('navbar', 'footer', 'mourning')),
  name       text        not null,
  /** ชุดค่าของส่วนนั้นทั้งก้อน (ผ่าน parser ของส่วนนั้นก่อนบันทึกเสมอ) */
  payload    jsonb       not null,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  /** ไม่ null = อยู่ในถังขยะ (X2.4) — ดู lib/trash/repository.ts */
  deleted_at timestamptz,
  deleted_by text
);

-- ชื่อซ้ำ (ไม่สนตัวพิมพ์) ภายในชนิดเดียวกัน = เขียนทับของเดิม
create unique index if not exists chrome_preset_kind_name_key on chrome_preset (kind, lower(name));

-- ของที่ใช้งานอยู่ / ของในถัง (ดัชนีแบบมีเงื่อนไขเหมือน media + block_preset)
create index if not exists chrome_preset_alive_idx on chrome_preset (kind, created_at desc) where deleted_at is null;
create index if not exists chrome_preset_trash_idx on chrome_preset (deleted_at) where deleted_at is not null;

comment on table chrome_preset is
  'พรีเซ็ตของส่วนกลาง (W3b) — ชุดสำเร็จของ navbar/footer/ป้ายประกาศ · ลบแล้วเข้าถังขยะกลาง (X2.4)';
