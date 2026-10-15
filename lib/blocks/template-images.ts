/**
 * ตัวช่วยหาพาธภาพจาก **คลังภาพ** สำหรับเทมเพลตที่ใช้ทะเบียน `ABOUT_MEDIA` — รอบที่ 287
 *
 * ## ทำไมต้องแยกออกมาเป็นไฟล์
 * เดิมฟังก์ชันนี้อยู่เป็น private ใน `app/admin/builder/actions.ts` (รอบที่ 253/262)
 * ⇒ พอเพิ่ม **ตัวเผยแพร่หน้าเว็บผ่าน CLI** (`npm run pages:publish`) ที่ต้องสร้างเอกสารจากเทมเพลต
 *    ด้วย **ตรรกะเดียวกันเป๊ะ** จึงต้องมีที่เดียว ไม่ใช่ลอกโค้ด (ไม่งั้นวันหนึ่งสองที่จะไม่ตรงกัน)
 *
 * ## กลไก
 * ไฟล์ใน `public/` (แก้จากหลังบ้านไม่ได้) ถูกนำเข้าคลังภาพด้วย **sha256** เดียวกันทุกฐานข้อมูล
 * (`npm run about:media`) ⇒ หา id ของแต่ละไฟล์ด้วยลายนิ้วมือ แล้วคืนพาธ `/media/<id>`
 * · ยังไม่นำเข้า = ถอยไปใช้พาธเดิมใน `public/` (เทมเพลตยังสร้างได้ หน้าเว็บไม่พัง)
 *
 * ⚠️ อ่าน DB ไม่ได้/ไม่มีฐานข้อมูล = คืนตัวช่วยที่ถอยไปใช้ `public/` เสมอ (ไม่โยน error)
 */
import { ABOUT_MEDIA, aboutImagePath } from "@/lib/blocks/about-media";
import { findMediaIdsBySha256 } from "@/lib/media/repository";

export async function aboutTemplateImageResolver(): Promise<(key: string) => string> {
  const ids = await findMediaIdsBySha256(ABOUT_MEDIA.map((asset) => asset.sha256)).catch(
    () => new Map<string, string>(),
  );
  return (key: string) =>
    aboutImagePath(key, (sha256) => {
      const id = ids.get(sha256);
      return id === undefined ? null : `/media/${id}`;
    });
}

/** หน้าที่เทมเพลตของมันใช้ภาพจากทะเบียน `ABOUT_MEDIA` (ต้องส่ง `image:` เข้าไปตอนสร้าง) */
export const TEMPLATE_IMAGE_PAGES: readonly string[] = ["certifications", "executives"];

export function needsAboutTemplateImages(page: string): boolean {
  return TEMPLATE_IMAGE_PAGES.includes(page);
}
