import { ImageLibraryProvider, type ImageLibraryItem } from "@/features/admin/ui/image-library";
import { PageSeoSettings } from "@/features/admin/ui/page-seo-settings";
import { can } from "@/lib/auth/roles";
import type { AdminRole } from "@/lib/auth/types";
import type { Messages } from "@/lib/i18n/messages/th";
import { listMedia } from "@/lib/media/repository";
import { findPage } from "@/lib/pages/repository";
import { pageSeoExample } from "@/lib/pages/seo-example";

/**
 * แผง SEO ของ "หน้าหลักของแต่ละส่วน" สำหรับจอหลังบ้านที่ไม่ใช่ตัวสร้างหน้าเว็บ
 * (สินค้า · เมนูอาหาร · ข่าว · ประกาศรับสมัครงาน)
 *
 * ที่มา (คำเจ้าของ 2026-11-09): หน้าเหล่านี้มี URL จริงและมีแถว `page` อยู่ในฐานข้อมูล
 * แต่ตัวสร้างหน้าเว็บถูกถอดออก (รอบ 269) ⇒ **ไม่มีทางแก้ SEO จากหลังบ้านเลย**
 * แผงนี้ใช้ `PageSeoSettings` ตัวเดียวกับ builder (ตัวอย่าง + รูปแชร์ + toast)
 *
 * ⚠️ แสดงเฉพาะบทบาทที่มีสิทธิ์ `seo` (ผู้เผยแพร่ขึ้นไป) — action บังคับสิทธิ์ซ้ำอีกชั้น
 * ⚠️ ถ้าอ่าน `page`/คลังภาพไม่ได้ = ไม่แสดงแผง (หน้า list ต้องยังใช้งานได้)
 */
export async function AdminPageSeoSection({
  pageId,
  messages,
  role,
  className = "",
}: {
  readonly pageId: string;
  readonly messages: Messages;
  readonly role: AdminRole;
  readonly className?: string;
}) {
  if (!can(role, "seo")) return null;

  const page = await findPage(pageId);
  if (page === null) return null;

  const example = pageSeoExample(pageId, messages);

  let library: readonly ImageLibraryItem[] = [];
  try {
    const media = await listMedia(48);
    library = media.map((item) => ({
      id: item.id,
      filename: item.filename,
      altTh: item.altTh,
      altEn: item.altEn,
    }));
  } catch {
    /* ไม่มีคลังภาพ = ยังอัปโหลด/แก้ SEO ได้ (ปุ่มเลือกจากคลังจะหายไป) */
  }

  return (
    <details className={`border-line bg-surface-raised rounded-2xl border p-4 ${className}`}>
      <summary className="text-fg cursor-pointer text-sm font-semibold">{messages.admin.seoTitle}</summary>
      <p className="text-fg-muted mt-1 text-xs">{messages.admin.seoHint}</p>
      <div className="mt-3">
        <ImageLibraryProvider items={library}>
          <PageSeoSettings
            page={page}
            strings={messages.admin}
            exampleTitle={example.title}
            exampleDescription={example.description}
            showHeader={false}
            embedded
          />
        </ImageLibraryProvider>
      </div>
    </details>
  );
}
