"use client";

import Image from "next/image";

/**
 * ตารางเลือกภาพจากคลัง (เห็นรูปจริง ไม่ใช่ชื่อไฟล์) — ตัวกลางที่ใช้ร่วมกัน (รอบที่ 299)
 *
 * แยกออกมาจาก `NewsImagePicker` เดิม (รอบที่ 125) เพราะทั้งจอข่าวและจอเมนูอาหารต้องใช้แบบเดียวกัน
 * ⇒ ไม่มีตัวเรนเดอร์ซ้ำสองชุดให้เพี้ยนจากกัน
 */

export type ImageGridItem = {
  readonly id: string;
  readonly filename: string;
  readonly path: string;
};

export function ImageGridPicker({
  library,
  onPick,
  noImages,
}: {
  readonly library: readonly ImageGridItem[];
  readonly onPick: (mediaId: string) => void;
  /** ข้อความเมื่อคลังว่าง (มาจากพจนานุกรมของแต่ละพื้นที่) */
  readonly noImages: string;
}) {
  if (library.length === 0) {
    return <p className="text-fg-muted text-sm">{noImages}</p>;
  }

  return (
    <ul className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-4">
      {library.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => onPick(item.id)}
            className="border-line hover:bg-bg-subtle focus-visible:ring-ring block w-full rounded-lg border p-1 text-left focus-visible:ring-2 focus-visible:outline-none"
          >
            <span className="bg-bg-subtle block h-20 w-full overflow-hidden rounded">
              <Image
                src={item.path}
                alt={item.filename}
                width={200}
                height={160}
                className="h-full w-full object-cover"
                unoptimized
              />
            </span>
            <span className="text-fg-muted mt-1 block truncate text-xs">{item.filename}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
