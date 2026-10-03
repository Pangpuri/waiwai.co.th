import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BlockDocumentView } from "@/features/blocks/block-renderer";
import { InlineScript } from "@/features/shell/ui/inline-script";
import { SiteFooterLive } from "@/features/shell/ui/site-footer-live";
import { SiteHeaderLive } from "@/features/shell/ui/site-header-live";
import { parseBlockDocument } from "@/lib/blocks/parse";
import { loadDocumentRow } from "@/lib/blocks/repository";
import type { BlockDocument } from "@/lib/blocks/types";
import { loadFooterConfig, loadNavbarConfig } from "@/lib/chrome/loader";
import { isDatabaseConfigured } from "@/lib/content/repository";
import { isLocale } from "@/lib/i18n/config";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import { isPreviewablePage } from "@/lib/pages/paths";
import { isPreviewTokenShape } from "@/lib/preview-link/plan";
import { resolvePreviewLink } from "@/lib/preview-link/repository";

/**
 * ลิงก์พรีวิวชั่วคราว (X2.6) — `/th/preview/t/<token>`
 *
 * เปิดได้ **โดยไม่ต้องมีบัญชีหลังบ้าน** (นี่คือเหตุผลที่ทำ) ⇒ ต้องคุมเข้มเป็นพิเศษ
 * - โทเคน 32 ไบต์สุ่ม เก็บใน DB แค่ hash · ตรวจ **หมดอายุ + ยกเลิก** ที่เซิร์ฟเวอร์ทุกครั้ง
 * - ใช้ไม่ได้ทุกกรณี → `notFound()` (404) — **ไม่บอกว่าล้มเพราะอะไร** (ไม่ให้เป็นช่องเดาว่าโทเคนไหนเคยมี)
 * - `force-dynamic` **บังคับ**: ห้าม prerender/แคชหน้าโทเคนเด็ดขาด (แคชผิด = คนอื่นเปิดลิงก์ได้)
 * - `noindex` + `x-robots-tag` (ตั้งที่ `next.config.ts`) ⇒ เครื่องค้นหาไม่เก็บฉบับร่าง
 * - ใช้ตัวเรนเดอร์ **ตัวเดียวกับหน้าเว็บจริง** (`BlockDocumentView`) ⇒ สิ่งที่ผู้จัดการเห็น = สิ่งที่จะขึ้นเว็บ
 *
 * ⚠️ เส้นทางนี้อยู่ในรายการบายพาสโหมดปิดปรับปรุง (เหมือน `/preview` เดิม) โดยเจตนา —
 *    ลิงก์มีโทเคนกันอยู่แล้ว และการปิดปรับปรุงมักเกิดตอนกำลังซ่อม/ย้ายเว็บ ซึ่งผู้จัดการยังต้องดูงานได้
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Preview",
  robots: { index: false, follow: false },
};

export default async function PreviewLinkPage({
  params,
}: {
  readonly params: Promise<{ readonly lang: string; readonly token: string }>;
}) {
  const { lang, token } = await params;

  if (!isLocale(lang)) notFound();
  /* ตรวจ "รูปทรง" โทเคนก่อนแตะฐานข้อมูล (ค่าขยะจาก URL ไม่ควรทำให้เกิดคิวรี) */
  if (!isPreviewTokenShape(token)) notFound();

  const resolution = await resolvePreviewLink(token);
  if (!resolution.ok || resolution.page === null) notFound();

  const page = resolution.page;
  if (!isPreviewablePage(page)) notFound();

  const messages = await getMessagesFor(lang);

  const navbarConfig = await loadNavbarConfig(lang);
  const footerConfig = await loadFooterConfig(lang);

  const empty: BlockDocument = { page, blocks: [] };

  if (!isDatabaseConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <p className="text-fg-muted text-sm">DATABASE_URL is not configured.</p>
      </div>
    );
  }

  const row = await loadDocumentRow(page, "draft");
  const parsed = row === null ? null : parseBlockDocument(page, row.raw);
  const document = parsed !== null && parsed.ok ? parsed.document : empty;

  return (
    <div className="flex flex-col">
      {/* ซ่อนหัวเว็บ/ท้ายเว็บของ layout แล้วใช้หัวเว็บสดของพรีวิว (แบบเดียวกับพรีวิวในหลังบ้าน) */}
      <InlineScript html={'document.documentElement.setAttribute("data-preview-chrome","1");'} />
      <SiteHeaderLive locale={lang} messages={messages} initial={navbarConfig} />

      <p
        className="bg-surface-raised border-line text-fg-muted border-b px-4 py-2 text-center text-xs"
        data-preview-link-notice="draft"
      >
        {messages.previewLinkPage.notice}
      </p>

      <div data-preview-content="">
        {document.blocks.length === 0 ? (
          <p className="text-fg-muted px-4 py-20 text-center text-sm">{messages.previewLinkPage.noBlocks}</p>
        ) : (
          <BlockDocumentView document={document} language={lang} />
        )}
      </div>

      <SiteFooterLive locale={lang} messages={messages} initial={footerConfig} />
      {/* ผู้จัดการดูเสร็จแล้วกลับหน้าเว็บจริงได้ทันที (ไม่มีเมนูหลังบ้านให้กด) */}
      <p className="text-fg-muted px-4 pb-8 text-center text-xs">
        <Link
          href={`/${lang}`}
          className="text-link focus-visible:ring-ring font-semibold underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
        >
          {messages.previewLinkPage.backToSite}
        </Link>
      </p>
    </div>
  );
}
