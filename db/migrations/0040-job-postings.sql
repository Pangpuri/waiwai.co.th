-- 0040-job-postings — "ประกาศรับสมัครงาน" ของหน้า /careers ย้ายเข้าฐานข้อมูล
--
-- ที่มา: เจ้าของสั่ง 2026-10-14 (รอบที่ 265 · มติ D26) *"ส่วนแก้ไขเนื้อหาร่วมงานกับไวไว หลังบ้าน
-- นำที่มีอยู่ตอนนี้หน้าบ้านเข้า db จากนั้นสามารถเพิ่ม ลบ ประกาศได้เพราะเป็นประกาศรับสมัครงาน"*
--   · เดิมข้อมูล 20 ตำแหน่งอยู่ที่ `features/careers/jobs.ts` (id/ฝ่าย/อัตรา) + พจนานุกรม `careersPage.jobs`
--     (ชื่อ/เพศ/อายุ/คุณสมบัติ/ประสบการณ์) ⇒ ฝ่ายบุคคลแก้เองไม่ได้ ต้องแก้โค้ด + รันเทสต์
--   · หลังรอบนี้ **ตารางนี้คือแหล่งความจริงเดียว** ของ "ตำแหน่งที่เปิดรับ"
--     (เลย์เอาต์หน้า /careers + บล็อก jobBoard ที่ตั้ง source = 'database' อ่านจากที่นี่)
--
-- มติ D26 (เจ้าของเลือกทุกข้อ):
--   1. ขอบเขต = เฉพาะ "ตำแหน่งที่เปิดรับ" (ส่วนหัว/ติดต่อ/ฟอร์ม ยังแก้ผ่านตัวสร้างหน้าเว็บเหมือนเดิม)
--   2. ลบ = เข้าถังขยะ 30 วัน (`deleted_at`) → กู้คืนได้ → ลบถาวรมีประตูอยู่ที่ SQL (`deleted_at is not null`)
--   3. 20 ตำแหน่งเดิม **นำเข้าครั้งเดียว** ไม่มีตารางค่าเริ่มต้น/ไม่มีปุ่มคืนค่า
--   4. `gender`/`age` คงไว้ตามประกาศต้นฉบับ แต่ **ไม่บังคับ** สำหรับประกาศใหม่ ('' = ไม่ระบุ)
--   5. ประกาศใหม่ = ฉบับร่าง (`status = 'draft'`) จนกดเผยแพร่
--
-- หมายเหตุคอลัมน์
--   · `gender` เก็บ **คีย์** ('male' | 'female' | 'any' | '') ไม่เก็บข้อความ — ข้อความมาจากพจนานุกรม
--     `careersPage.genders` (กันข้อความซ้ำ 2 ที่) · ค่าที่ไม่รู้จักถูกปฏิเสธที่ validator ก่อนถึง SQL
--   · `department_th`/`department_en` เป็น **ข้อความอิสระ** (ฝ่ายใหม่เพิ่มได้จากหลังบ้าน)
--   · `status` มี check constraint ให้ตรงกับ news/recipe (draft | published)
--   · `deleted_at`/`deleted_by` เป็นคู่กันเสมอ (กู้คืนแล้วล้างทั้งคู่ — แบบเดียวกับสินค้า/เมนู/ข่าว)

create table if not exists job_posting (
  id                 text        primary key,
  title_th           text        not null,
  title_en           text        not null default '',
  department_th      text        not null default '',
  department_en      text        not null default '',
  /* จำนวนอัตราที่เปิดรับ — 0 = ไม่ระบุจำนวน */
  openings           integer     not null default 0,
  /* คีย์เพศจากพจนานุกรม: male | female | any | '' (ไม่ระบุ) */
  gender             text        not null default '',
  age_th             text        not null default '',
  age_en             text        not null default '',
  qualifications_th  text        not null default '',
  qualifications_en  text        not null default '',
  experience_th      text        not null default '',
  experience_en      text        not null default '',
  sort_order         integer     not null default 0,
  status             text        not null default 'draft' check (status in ('draft', 'published')),
  deleted_at         timestamptz,
  deleted_by         text,
  created_at         timestamptz not null default now(),
  created_by         text        not null default '',
  updated_at         timestamptz not null default now(),
  updated_by         text        not null default ''
);

/* คำสั่งอ่านฝั่งเว็บ: published + ไม่อยู่ในถัง เรียงตามลำดับ */
create index if not exists job_posting_public_idx on job_posting (sort_order, id) where deleted_at is null;

/* หน้าจอหลังบ้าน: กรองตามแท็บ (รวมถังขยะ) */
create index if not exists job_posting_admin_idx on job_posting (deleted_at, status, sort_order, id);
