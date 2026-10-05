-- ─────────────────────────────────────────────────────────────────────────────
-- waiwai.com — migration 0017: เมนูอาหาร (วิดีโอ) นำเข้าจากเว็บเดิม
--
-- ที่มา: เจ้าของสั่ง 2026-10-05 *"ลุยต่อที่ เมนูอาหารก่อน https://waiwai.co.th/th/articles/category/12586
--        เอาลง db ด้วยนะครับ"*
--
-- ⚠️ **ของจริงคือวิดีโอ ไม่มีสูตรเป็นข้อความ**: ตรวจทั้ง 18 บทความแล้ว (2026-10-05)
--    เนื้อหาในบทความ = `<iframe youtube>` ล้วน (ไม่มีส่วนผสม/วิธีทำเป็นตัวอักษร)
--    ⇒ ตารางนี้เก็บ "เมนูวิดีโอ": ชื่อ · ภาพปก · id ของวิดีโอ · วันที่เผยแพร่
--    (เมนูแบบข้อความที่การตลาดพิมพ์เองยังใช้บล็อก `recipeCards` บนหน้า `/recipes` ต่อไป — มติรอบที่ 101)
--
-- มติเจ้าของ (2026-10-05)
--   · แสดงผลแบบ **คลิกแล้วค่อยโหลด** (facade) — ยังไม่ต่อกับ YouTube จนกว่าผู้ใช้กดปุ่มเล่น
--   · วางเป็น **ส่วนใหม่ต่อท้ายบล็อกเดิม** ของหน้า `/recipes` (ไม่ถอด `recipeCards`)
--
-- ⚠️ รูปเก็บในตาราง `media` (มติ D11) · ที่นี่เก็บแค่ id ของภาพ (มติ D9)
-- ⚠️ ไม่เก็บ URL ของ YouTube เต็ม — เก็บแค่ `video_id` แล้วประกอบ URL ในโค้ด (ย้ายโดเมน/เปลี่ยนผู้ให้บริการได้)
-- ⚠️ idempotent ทุกคำสั่ง
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists recipe (
  /** id = 'r' + source_id (เช่น r134712) — คงที่เพื่อให้นำเข้าซ้ำได้ */
  id             text        primary key,
  source_id      text        not null,
  /** พาธในเว็บเดิม (เก็บไว้ตรวจย้อนหลัง — ไม่ใช่พาธของเว็บเรา) */
  source_url     text        not null default '',
  title_th       text        not null,
  title_en       text        not null default '',
  /** ภาพปกจากเว็บเดิม (อยู่ที่ `media`) */
  cover_media_id text        references media (id) on delete set null,
  /** ผู้ให้บริการวิดีโอ — ตอนนี้มี YouTube อย่างเดียว (เผื่ออนาคต + กันการเดาชนิดจาก URL) */
  video_provider text        not null default 'youtube' check (video_provider in ('youtube')),
  /** id ของวิดีโอ (ไม่ใช่ URL) — ประกอบเป็น URL ในโค้ดเท่านั้น */
  video_id       text        not null,
  /** วันที่เผยแพร่จากเว็บเดิม (แปลงจาก "9 ตุลาคม 2018" เป็น ค.ศ.) — null = อ่านไม่ได้ */
  published_on   date,
  /** ลำดับตามที่ปรากฏบนเว็บเดิม */
  sort_order     integer     not null default 0,
  updated_at     timestamptz not null default now(),
  updated_by     text
);

create index if not exists recipe_order_idx on recipe (sort_order, id);
create index if not exists recipe_source_idx on recipe (source_id);
