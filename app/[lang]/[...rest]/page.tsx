import { notFound } from "next/navigation";

/**
 * ดักทุก path ที่ไม่ตรงกับหน้าใดในระบบ
 *
 * ถ้าไม่มีไฟล์นี้ Next.js จะตอบด้วยหน้า 404 เริ่มต้น (ภาษาอังกฤษ ไม่มี header/footer)
 * เพราะ route ไม่ถูก match เลย จึงไม่ถูกห่อด้วย layout ของเรา
 *
 * การเรียก notFound() ที่นี่ทำให้ผู้ใช้เห็นหน้า 404 ที่:
 *  - มี header/footer และโทนสีของเว็บ
 *  - เป็นภาษาที่ตรงกับ path (/en/... ได้ข้อความอังกฤษ)
 */
export default function CatchAllNotFound() {
  notFound();
}
