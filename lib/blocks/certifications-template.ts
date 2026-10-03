import { en } from "@/lib/i18n/messages/en";
import { th } from "@/lib/i18n/messages/th";
import { TEMPLATE_BLOCK_VERSION, templateBlockId, templateMedia, templateStyle } from "@/lib/blocks/template-kit";
import type { Block, BlockDocument } from "@/lib/blocks/types";

import { CERTIFICATIONS } from "@/features/about/certifications";

/**
 * เทมเพลตตั้งต้นของหน้า "ใบรับรองมาตรฐาน" (/about/certifications) — S2 รอบที่ 83
 *
 * ที่มา: ใบรับรองจริง (`CERTIFICATIONS` — ไฟล์ภาพใน public/certifications) + ชื่อ/ผู้ออกใบรับรองจากพจนานุกรม
 * รอบที่ 87: ใช้บล็อก `gallery` ⇒ ได้ **ตัวขยายดูภาพเต็มจอ (lightbox)** เหมือนเลย์เอาต์เดิม ⇒ ปิดช่อง gallery/lightbox ของหน้านี้
 */
export function buildCertificationsTemplate(): BlockDocument {
  const blocks: Block[] = [
    {
      id: templateBlockId(0),
      version: TEMPLATE_BLOCK_VERSION,
      type: "hero",
      style: templateStyle({ size: "lg", align: "left" }),
      title: { th: th.about.certifications.title, en: en.about.certifications.title },
      subtitle: { th: th.about.certifications.intro, en: en.about.certifications.intro },
      note: { th: th.about.certifications.note, en: en.about.certifications.note },
      image: null,
      ctaLabel: { th: "", en: "" },
      ctaHref: "",
    },
    {
      id: templateBlockId(1),
      version: TEMPLATE_BLOCK_VERSION,
      type: "gallery",
      style: templateStyle({ background: "cream" }),
      heading: { th: th.about.certifications.eyebrow, en: en.about.certifications.eyebrow },
      columns: 3,
      items: CERTIFICATIONS.map((certificate) => {
        const item = th.about.certifications.items[certificate.id];
        const itemEn = en.about.certifications.items[certificate.id];
        return {
          id: `cert-${certificate.id}`,
          image: templateMedia(certificate.image.src, item.title, itemEn.title),
          caption: { th: `${item.title} · ${item.issuer}`, en: `${itemEn.title} · ${itemEn.issuer}` },
        };
      }),
    },
  ];

  return { page: "certifications", blocks };
}
