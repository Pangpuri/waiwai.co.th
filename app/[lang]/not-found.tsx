import { NotFoundContent } from "@/features/shell/ui/not-found-content";
import { en } from "@/lib/i18n/messages/en";
import { th } from "@/lib/i18n/messages/th";

/**
 * 404 ภายใน Route Segment ของภาษา
 *
 * not-found.tsx ไม่ได้รับ params จึงส่งข้อความของทั้งสองภาษาเข้าไป
 * แล้วให้ฝั่ง client เลือกตาม pathname (ดู not-found-content.tsx)
 */
export default function LocaleNotFound() {
  return <NotFoundContent copy={{ th: th.notFound, en: en.notFound }} />;
}
