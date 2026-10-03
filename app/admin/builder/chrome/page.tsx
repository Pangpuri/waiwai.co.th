import type { Metadata } from "next";

import { publishChromeAction } from "@/app/admin/builder/chrome/actions";
import { ChromeWorkspace } from "@/features/admin/ui/chrome-workspace";
import { FooterEditor } from "@/features/admin/ui/footer-editor";
import { MourningEditor } from "@/features/admin/ui/mourning-editor";
import { NavbarEditor } from "@/features/admin/ui/navbar-editor";
import { requireAdminUser } from "@/lib/auth/dal";
import { loadDocumentRow, listRevisions } from "@/lib/blocks/repository";
import { FOOTER_PAGE_KEY, defaultFooterConfig, parseFooterConfig } from "@/lib/chrome/footer";
import { NAVBAR_PAGE_KEY, applyPageMenu, defaultNavbarConfig, parseNavbarConfig } from "@/lib/chrome/navbar";
import { defaultPages } from "@/lib/pages/model";
import { listPages } from "@/lib/pages/repository";
import { isDatabaseConfigured } from "@/lib/content/repository";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import { MOURNING_PAGE_KEY, defaultMourningConfig, parseMourningConfig } from "@/lib/mourning/config";

/**
 * "ส่วนกลางของเว็บ" — แถบเมนู · ป้ายประกาศ · ท้ายเว็บ (ผู้ใช้สั่ง รอบที่ 55)
 *
 * *"ทำที่ไม่ใช่ส่วนคอนเท้นก่อน คือ Navbar ป้ายประกาศ footer เพราะพวกนี้แทบจะโชว์ทุกหน้า …
 *   แท็บแรกที่จะทำคือ ส่วนกลาง · พรีวิวแบ่งโหมด: หน้าเว็บปัจจุบัน / ที่กำลังแก้ / ภาพรวม"*
 *
 * ⚠️ หน้าจอนี้เป็นของผู้ดูแลเท่านั้น (requireAdminUser → เด้งไปล็อกอิน)
 */

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Site-wide parts", robots: { index: false, follow: false } };
}

export default async function ChromePage() {
  await requireAdminUser();

  const messages = await getMessagesFor("th");
  const strings = messages.admin;

  if (!isDatabaseConfigured()) {
    return (
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-10">
        <section className="border-line bg-surface-raised rounded-2xl border p-5">
          <p className="text-fg-muted text-sm">{strings.dbMissingShort}</p>
        </section>
      </main>
    );
  }

  /* ── แถบเมนู: ฉบับร่าง + ฉบับเผยแพร่ ── */
  const navbarDraftRow = await loadDocumentRow(NAVBAR_PAGE_KEY, "draft");
  const navbarPublishedRow = await loadDocumentRow(NAVBAR_PAGE_KEY, "published");
  const parsedNavbar = navbarDraftRow === null ? null : parseNavbarConfig(navbarDraftRow.raw, messages);
  const rawNavbar = parsedNavbar !== null && parsedNavbar.ok ? parsedNavbar.config : defaultNavbarConfig(messages);

  /* ── หน้าเป็นวัตถุ (W1): ชื่อเมนูมาจาก "ชื่อหน้า" ⇒ ต้องใช้ค่าเดียวกันทั้งหลังบ้านและหน้าเว็บ ── */
  const pages = await listPages(defaultPages(messages));
  const pageLabels: Record<string, { th: string; en: string }> = {};
  const pageHidden: string[] = [];
  for (const entry of pages) {
    if (entry.inMenu) pageLabels[entry.id] = { th: entry.nameTh, en: entry.nameEn.trim() === "" ? entry.nameTh : entry.nameEn };
    else pageHidden.push(entry.id);
  }
  const navbarConfig = applyPageMenu(rawNavbar, { labels: pageLabels, hidden: pageHidden });

  /* ── ป้ายประกาศ: ฉบับร่าง + ฉบับเผยแพร่ ── */
  const noticeDraftRow = await loadDocumentRow(MOURNING_PAGE_KEY, "draft");
  const noticePublishedRow = await loadDocumentRow(MOURNING_PAGE_KEY, "published");
  const noticeRevisions = await listRevisions(MOURNING_PAGE_KEY);
  const parsedNotice = noticeDraftRow === null ? null : parseMourningConfig(noticeDraftRow.raw, messages);
  const noticeConfig = parsedNotice !== null && parsedNotice.ok ? parsedNotice.config : defaultMourningConfig(messages);

  /* ── ท้ายเว็บ (W3) ── */
  const footerDraftRow = await loadDocumentRow(FOOTER_PAGE_KEY, "draft");
  const footerPublishedRow = await loadDocumentRow(FOOTER_PAGE_KEY, "published");
  const parsedFooter = footerDraftRow === null ? null : parseFooterConfig(footerDraftRow.raw, messages);
  const footerConfig = parsedFooter !== null && parsedFooter.ok ? parsedFooter.config : defaultFooterConfig(messages);

  const statusRow = (
    key: string,
    draft: { readonly updatedAt: string } | null,
    published: { readonly publishedAt: string | null } | null,
  ) => {
    const publishedAt = published?.publishedAt ?? null;
    return (
      <li key={key} className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-fg-muted text-xs">
          {draft === null ? strings.chromeStatusClean : strings.chromeStatusDraft}
        </span>
        <span className="text-fg-muted text-[11px]">
          {publishedAt === null ? "" : `${strings.chromeStatusPublishedAt} ${publishedAt.slice(0, 16).replace("T", " ")}`}
          {draft === null ? "" : ` · ${strings.draftPrefix} ${draft.updatedAt.slice(0, 16).replace("T", " ")}`}
        </span>
      </li>
    );
  };

  return (
    <main className="mx-auto flex max-w-[1800px] flex-col gap-4 px-4 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-fg text-lg font-semibold">{strings.chromeTitle}</h1>
        <p className="text-fg-muted text-xs">{strings.chromeIntro}</p>
      </header>

      <ChromeWorkspace
        strings={{
          partsLabel: strings.chromePartsLabel,
          partNavbar: strings.chromePartNavbar,
          partNotice: strings.chromePartNotice,
          partFooter: strings.chromePartFooter,
          viewLabel: strings.chromeViewLabel,
          modeCurrent: strings.chromeModeCurrent,
          modeDraft: strings.chromeModeDraft,
          modeOverview: strings.chromeModeOverview,
          modeHintCurrent: strings.chromeModeHintCurrent,
          modeHintDraft: strings.chromeModeHintDraft,
          modeHintOverview: strings.chromeModeHintOverview,
          reloadPreview: strings.reloadPreview,
          openInNewTab: strings.openInNewTab,
          previewTitle: strings.previewTitle,
          footerPending: strings.chromePartFooterPending,
        }}
        previewSrcCurrent="/th/preview/home?mode=published&parts=nav"
        previewSrcDraft="/th/preview/home?mode=draft&parts=nav"
        footerPreviewSrcCurrent="/th/preview/home?mode=published&parts=footer"
        footerPreviewSrcDraft="/th/preview/home?mode=draft&parts=footer"
        navbarEditor={
          <NavbarEditor
            key={navbarDraftRow?.updatedAt ?? "fresh-navbar"}
            initial={navbarConfig}
            pageNameIds={pages.map((entry) => entry.id)}
            draftUpdatedAt={navbarDraftRow?.updatedAt ?? null}
            publishedAt={navbarPublishedRow?.publishedAt ?? null}
            strings={strings}
          />
        }
        footerEditor={
          <FooterEditor
            key={footerDraftRow?.updatedAt ?? "fresh-footer"}
            initial={footerConfig}
            draftUpdatedAt={footerDraftRow?.updatedAt ?? null}
            publishedAt={footerPublishedRow?.publishedAt ?? null}
            strings={strings}
          />
        }
        noticeEditor={
          <MourningEditor
            key={noticeDraftRow?.updatedAt ?? "fresh-notice"}
            initial={noticeConfig}
            draftUpdatedAt={noticeDraftRow?.updatedAt ?? null}
            publishedAt={noticePublishedRow?.publishedAt ?? null}
            revisions={noticeRevisions}
            strings={strings}
          />
        }
        overview={
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <p className="text-fg text-sm font-semibold">{strings.chromeOverviewTitle}</p>
              <p className="text-fg-muted text-xs">{strings.chromeOverviewHint}</p>
            </div>

            <ul className="border-line flex flex-col gap-2 rounded-lg border p-3">
              <li className="text-fg text-xs font-semibold">{strings.chromePartNavbar}</li>
              {statusRow("navbar", navbarDraftRow, navbarPublishedRow)}
              <li className="text-fg mt-1 text-xs font-semibold">{strings.chromePartNotice}</li>
              {statusRow("notice", noticeDraftRow, noticePublishedRow)}
              <li className="text-fg mt-1 text-xs font-semibold">{strings.chromePartFooter}</li>
              {statusRow("footer", footerDraftRow, footerPublishedRow)}
            </ul>

            <form action={publishChromeAction}>
              <button
                type="submit"
                className="bg-brand-red text-on-brand focus-visible:ring-ring w-full rounded-lg px-3 py-2 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none"
              >
                {strings.chromePublishAll}
              </button>
            </form>

            <p className="text-fg-muted text-[11px]">{strings.chromeModeHintDraft}</p>
          </div>
        }
      />
    </main>
  );
}
