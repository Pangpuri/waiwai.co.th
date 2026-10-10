import { en } from "@/lib/i18n/messages/en";
import { th } from "@/lib/i18n/messages/th";
import { aboutImagePath, certificateMediaKey } from "@/lib/blocks/about-media";
import { TEMPLATE_BLOCK_VERSION, templateBlockId, templateMedia, templateStyle } from "@/lib/blocks/template-kit";
import type { Block, BlockDocument } from "@/lib/blocks/types";

import { CERTIFICATIONS } from "@/features/about/certifications";

/**
 * เทมเพลตตั้งต้นของหน้า **"ใบรับรองมาตรฐาน" (/about/certifications)**
 * · S2 รอบที่ 83 (โครงเดิม) · **เขียนใหม่รอบที่ 262 ตามมติเจ้าของ 2026-10-10**
 *
 * ## มติเจ้าของ 2026-10-10 (คำพูดตรง ๆ)
 * *"เก็บภาพที่เป็นภาพใบรับรองทั้งหมดที่โชว์หน้าบ้านลง db แล้วเอาขึ้นมาโชว์แบบหน้าบ้าน
 *   ตัด…คำอธิบาย…ออกไป · ขยายดูใบรับรอง → ออกไป เหลือเพียงแค่รูปของใบรับรองเปล่า ๆ
 *   ส่วนบล็อคบน ที่เขียนว่า 'บริษัทได้รับการรับรอง…' เอาออกไปด้วยครับ เอาแต่ภาพเพียว ๆ
 *   กดขยายดูได้พอแล้ว คำอธิบายภาพก็ไม่ต้องนะ เค้าโครงก็แบบเดียวกับหน้าบ้านครับ"*
 *
 * ⇒ เทมเพลตนี้ = **บล็อกแกลเลอรีเดียว** ที่มีแต่ภาพ
 *   · **ไม่มีหัวข้อ (hero/heading)** — ข้อความเปิดเรื่อง + eyebrow + note ที่เคยมี ถูกถอดออกทั้งหมด
 *   · **ไม่มีคำบรรยายใต้ภาพ** (`caption` ว่างทุกใบ) — เหลือแค่ตัวภาพ
 *   · ป้าย "ขยายดูใบรับรอง" ไม่มีในเส้นทางนี้ (ตัว lightbox ใช้ `aria-label` เท่านั้น = ไม่มีข้อความบนจอ)
 *   · **กดภาพเพื่อขยายดูได้** (lightbox เดิมของบล็อกแกลเลอรี — ปิดได้ 3 ทาง + คืนโฟกัส)
 *   · โครง 3 คอลัมน์ + กรอบ **A4 (1:1.414) + `object-contain`** = เลียนแบบการ์ดหน้าบ้าน และ
 *     **ไม่ตัดขอบเอกสาร** (ภาพใบรับรองทุกใบเป็น A4 ตั้ง ⇒ เต็มกรอบพอดี)
 *
 * ## ที่มาของภาพ
 * ทะเบียน `ABOUT_MEDIA` (คีย์ `cert:<id>`) → **นำเข้าคลังภาพแล้ว** (`npm run about:media`)
 * ⇒ บล็อกเก็บพาธ `/media/<id>` (มติ D9: ห้ามเก็บ URL เต็ม) · ยังไม่นำเข้า = ถอยไปใช้ไฟล์ใน `public/`
 * (หน้าเว็บไม่พัง) — ผู้เรียกส่งตัวช่วย `image` เข้ามาเหมือนเทมเพลตหน้า /about และ /about/executives
 *
 * ## ⚠️ alt ไม่ใช่คำบรรยาย
 * `alt` ยังต้องมี (มติ D7 + a11y) แต่ **ผู้ใช้มองไม่เห็น** ⇒ ใส่ชื่อมาตรฐาน + ขอบเขตโรงงานไว้ให้
 * โปรแกรมอ่านหน้าจอ ทั้งที่หน้าจอแสดงแค่ภาพ (ไม่ขัดคำสั่ง "คำอธิบายภาพก็ไม่ต้อง")
 */

export type CertificationsTemplateOptions = {
  /** หาพาธภาพจากคลังภาพ (`aboutImagePath(key, lookup)`) — ไม่ส่ง = ใช้ไฟล์ใน `public/` */
  readonly image?: (key: string) => string;
};

export function buildCertificationsTemplate(options: CertificationsTemplateOptions = {}): BlockDocument {
  const m = th.about.certifications;
  const mEn = en.about.certifications;
  const imageOf = options.image ?? ((key: string) => aboutImagePath(key));

  const blocks: Block[] = [
    {
      id: templateBlockId(0),
      version: TEMPLATE_BLOCK_VERSION,
      type: "gallery",
      /* กว้าง + พื้นอ่อน — ให้ใกล้เคียงคอนเทนเนอร์ของหน้าบ้านที่สุด */
      style: templateStyle({ width: "wide", background: "subtle" }),
      heading: { th: "", en: "" },
      columns: 3,
      imageShape: "portrait",
      items: CERTIFICATIONS.map((certificate) => {
        const item = m.items[certificate.id];
        const itemEn = mEn.items[certificate.id];
        /* ชื่อมาตรฐานอย่างเดียวไม่พอแยกใบ (มาตรฐานเดียวมี 2 โรงงาน) ⇒ ต่อท้ายด้วยขอบเขต */
        const siteTh = m.sites[certificate.site];
        const siteEn = mEn.sites[certificate.site];
        return {
          id: `cert-${certificate.id}`,
          image: templateMedia(
            /* ⚠️ `certificateMediaKey()` รับ **พาธภาพ** (ไม่ใช่ id) — ส่ง id แล้วได้คีย์ว่าง ⇒ ภาพหายทั้งหน้า */
            imageOf(certificateMediaKey(certificate.image.src)),
            `${item.title} · ${siteTh}`,
            `${itemEn.title} · ${siteEn}`,
          ),
          caption: { th: "", en: "" },
        };
      }),
    },
  ];

  return { page: "certifications", blocks };
}
