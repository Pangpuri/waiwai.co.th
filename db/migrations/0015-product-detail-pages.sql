-- ─────────────────────────────────────────────────────────────────────────────
-- waiwai.com — migration 0015: "หน้า" ของรายละเอียดหมวดสินค้า 6 หน้า (S3 ส่วนที่ 2 · รอบที่ 102)
--
-- ที่มา: รอบที่ 101 เจ้าของเลือกทำ "หน้ารายละเอียดหมวด" ให้แก้ด้วยบล็อกจากหลังบ้านได้
--        โดย **ล็อก 6 หมวดเดิม** (ไม่ให้เพิ่มหมวดใหม่ = ยังไม่มีหน้า dynamic)
--
-- ทำไมเพิ่มเป็นแถวในตาราง `page` (มติ 2026-10-05)
--   - ใช้กลไกเดิมทั้งหมด: แท็บหลังบ้าน · พรีวิว `/th/preview/<id>` · ลิงก์พรีวิวชั่วคราว · ตั้งเวลาเผยแพร่ · ประวัติรุ่น
--   - `in_menu = false` ⇒ **ไม่โผล่ในเมนูหลักและไม่ขึ้น `sitemap.xml`** (buildSitemapEntries ข้ามหน้าที่ซ่อนจากเมนู)
--     · หลังบ้านแสดงเครื่องหมาย ⌀ กำกับว่าหน้านี้ซ่อนจากเมนู
--   - `editor = 'blocks'` ⇒ ใช้ตัวสร้างหน้าเว็บ (มีเทมเพลตตั้งต้นต่อหมวดในโค้ด)
--
-- ⚠️ id = `product-<slug>` (มีขีดกลาง ไม่มี `/`) เพราะเส้นทางหลังบ้าน `/admin/builder/[page]`
--    รับได้ทีละส่วน · พาธจริงของหน้าเว็บอยู่ที่ `lib/pages/paths.ts` (`/products/<slug>`)
-- ⚠️ ไม่แตะ slug/เส้นทางเดิมของเว็บ (มติ Q-D: ล็อก 6 หมวด) ⇒ ไม่มี 301 ต้องทำในรอบนี้
-- ⚠️ idempotent: `on conflict (id) do nothing` ⇒ รันซ้ำได้ ไม่ทับชื่อที่เจ้าของแก้ไว้
-- ─────────────────────────────────────────────────────────────────────────────

insert into page (id, name_th, name_en, menu_order, in_menu, editor) values
  ('product-instant-noodles',  'บะหมี่กึ่งสำเร็จรูป',        'Instant noodles',                  51, false, 'blocks'),
  ('product-dried-vermicelli', 'เส้นหมี่อบแห้ง',             'Dried rice vermicelli',            52, false, 'blocks'),
  ('product-serda',            'ซือดะ (SERDA)',              'Serda',                            53, false, 'blocks'),
  ('product-quick-zabb',       'ควิก แสบ',                    'Quick Zabb',                       54, false, 'blocks'),
  ('product-noodie',           'นูดดี้ (Noodie)',             'Noodie',                           55, false, 'blocks'),
  ('product-rod-ded',          'ไวไว รสเด็ด (ผงปรุงสำเร็จ)',  'Wai Wai Rod Ded (seasoning powder)', 56, false, 'blocks')
on conflict (id) do nothing;
