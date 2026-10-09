/**
 * รูปของ **หน้าบริษัท (/about)** ที่นำเข้าคลังภาพ (รอบที่ 253) — **ตรรกะล้วน**
 *
 * ## ทำไมต้องมีไฟล์นี้
 * มติเจ้าของ 2026-10-09: *"ย้ายข้อมูลบริษัทเข้าไปเก็บในฐานข้อมูล … รวมถึงจุดที่อัปโหลดภาพเข้าไปได้ด้วย"*
 * รูปเดิมเป็นไฟล์ใน `public/` (แก้/เปลี่ยนจากหลังบ้านไม่ได้) ⇒ รอบนี้ **นำเข้าคลังภาพ (ตาราง `media`)** แล้ว
 * บล็อกของหน้าบริษัทอ้างอิง `/media/<id>` (มติ D9: เก็บพาธ ไม่เก็บ URL)
 *
 * ## วิธีทำให้ "รู้จัก" รูปเดิมอีกครั้งหลังนำเข้า
 * คลังภาพ dedupe ด้วย **sha256** ⇒ ถ้าเราจำ hash ของไฟล์เดิมไว้ ระบบหา id ที่ตรงกันได้เสมอ
 * (ทั้งตอนสร้างบล็อกจากเทมเพลต และตอนตรวจว่ายังมีรูปครบ)
 *
 * ⚠️ `sha256` ที่เขียนไว้เป็น **ค่าที่ตรวจสอบได้** — `scripts/test-about-media.ts` คำนวณจากไฟล์จริง
 *    แล้วเทียบ ⇒ ถ้ามีคนแก้ไฟล์ภาพใน `public/` ด่านจะฟ้องทันที (ต้องนำเข้าใหม่)
 *
 * ⚠️ ถ้ายังไม่นำเข้า (ไม่มีแถวในคลัง) ตัวช่วยจะถอยไปใช้พาธใน `public/` ⇒ หน้าเว็บยังแสดงรูปได้เหมือนเดิม
 */

export type AboutMediaAsset = {
  /** คีย์ที่โค้ดอ้างถึง (ไม่ผูกกับ id ของคลังภาพ) */
  readonly key: string;
  /** พาธเดิมใน `public/` (ใช้เป็น fallback + ใช้ตรวจไฟล์จริง) */
  readonly publicPath: string;
  /** ลายนิ้วมือของไฟล์ (คลังภาพ dedupe ด้วยค่านี้) */
  readonly sha256: string;
};

export const ABOUT_MEDIA: readonly AboutMediaAsset[] = [
  { key: "cert:ghps-codex-om-yai", publicPath: "/certifications/ghps-codex-om-yai.jpg", sha256: "627c5fa7ef61c8eda85e833d64f7f4ac7cd65f85b0d4eda41147754b6f69b07a" },
  { key: "cert:ghps-codex-rai-khing", publicPath: "/certifications/ghps-codex-rai-khing.jpg", sha256: "14a8ff417823ad52638ca7cb50a5a34ef7950c39629066fb7bf7f0f6041818c7" },
  { key: "cert:ghps-tas-9023-om-yai", publicPath: "/certifications/ghps-tas-9023-om-yai.jpg", sha256: "2308eb1e49ba645c32d4bc4abba66a449dffa92440549fb79488c732057faeae" },
  { key: "cert:ghps-tas-9023-rai-khing", publicPath: "/certifications/ghps-tas-9023-rai-khing.jpg", sha256: "03e2b93613bb185266a22def93abb111d07d2838caa579cd26d34312933265fa" },
  { key: "cert:haccp-codex-om-yai", publicPath: "/certifications/haccp-codex-om-yai.jpg", sha256: "da9342b1b6aa378220ffafd9393a88720120a323214f23a61eef7c334dd53b8e" },
  { key: "cert:haccp-codex-rai-khing", publicPath: "/certifications/haccp-codex-rai-khing.jpg", sha256: "b669bfcdcc48aa21223053bc0e6301e9caedf30777da60331856359525b0a829" },
  { key: "cert:haccp-tas-9024-om-yai", publicPath: "/certifications/haccp-tas-9024-om-yai.jpg", sha256: "ca75a1c40f4706619a1bf5195741aec5a45f56224424e0aeab5fbca1acb65950" },
  { key: "cert:haccp-tas-9024-rai-khing", publicPath: "/certifications/haccp-tas-9024-rai-khing.jpg", sha256: "40102a096556ec7d256f8be8e8b78e887458137fcf59d011e57b7a76d9f19871" },
  { key: "cert:halal-cicot", publicPath: "/certifications/halal-cicot.png", sha256: "1ba54f27b403724894039f68455c98e5d5ebb28263b2a6ff1fd9d5e47ae43f71" },
  { key: "cert:iso-9001-2015-annex", publicPath: "/certifications/iso-9001-2015-annex.jpg", sha256: "e9336d3b77562d76f0768e11b5518e0a5f579bc7ab8c155ed15409b0cc8a42c8" },
  { key: "cert:iso-9001-2015", publicPath: "/certifications/iso-9001-2015.jpg", sha256: "08fb5d9f4e48acc5cb03eb937a193a70cf17af2c83be1db88af7804672f6dc8f" },
  { key: "executives", publicPath: "/executives/management-team.jpg", sha256: "14657fb841f0d09c93d6eb89a48cffc5d55d0b8c2bcef51486c19eab1334296b" },
  { key: "map", publicPath: "/contact/om-yai-map.jpg", sha256: "aa81dd2b2c5ebb2a7a7a72db1fb62b1bf6c944a82851baf451d2730ac43ee4e1" },
];

/** ตัวช่วยหา "พาธที่ควรใช้" จากคลังภาพ (คืน null = ยังไม่ได้นำเข้า) */
export type AboutMediaLookup = (sha256: string) => string | null;

export function aboutMediaByKey(key: string): AboutMediaAsset | null {
  return ABOUT_MEDIA.find((asset) => asset.key === key) ?? null;
}

/**
 * พาธของภาพ: **คลังภาพก่อน** (ถ้านำเข้าแล้ว) แล้วถอยไปใช้ไฟล์เดิมใน `public/`
 * ⇒ ทำงานได้ทั้งก่อนและหลังนำเข้า (หน้าเว็บไม่พังเพราะยังไม่ได้นำเข้า)
 */
export function aboutImagePath(key: string, lookup?: AboutMediaLookup): string {
  const asset = aboutMediaByKey(key);
  if (asset === null) return "";
  const fromLibrary = lookup?.(asset.sha256) ?? null;
  return fromLibrary ?? asset.publicPath;
}

/** คีย์ของภาพใบรับรอง (ใช้คู่กับ id ของใบรับรองใน `features/about/certifications.ts`) */
export function certificateMediaKey(imagePath: string): string {
  const asset = ABOUT_MEDIA.find((item) => item.publicPath === imagePath);
  return asset?.key ?? "";
}
