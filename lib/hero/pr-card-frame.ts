import type { PageContent } from "@/lib/content/types";

/**
 * "กรอบภาพ" ของการ์ด PR (การ์ดที่ขยับมุมขวาล่างของหน้าแรก) — รอบที่ 208
 *
 * คำเจ้าของ: *"เป็นไปได้ไหมที่หน้าต่างของแคมเปญจะยืดหดตามสเกลภาพที่ใส่ไป แต่ไม่ใช่ขนาดภาพนะ แค่สเกล"*
 *   → ถามต่อว่าเอาที่ไหน/คุมเพดานไหม ⇒ *"แบบเลือกเพดานสัดส่วนได้ดีกว่าครับ"*
 *
 * กติกา
 * - **กรอบ (frame) = สัดส่วนหน้าต่าง** ไม่เกี่ยวกับขนาดไฟล์/การบีบอัด (ยังย่อภาพตามกติการอบ 99)
 * - `auto` = ให้ **ภาพเป็นตัวกำหนดความสูงเอง** (หน้าต่างยืดหดตามสเกลภาพ) — คุมด้วยเพดานความสูงใน CSS
 * - ค่าอื่น = กรอบคงที่ตามที่เลือก และย่อภาพให้ **เห็นเต็มใบ** (`object-contain`) ไม่ตัดขอบ
 * - เก็บค่าที่ตาราง `hero_setting` (แถวเดียวของฮีโร่) — ไม่ต้องแตะโครงเนื้อหา EAV (เลี่ยงด่าน TH ห้ามว่าง)
 *
 * ตรรกะล้วน (ไม่แตะ DB/React) ⇒ ทดสอบได้ด้วย `node --test`
 */
export const PR_CARD_FRAMES = ["auto", "1:1", "4:5", "3:4", "16:9"] as const;
export type PrCardFrame = (typeof PR_CARD_FRAMES)[number];

export const DEFAULT_PR_CARD_FRAME: PrCardFrame = "auto";

/** อัตราส่วน (กว้าง ÷ สูง) ของกรอบที่เลือก · `null` = ปล่อยให้ภาพกำหนดเอง (`auto`) */
const RATIOS: Readonly<Record<Exclude<PrCardFrame, "auto">, number>> = {
  "1:1": 1,
  "4:5": 4 / 5,
  "3:4": 3 / 4,
  "16:9": 16 / 9,
};

/**
 * เพดานเมื่อเลือก `auto` — กันการ์ดทับเนื้อหาหน้าแรก (ภาพสูงมาก) หรือเตี้ยจนอ่านไม่ออก (ภาพกว้างมาก)
 * ค่าเริ่มต้น: ไม่สูงกว่า 4:5 (แนวตั้ง) และไม่กว้างกว่า 16:9 (แนวนอน)
 */
export const AUTO_FRAME_RATIO_BOUNDS = { min: 4 / 5, max: 16 / 9 } as const;

export function isPrCardFrame(value: string): value is PrCardFrame {
  return (PR_CARD_FRAMES as readonly string[]).includes(value);
}

/** อ่านค่าจากฟอร์ม/ฐานข้อมูล — ค่าเพี้ยน = ค่าเริ่มต้น (`auto`) ไม่ throw */
export function frameOf(value: string | null | undefined): PrCardFrame {
  const trimmed = (value ?? "").trim();
  return isPrCardFrame(trimmed) ? trimmed : DEFAULT_PR_CARD_FRAME;
}

export function frameRatioOf(frame: PrCardFrame): number | null {
  return frame === "auto" ? null : RATIOS[frame];
}

/** บีบอัตราส่วนจริงของภาพให้อยู่ในเพดาน (ใช้กับการ์ดบนเว็บเมื่อเลือก `auto`) */
export function clampAutoRatio(naturalRatio: number): number {
  if (!Number.isFinite(naturalRatio) || naturalRatio <= 0) return RATIOS["4:5"];
  return Math.min(AUTO_FRAME_RATIO_BOUNDS.max, Math.max(AUTO_FRAME_RATIO_BOUNDS.min, naturalRatio));
}

/** อัตราส่วนจริงของภาพการ์ด (กว้าง ÷ สูง) จากขนาดในตาราง `media` · อ่านไม่ได้ = null */
export function naturalRatioOf(size: { readonly width: number | null; readonly height: number | null } | undefined): number | null {
  if (size === undefined) return null;
  const { width, height } = size;
  if (width === null || height === null || width <= 0 || height <= 0) return null;
  return width / height;
}

/**
 * อัตราส่วนที่ **การ์ดบนเว็บ** จะใช้จริง (กว้าง ÷ สูง)
 * - เลือกกรอบไว้ = ใช้กรอบนั้น (ภาพย่อให้เห็นเต็มใบ)
 * - `auto` = ตามภาพ (บีบด้วยเพดาน) · ไม่รู้ขนาดภาพ = 4:5 (ค่าที่ใช้มาก่อนรอบนี้)
 */
export function cardRatioOf(frame: PrCardFrame, size: { readonly width: number | null; readonly height: number | null } | undefined): number {
  const fixed = frameRatioOf(frame);
  if (fixed !== null) return fixed;
  const natural = naturalRatioOf(size);
  return natural === null ? RATIOS["4:5"] : clampAutoRatio(natural);
}

/**
 * ค่าที่หน้าแรกส่งให้การ์ด — `null` = ปล่อยให้ภาพกำหนดความสูงเอง (ใช้กับโหมด `auto` บนหน้าจอแก้)
 * (หน้าเว็บใช้ `cardRatioOf()` แทน เพราะกล่องการ์ดมีความกว้างจำกัด)
 */
export function previewAspectOf(frame: PrCardFrame): number | null {
  return frameRatioOf(frame);
}

/** อ่านค่าที่บันทึกไว้จากเนื้อหา (ใช้เมื่อยังไม่มีค่าจากตารางตั้งค่า) */
export function frameFromContent(content: PageContent | null): PrCardFrame {
  const item = content?.sections["hero"]?.items["card"]?.[0];
  return frameOf(item?.fields["imageFrame"]?.th ?? "");
}
