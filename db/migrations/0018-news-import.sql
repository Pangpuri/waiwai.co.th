-- ─────────────────────────────────────────────────────────────────────────────
-- waiwai.com — migration 0018: ข่าวสาร & กิจกรรม นำเข้าจากเว็บเดิม
--
-- ที่มา: เจ้าของสั่ง 2026-10-05 (ทำหน้าบ้านก่อน แล้วค่อยต่อหลังบ้าน)
--        *"มาลุยหน้ากิจกรรมกันเลย https://waiwai.co.th/th/news/ … แค่กิจกรรมก็เยอะแล้ว ตั้ง 11 หน้า"*
--
-- มติเจ้าของ (2026-10-05)
--   1. **หน้ารายละเอียดต่อข่าว** (`/news/<id>`) — มี URL ของตัวเอง (แชร์/SEO ได้) · ไม่ต้องเพิ่ม JS
--   2. **รูปในเนื้อหา = รุ่นย่อ 1024×768** จาก CDN ของเว็บเดิม (~243 KB/ใบ · รวม ~125 MB)
--      ⚠️ รุ่นย่อของ CDN เป็น **4:3 (ครอบภาพ)** ไม่ใช่ย่อสัดส่วน — ต้นฉบับ 6000×4000 = 4–5 MB/ใบ
--   3. **นำเข้าทั้ง 151 ข่าว** (2018–2026) · แบ่งหน้า static 15 ข่าว/หน้า
--
-- ⚠️ เนื้อหาจากเว็บเดิม **ถูกวางมาจาก Facebook** — HTML เละ (ตาราง/span/style) และรูปไม่มี alt
--    ⇒ เก็บเป็น **บล็อกที่มีโครง** (`body` JSONB: ย่อหน้า/หัวข้อ/รูป) ไม่เก็บ HTML ดิบ
--      (กัน XSS และกันคุณภาพพัง) · ตัวแกะ+ตัวตรวจอยู่ที่ `lib/news/{import-parse,body}.ts`
-- ⚠️ เก็บ **id ของภาพ** (→ `media` · มติ D9/D11) ไม่เก็บ URL ของ CDN ภายนอก
-- ⚠️ id = 'n' + source_id และพาธหน้าเว็บ = `/news/<source_id>` (ตัวเลขล้วน) — คงที่และปลอดภัยใน URL
--    (URL เดิมของเว็บเดิมคือ `/th/news/<id>-<slug ไทย>` ⇒ ภายหลังทำ 301 ให้ตรงรุ่นได้ เพราะขึ้นต้นด้วย id เดียวกัน)
-- ⚠️ idempotent ทุกคำสั่ง
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists news (
  /** id = 'n' + source_id (เช่น n148398) */
  id              text        primary key,
  source_id       text        not null,
  /** พาธในเว็บเดิม (เก็บไว้ตรวจย้อนหลัง/ทำ 301) */
  source_url      text        not null default '',
  title_th        text        not null,
  /** เว็บเดิมไม่มีเนื้อหาอังกฤษเลย ⇒ ว่าง = ถอยไปใช้ไทย */
  title_en        text        not null default '',
  excerpt_th      text        not null default '',
  excerpt_en      text        not null default '',
  /** ภาพปก (ภาพย่อ 400×300 จากหน้าข่าวของเว็บเดิม) */
  cover_media_id  text        references media (id) on delete set null,
  /**
   * เนื้อหาเป็น **บล็อกเรียงลำดับ** (ไม่เก็บ HTML ดิบ):
   *   { "type": "paragraph", "text": "…" } | { "type": "heading", "text": "…" }
   *   { "type": "image", "mediaId": "…", "alt": "…" }
   * ตัวอ่านต้องผ่าน `parseNewsBody()` เสมอ (ห้ามเชื่อข้อมูลจาก DB/ไฟล์นำเข้าโดยตรง)
   */
  body            jsonb       not null default '[]'::jsonb,
  /** วันที่เผยแพร่ (แปลงจาก "12 กันยายน 2026 11:28" เวลาไทย → timestamptz) · null = อ่านไม่ได้ */
  published_at    timestamptz,
  /** ข้อความวันที่ดิบจากต้นฉบับ (เก็บไว้ให้ตรวจที่มา) */
  published_label text        not null default '',
  updated_at      timestamptz not null default now(),
  updated_by      text
);

/* เรียงข่าวใหม่สุดก่อน (หน้าที่แสดงใช้ลำดับนี้) */
create index if not exists news_published_idx on news (published_at desc nulls last, id desc);
create index if not exists news_source_idx on news (source_id);
