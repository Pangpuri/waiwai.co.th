import type { Metadata } from "next";
import { fillTemplate } from "@/lib/i18n/template";
import { notFound } from "next/navigation";

import { PreviewFrame } from "@/features/blocks/ui/preview-frame";
import { loadProductShowcaseData } from "@/lib/blocks/product-showcase-data";
import { loadRecipeShowcaseData } from "@/lib/blocks/recipe-showcase-data";
import { loadNewsShowcaseData } from "@/lib/blocks/news-showcase-data";
import { InlineScript } from "@/features/shell/ui/inline-script";
import { SiteFooterLive } from "@/features/shell/ui/site-footer-live";
import { SiteHeaderLive } from "@/features/shell/ui/site-header-live";
import { requireAdminUser } from "@/lib/auth/dal";
import { parseBlockDocument } from "@/lib/blocks/parse";
import { loadDocumentRow, type DocumentStatus } from "@/lib/blocks/repository";
import type { BlockDocument } from "@/lib/blocks/types";
import { loadFooterConfig, loadNavbarConfig } from "@/lib/chrome/loader";
import { isPreviewPart } from "@/lib/chrome/workspace-url";
import { isLocale } from "@/lib/i18n/config";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import { isDatabaseConfigured } from "@/lib/content/repository";
import { isPreviewablePage } from "@/lib/pages/paths";

/**
 * พรีวิว "ในเปลือกหน้าเว็บจริง" — อยู่ใต้ `[lang]` จึงได้หัวเว็บ/ท้ายเว็บ/ฟอนต์/ธีม/โหมดมืด เหมือนหน้าจริงทุกอย่าง
 *
 * ⚠️ เส้นทางนี้เป็นของ **ผู้ดูแลเท่านั้น** (`requireAdminUser("<permission>")` → เด้งไปหน้าล็อกอิน)
 *    และสั่ง `noindex` — ห้ามให้เครื่องค้นหาหรือบุคคลภายนอกเห็นฉบับร่าง
 *
 * `?mode=draft` (ค่าตั้งต้น) = ฉบับร่างที่กำลังแก้ · `?mode=published` = ฉบับที่เผยแพร่แล้ว
 * หน้าจอหลังบ้านฝังเส้นทางนี้ใน `<iframe>` และอัปเดตเนื้อหาสด ๆ ผ่าน postMessage (ยังไม่บันทึกก็เห็นได้)
 *
 * ตั้งแต่รอบที่ 54: **หัวเว็บในพรีวิวก็สดด้วย** — เรนเดอร์ `SiteHeaderLive` แทนหัวเว็บของ layout
 * (ซ่อนหัวเว็บของ layout ด้วย CSS ที่ผูกกับ `data-preview-chrome` ที่ตั้งก่อน paint) ⇒ แก้ navbar แล้วเห็นทันที
 */

/**
 * หน้าที่เปิดพรีวิวได้ — **รายการกลางอยู่ที่ `lib/pages/paths.ts`** (`PREVIEWABLE_PAGE_IDS`)
 * (เดิมไฟล์นี้ถือ `["home"]` ไว้เอง ⇒ ลิงก์พรีวิว X2.6 จะต้องคัดลอกรายการซ้ำ)
 */
export async function generateMetadata(): Promise<Metadata> {
  return { title: "Preview", robots: { index: false, follow: false } };
}

export default async function PreviewPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly lang: string; readonly page: string }>;
  readonly searchParams: Promise<{ readonly mode?: string; readonly parts?: string }>;
}) {
  await requireAdminUser("content");

  const { lang, page } = await params;
  if (!isLocale(lang)) notFound();
  if (!isPreviewablePage(page)) notFound();

  const messages = await getMessagesFor(lang);
  const query = await searchParams;
  const requested = query.mode;
  const status: DocumentStatus = requested === "published" ? "published" : "draft";
  /*
    `?parts=nav` = พรีวิว "เฉพาะส่วน" (ผู้ใช้สั่ง รอบที่ 57)
    *"เอามาแต่ nav พอครับ ไม่ต้องเอาภาพประกาศมาพรีวิวด้วย"*
    ⇒ ติดธงให้ CSS ซ่อนป้ายประกาศ (ซึ่งเป็นโอเวอร์เลย์เต็มจอ) และซ่อนเนื้อหาหน้า ⇒ เห็นหัวเว็บชัด ๆ
    ⚠️ มีผลเฉพาะในพรีวิวนี้ — ไม่แตะโค้ดที่ออกใช้งานจริง (หน้าเว็บสาธารณะ)
  */
  /*
    parts: nav = เฉพาะแถบเมนู · footer = เฉพาะท้ายเว็บ · notice = เฉพาะป้ายประกาศ (รอบที่ 159)
           content = **เฉพาะเนื้อหาหน้า — ไม่เอาส่วนกลาง (แถบเมนู/ท้ายเว็บ/ป้ายประกาศ)** (รอบที่ 182)

    ที่มา (ฟีดแบ็กเจ้าของ): *"จัดการหน้าแรกไม่ต้องโชว์ที่มาจากส่วนกลาง … แถบเมนู footer ไม่ต้องโชว์"*
    ⇒ ตอนจัดเลเยอร์ของหน้า ควรเห็นแค่สิ่งที่ **หน้านี้เป็นเจ้าของ** ส่วนที่มาจากส่วนกลางไปแก้ที่แท็บนั้น ๆ
    ⚠️ รายชื่อโหมดทั้งหมดอยู่ที่ `PREVIEW_PARTS` (lib/chrome/workspace-url.ts) — ห้ามพิมพ์ซ้ำที่นี่
    ⚠️ หน้านี้เรนเดอร์ **เอกสารฉบับร่าง** (ไม่ดึงข้อมูลหน้าเว็บจริง) ⇒ สิ่งที่เห็น = สิ่งที่จะบันทึก
  */
  const partsQuery = (query.parts ?? "").trim();
  const requestedParts = isPreviewPart(partsQuery) ? partsQuery : null;

  /*
    ป้ายบอกโหมดพรีวิว (รอบที่ 218) — ทุกโหมดต้องมีคำแปล (เทสต์บังคับให้ตรงกับ `PREVIEW_PARTS`)
    ⚠️ โหมดที่ไม่รู้จัก = ถอยไปใช้ "พรีวิวทั้งหน้า" (ไม่ทำให้หน้าพัง)
  */
  const previewPartLabels: Readonly<Record<string, string>> = {
    content: messages.admin.previewPartsContent,
    nav: messages.admin.previewPartsNav,
    footer: messages.admin.previewPartsFooter,
    notice: messages.admin.previewPartsNotice,
  };
  /* หัวเว็บฉบับเผยแพร่ = ค่าเริ่มต้นในพรีวิว (จากนั้นอัปเดตสด ๆ ด้วย postMessage) */
  const navbarConfig = await loadNavbarConfig(lang);
  /* ท้ายเว็บฉบับเผยแพร่ = ค่าเริ่มต้นในพรีวิว (จากนั้นอัปเดตสด ๆ ผ่าน postMessage) */
  const footerConfig = await loadFooterConfig(lang);

  const empty: BlockDocument = { page, blocks: [] };

  if (!isDatabaseConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <p className="text-fg-muted text-sm">DATABASE_URL is not configured.</p>
      </div>
    );
  }

  const row = await loadDocumentRow(page, status);
  const parsed = row === null ? null : parseBlockDocument(page, row.raw);
  const document = parsed !== null && parsed.ok ? parsed.document : empty;

  return (
    <div className="flex flex-col">
      {/*
        ซ่อนหัวเว็บ/ท้ายเว็บของ layout แล้วใช้หัวเว็บ "สด" ของพรีวิวแทน (รอบที่ 54)
        - สคริปต์ตั้ง `data-preview-chrome` บน <html> ก่อน paint ⇒ ไม่มีหัวเว็บซ้อนกันให้เห็น
        - หัวเว็บสดใช้คอมโพเนนต์ตัวเดียวกับเว็บจริง (SiteHeader) ⇒ หน้าตาเหมือนเดิมเป๊ะ
      */}
      <InlineScript
        html={
          requestedParts === null
            ? 'document.documentElement.setAttribute("data-preview-chrome","1");'
            : `document.documentElement.setAttribute("data-preview-chrome","1");document.documentElement.setAttribute("data-preview-parts","${requestedParts}");`
        }
      />
      {/*
        แถบเมนูสดใช้เฉพาะเมื่อพรีวิว "ทั้งหน้า" (ไม่มี parts) หรือโหมดเฉพาะแถบเมนู
        ⚠️ โหมด content = ไม่ต้องเห็นส่วนกลางเลย (รอบที่ 182) · โหมด footer/notice ก็ไม่ต้องเห็น
      */}
      {requestedParts === null || requestedParts === "nav" ? (
        <SiteHeaderLive locale={lang} messages={messages} initial={navbarConfig} />
      ) : null}
      {requestedParts === "footer" ? <SiteFooterLive locale={lang} messages={messages} initial={footerConfig} /> : null}

      {/*
        รอบที่ 218 (เจ้าของขอ "ก"): **แถบบอกว่ากำลังดูโหมดไหน** — กันเข้าใจผิดว่าพรีวิวไม่ตรงหน้าเว็บ
        (พรีวิวโหมดเนื้อหาหลัก **ไม่รวม** แถบเมนู/ท้ายเว็บ/ป้ายประกาศ ตามที่ผู้ใช้สั่งไว้รอบ 178–182)
        ⚠️ ถ้าเพิ่มโหมดพรีวิวใหม่ ต้องเพิ่มคำแปลให้ครบ — `satisfies Record<PreviewPart, string>` บังคับให้ TS ฟ้อง
      */}
      <p
        className="bg-surface-raised border-line text-fg-muted border-b px-4 py-2 text-center text-xs"
        data-preview-parts-bar=""
      >
        {fillTemplate(messages.admin.previewPartsBarTitle, {
          label:
            requestedParts === null
              ? messages.admin.previewPartsFull
              : (previewPartLabels[requestedParts] ?? messages.admin.previewPartsFull),
        })}
      </p>

      {status === "draft" ? (
        <p className="bg-surface-raised border-line text-fg-muted border-b px-4 py-2 text-center text-xs" data-preview-notice="draft">
          {messages.admin.previewDraftNotice}
        </p>
      ) : null}

      <div data-preview-content="">
        {document.blocks.length === 0 ? (
          <p className="text-fg-muted px-4 py-20 text-center text-sm">{messages.admin.previewNoBlocks}</p>
        ) : (
          <PreviewFrame initialDocument={document} language={lang} productData={await loadProductShowcaseData(document)} recipeData={await loadRecipeShowcaseData(document)} newsData={await loadNewsShowcaseData(document)} />
        )}
      </div>
    </div>
  );
}
