import Image from "next/image";

import type { MediaSize } from "@/lib/media/repository";
import type { NewsBlock } from "@/lib/news/body";

/**
 * เนื้อหาข่าว (หน้า /news · รอบที่ 105) — Server Component
 *
 * - รับ **บล็อกที่ผ่านการตรวจแล้ว** (`parseNewsBody` ฝั่ง repository) ⇒ ไม่มีการตีความเป็น HTML เลย
 *   (ข้อความทุกก้อนถูกเรนเดอร์เป็นข้อความ — กัน XSS จากเนื้อหาที่วางมาจาก Facebook)
 * - รูปมาจากคลังของเรา (`/media/<id>` · มติ D9/D11) · ขนาดอ่านจากตาราง `media` (ไม่มีขนาด = 1024×768 สำรอง)
 * - ไม่มี JS เพิ่ม: รูปโหลดแบบ lazy ตามค่าเริ่มต้นของ `next/image`
 */

const FALLBACK_WIDTH = 1024;
const FALLBACK_HEIGHT = 768;

export function NewsBody({
  blocks,
  sizes,
  captionPlaceholder,
}: {
  readonly blocks: readonly NewsBlock[];
  readonly sizes: ReadonlyMap<string, MediaSize>;
  /**
   * ข้อความตัวอย่างที่แสดงเมื่อภาพ **ไม่มีคำบรรยาย** (รอบที่ 130)
   * - ใช้เฉพาะใน **พรีวิวหลังบ้าน** เพื่อให้คนแก้รู้ว่าคำบรรยายจะไปโผล่ตรงไหน
   * - หน้าเว็บจริงไม่ส่งค่านี้ ⇒ ภาพที่ไม่มีคำบรรยาย = ไม่มีบรรทัดว่างโผล่มา
   */
  readonly captionPlaceholder?: string;
}) {
  return (
    <div className="space-y-5">
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;

        if (block.type === "image") {
          const size = sizes.get(block.mediaId);
          /* คำบรรยายใต้ภาพ (รอบที่ 130) — ผู้อ่านต้องเห็นจริง ไม่ใช่แค่ alt สำหรับ screen reader */
          const caption = block.alt.trim();
          return (
            <figure key={key} className="my-6">
              <Image
                src={`/media/${block.mediaId}`}
                alt={block.alt}
                width={size?.width ?? FALLBACK_WIDTH}
                height={size?.height ?? FALLBACK_HEIGHT}
                sizes="(max-width: 768px) 92vw, 720px"
                className="h-auto w-full rounded-xl border border-line"
              />
              {caption !== "" ? (
                <figcaption className="text-fg-muted mt-2 text-center text-sm">{caption}</figcaption>
              ) : captionPlaceholder === undefined ? null : (
                <figcaption className="text-fg-muted mt-2 text-center text-sm italic">
                  {captionPlaceholder}
                </figcaption>
              )}
            </figure>
          );
        }

        if (block.type === "heading") {
          return (
            <h2 key={key} className="pt-2 font-display text-xl font-bold tracking-tight text-fg sm:text-2xl">
              {block.text}
            </h2>
          );
        }

        return (
          <p key={key} className="text-base leading-relaxed text-fg-muted">
            {block.text}
          </p>
        );
      })}
    </div>
  );
}
