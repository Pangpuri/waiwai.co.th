-- ─────────────────────────────────────────────────────────────────────────────
-- waiwai.com — migration 0005: SEO ต่อหน้า (W2)
--
-- ผู้ใช้สั่งตามแผน WP-model: "SEO & Metadata Control — ช่องใส่ Meta Title, Description, OG Image"
-- ⇒ เก็บค่าต่อหน้าไว้ในตาราง `page` · ค่าเริ่มต้น = ว่าง (หน้าเว็บใช้ค่าจากพจนานุกรมเหมือนเดิมเป๊ะ)
--
-- ⚠️ idempotent · ⚠️ การ OG image เก็บเป็น "พาธ" ตามมติ D9 (ไม่เก็บ URL เต็ม)
-- ─────────────────────────────────────────────────────────────────────────────

alter table page add column if not exists seo_title_th       text not null default '';
alter table page add column if not exists seo_title_en       text not null default '';
alter table page add column if not exists seo_description_th text not null default '';
alter table page add column if not exists seo_description_en text not null default '';

-- รูปสำหรับแชร์ (Open Graph) — พาธในโปรเจกต์ เช่น /media/<id>
alter table page add column if not exists og_image_path text not null default '';

-- true = ขอให้เครื่องค้นหาไม่เก็บหน้านี้ (ใช้กับหน้าเฉพาะกิจ)
alter table page add column if not exists seo_noindex boolean not null default false;
