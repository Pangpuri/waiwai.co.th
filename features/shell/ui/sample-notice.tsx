/**
 * กล่องข้อความแจ้งว่า "หน้านี้เป็นตัวอย่าง รอการอนุมัติ"
 *
 * ผู้ใช้สั่งให้แจ้งชัดบนหน้าที่เป็น mockup (products · recipes · news)
 * จึงทำเป็นคอมโพเนนต์กลาง เพื่อให้ข้อความและหน้าตาเหมือนกันทุกหน้า
 * และวางไว้ใต้หัวเรื่องเสมอ — ไม่ซ่อนไว้ท้ายหน้า
 *
 * ข้อความมาจากพจนานุกรม (ไม่ hardcode) เพื่อให้แปลตามภาษาได้
 */
type SampleNoticeProps = {
  readonly text: string;
};

export function SampleNotice({ text }: SampleNoticeProps) {
  return (
    <p className="mt-8 flex max-w-3xl gap-3 rounded-2xl border border-line bg-surface px-5 py-4 text-sm leading-relaxed text-fg">
      <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-red" />
      {text}
    </p>
  );
}
