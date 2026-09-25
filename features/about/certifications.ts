import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages/th";

/**
 * ใบรับรองมาตรฐานของบริษัท — pure module (ไม่แตะ DOM/DB/Next.js)
 *
 * ภาพเป็นไฟล์จริงที่ผู้ใช้อ่านมาจากเอกสารของบริษัท เก็บใน `public/certifications/`
 * — เป็นภาพชุดแรกของโปรเจกต์ (ก่อนหน้านี้ทุกหน้าใช้ช่องภาพตัวอย่างวาดด้วย CSS)
 *
 * แบ่งข้อมูลเป็นสองส่วนตามหลักของโปรเจกต์
 * - ที่นี่ = ข้อมูลที่ไม่ต้องแปล (ไฟล์ภาพ · ขอบเขตโรงงาน · ช่วงอายุใบรับรอง)
 * - พจนานุกรม = ข้อความที่ผู้ใช้เห็น (ชื่อมาตรฐาน · ผู้ออกใบรับรอง · เลขที่ใบรับรอง) ผูกด้วย id
 *
 * ⚠️ เลขที่และวันที่ในไฟล์นี้คัดจากตัวภาพถ่ายใบรับรอง — ต้องยืนยันกับเอกสารต้นฉบับ
 *    ก่อนขึ้นใช้งานจริง (ดู PRODUCT_ROADMAP.md § 9)
 */

export type CertificationId = keyof Messages["about"]["certifications"]["items"];
export type CertificationSite = keyof Messages["about"]["certifications"]["sites"];

export type CertificateImage = {
  /** path ใต้ public/ */
  readonly src: string;
  readonly width: number;
  readonly height: number;
};

export type Certification = {
  readonly id: CertificationId;
  readonly image: CertificateImage;
  /** ขอบเขตที่ใบรับรองครอบคลุม (ชื่อโรงงานอยู่ในพจนานุกรม) */
  readonly site: CertificationSite;
  /** วันเริ่ม/สิ้นสุดอายุใบรับรอง (ISO) — แสดงผลผ่าน formatDate เพื่อให้ไทยเป็น พ.ศ. อัตโนมัติ */
  readonly validFrom?: string;
  readonly validUntil?: string;
};

/** เรียงตามกลุ่มมาตรฐาน: ISO 9001 → HACCP → GHPs → ฮาลาล */
export const CERTIFICATIONS: readonly Certification[] = [
  {
    id: "iso9001",
    image: { src: "/certifications/iso-9001-2015.jpg", width: 1755, height: 2483 },
    site: "both",
    validFrom: "2024-04-27",
    validUntil: "2027-04-26",
  },
  {
    id: "iso9001Annex",
    image: { src: "/certifications/iso-9001-2015-annex.jpg", width: 1755, height: 2483 },
    site: "both",
  },
  {
    id: "haccpCodexOmYai",
    image: { src: "/certifications/haccp-codex-om-yai.jpg", width: 1500, height: 2122 },
    site: "omYai",
    validFrom: "2024-03-28",
    validUntil: "2027-03-27",
  },
  {
    id: "haccpCodexRaiKhing",
    image: { src: "/certifications/haccp-codex-rai-khing.jpg", width: 1500, height: 2122 },
    site: "raiKhing",
    validFrom: "2024-03-28",
    validUntil: "2027-03-27",
  },
  {
    id: "haccpTasOmYai",
    image: { src: "/certifications/haccp-tas-9024-om-yai.jpg", width: 1500, height: 2122 },
    site: "omYai",
    validFrom: "2024-03-28",
    validUntil: "2027-03-27",
  },
  {
    id: "haccpTasRaiKhing",
    image: { src: "/certifications/haccp-tas-9024-rai-khing.jpg", width: 1500, height: 2122 },
    site: "raiKhing",
    validFrom: "2024-03-28",
    validUntil: "2027-03-27",
  },
  {
    id: "ghpsCodexOmYai",
    image: { src: "/certifications/ghps-codex-om-yai.jpg", width: 1500, height: 2122 },
    site: "omYai",
    validFrom: "2024-03-28",
    validUntil: "2027-03-27",
  },
  {
    id: "ghpsCodexRaiKhing",
    image: { src: "/certifications/ghps-codex-rai-khing.jpg", width: 1500, height: 2122 },
    site: "raiKhing",
    validFrom: "2024-03-28",
    validUntil: "2027-03-27",
  },
  {
    id: "ghpsTasOmYai",
    image: { src: "/certifications/ghps-tas-9023-om-yai.jpg", width: 1500, height: 2122 },
    site: "omYai",
    validFrom: "2024-03-28",
    validUntil: "2027-03-27",
  },
  {
    id: "ghpsTasRaiKhing",
    image: { src: "/certifications/ghps-tas-9023-rai-khing.jpg", width: 1500, height: 2122 },
    site: "raiKhing",
    validFrom: "2024-03-28",
    validUntil: "2027-03-27",
  },
  {
    id: "halal",
    image: { src: "/certifications/halal-cicot.png", width: 500, height: 707 },
    site: "raiKhing",
    validFrom: "2026-08-16",
    validUntil: "2027-08-15",
  },
];

/**
 * ช่วงอายุใบรับรองเป็นข้อความตามภาษา
 * คืนสตริงว่างถ้าไม่มีวันที่ที่ใช้ได้ทั้งสองค่า — ผู้เรียกต้องซ่อนบรรทัดนั้น ไม่ใช่ปล่อยให้หน้าว่าง
 */
export function formatValidityLabel(
  validFrom: string | undefined,
  validUntil: string | undefined,
  locale: Locale,
): string {
  const from = validFrom ? formatDate(validFrom, locale) : "";
  const to = validUntil ? formatDate(validUntil, locale) : "";
  if (from && to) return `${from} – ${to}`;
  return from || to;
}

/** ข้อมูลการ์ดที่แปลแล้ว — ส่งเข้า Client Component ได้ (plain object) โดยไม่ต้องส่งพจนานุกรมทั้งก้อน */
export type CertificationCard = {
  readonly id: CertificationId;
  readonly src: string;
  readonly width: number;
  readonly height: number;
  readonly title: string;
  readonly issuer: string;
  readonly certificateNo: string;
  readonly siteLabel: string;
  readonly validLabel: string;
};

export function buildCertificationCards(
  messages: Messages,
  locale: Locale,
  items: readonly Certification[] = CERTIFICATIONS,
): CertificationCard[] {
  const m = messages.about.certifications;

  return items.map((item) => {
    const copy = m.items[item.id];

    return {
      id: item.id,
      src: item.image.src,
      width: item.image.width,
      height: item.image.height,
      title: copy.title,
      issuer: copy.issuer,
      certificateNo: copy.certificateNo,
      siteLabel: m.sites[item.site],
      validLabel: formatValidityLabel(item.validFrom, item.validUntil, locale),
    };
  });
}
