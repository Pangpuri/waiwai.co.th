"use client";

type InlineScriptProps = {
  readonly html: string;
};

/**
 * สคริปต์ที่ต้องรัน "ระหว่างเบราว์เซอร์ parse HTML" — ก่อน paint ครั้งแรก
 *
 * ใช้กับงานที่ค่าจริงอยู่ใน localStorage (ธีม · สถานะคุกกี้) ซึ่งเซิร์ฟเวอร์ไม่รู้
 * ถ้าเลื่อนไปทำหลัง hydrate ผู้ใช้จะเห็นจอวาบ/แถบวาบก่อน
 *
 * ทำไมต้อง `type` สองค่า (ตามคู่มือ Next.js: guides/preventing-flash-before-hydration § Themes)
 * - ฝั่งเซิร์ฟเวอร์/ตอนส่ง HTML แรก → `text/javascript` เพื่อให้เบราว์เซอร์รันระหว่าง parse
 * - ฝั่ง client → `text/plain` เพื่อให้ React ข้าม `<script>` ที่ mount บน client
 *   (React 19 เตือนว่า `<script>` ที่สร้างบน client ไม่ถูก execute — และมันไม่จำเป็นต้องรันซ้ำ
 *   เพราะคลาสบน <html> ถูกตั้งไปแล้วตั้งแต่ parse ครั้งแรก)
 *
 * ต้องเป็น Client Component: ถ้าเป็น Server Component ค่า `type` จะถูกคำนวณที่เซิร์ฟเวอร์ครั้งเดียว
 * แล้ว serialize ลง RSC payload → ฝั่ง client จะได้ `text/javascript` ติดมาด้วยและยังเตือนอยู่
 *
 * `suppressHydrationWarning` จำเป็นเพราะ attribute `type` ตั้งใจให้ไม่ตรงกันสองฝั่ง
 */
export function InlineScript({ html }: InlineScriptProps) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
