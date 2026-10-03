"use client";

import { useRef, useState } from "react";

import { shrinkImageFile, shrinkSummary } from "@/features/admin/ui/image-resize";

/**
 * ช่องเลือกไฟล์ภาพที่ **ย่อ/แปลงเป็น WebP ให้อัตโนมัติก่อนส่งฟอร์ม** (รอบที่ 99)
 *
 * ใช้แทน `<input type="file" name="file">` ในหน้าคลังภาพ + ตัวแก้ "ส่วนกลาง"
 * - ทำงานตอนผู้ใช้เลือกไฟล์ (ก่อนกดปุ่มอัปโหลด) ⇒ ไม่ต้องแก้ Server Action เลย
 * - ย่อไม่สำเร็จ/ไฟล์ไม่เล็กลง = ใช้ไฟล์เดิม · เบราว์เซอร์เก่าที่ไม่มี `DataTransfer` = ส่งไฟล์เดิม (ไม่พัง)
 * - ข้อความสรุปเป็นตัวเลขล้วน (KB → KB) — ไม่ต้องใช้พจนานุกรม
 */

export function ImageFileInput({
  className,
  label,
  hint,
  accept = "image/png,image/jpeg,image/webp",
}: {
  readonly className: string;
  /** ป้ายเหนือช่อง (มาจากพจนานุกรมเสมอ) */
  readonly label?: string;
  /** คำอธิบายใต้ช่อง (มาจากพจนานุกรมเสมอ) */
  readonly hint?: string;
  readonly accept?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<string | null>(null);

  async function handleChange(): Promise<void> {
    const input = inputRef.current;
    const file = input?.files?.item(0) ?? null;
    if (input === null || file === null) return;

    setNote(null);
    const outcome = await shrinkImageFile(file);
    const summary = shrinkSummary(outcome);
    if (summary === null) return;

    /* ใส่ไฟล์ที่ย่อแล้วกลับเข้า input เดิม — ฟอร์มยังส่งชื่อฟิลด์ `file` เหมือนเดิม */
    try {
      const transfer = new DataTransfer();
      transfer.items.add(outcome.file);
      input.files = transfer.files;
      setNote(summary);
    } catch {
      /* เบราว์เซอร์เก่า: ส่งไฟล์เดิม (พฤติกรรมเหมือนก่อนรอบนี้) */
    }
  }

  return (
    <label className="flex min-w-48 flex-1 flex-col gap-1">
      {label === undefined ? null : <span className="text-fg-muted text-xs">{label}</span>}
      <input
        ref={inputRef}
        type="file"
        name="file"
        accept={accept}
        className={className}
        onChange={() => {
          void handleChange();
        }}
      />
      <span className="text-fg-muted text-[11px]">
        {note ?? hint ?? ""}
      </span>
    </label>
  );
}
