-- waiwai.com — migration 0050: สไลด์ hero เหลือ 2 ภาษา
--
-- ที่มา (เจ้าของ 2026-11-11): ตัวเลือก "ทั้งสองภาษา" ในหน้าตั้งค่าสไลด์ทำให้เข้าใจผิด
-- เพราะพฤติกรรมจริงคือ "ใช้เมื่อภาษานั้นไม่มีสไลด์เฉพาะ" ไม่ได้ขึ้นทั้งสองภาษา
-- ⇒ เจ้าของเลือก **เหลือ 2 ตัวเลือก: เฉพาะภาษาไทย / เฉพาะภาษาอังกฤษ**
--
-- สิ่งที่ทำ:
--   1. ย้ายสไลด์เดิมที่ locale = 'all' ไปเป็น 'th' (สไลด์ชุดเดิมเป็นของหน้าไทย)
--   2. เปลี่ยนค่าเริ่มต้นของคอลัมน์เป็น 'th' (แถวใหม่ที่ไม่ได้ระบุภาษา)
--   3. เปลี่ยน check constraint ให้รับเฉพาะ 'th' / 'en'
--
-- ⚠️ ไม่แตะภาพ/ลำดับ/คำอธิบาย · หน้า EN ยังใช้ภาพเดี่ยว `hero-en` ตามเดิม

update hero_slide set locale = 'th' where locale = 'all';

alter table hero_slide alter column locale set default 'th';

alter table hero_slide drop constraint if exists hero_slide_locale_check;

alter table hero_slide
  add constraint hero_slide_locale_check check (locale in ('th', 'en'));
