import type { Metadata } from "next";

import { publishChromeAction } from "@/app/admin/builder/chrome/actions";
import { ChromeWorkspace } from "@/features/admin/ui/chrome-workspace";
import {
  ChromePresetIoPanel,
  ChromePresetPanel,
  type ChromePresetRow,
  type ChromePresetStrings,
} from "@/features/admin/ui/chrome-preset-panel";
import { FooterEditor } from "@/features/admin/ui/footer-editor";
import { MourningEditor } from "@/features/admin/ui/mourning-editor";
import { NavbarEditor } from "@/features/admin/ui/navbar-editor";
import { ImageLibraryProvider, type ImageLibraryItem } from "@/features/admin/ui/image-library";
import { requireAdminUser } from "@/lib/auth/dal";
import { can } from "@/lib/auth/roles";
import { listMedia } from "@/lib/media/repository";
import { loadDocumentRow, listRevisions } from "@/lib/blocks/repository";
import {
  MAX_CHROME_PRESETS_PER_KIND,
  MAX_CHROME_PRESET_IMPORT,
  chromePresetCounts,
  chromePresetPreview,
  type ChromePreset,
} from "@/lib/chrome/presets";
import { listChromePresets, readChromeDraftUndo } from "@/lib/chrome/preset-repository";
import { FOOTER_PAGE_KEY, defaultFooterConfig, parseFooterConfig } from "@/lib/chrome/footer";
import { NAVBAR_PAGE_KEY, applyPageMenu, defaultNavbarConfig, parseNavbarConfig } from "@/lib/chrome/navbar";
import { defaultPages } from "@/lib/pages/model";
import { listPages } from "@/lib/pages/repository";
import { isDatabaseConfigured } from "@/lib/content/repository";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import { fillTemplate } from "@/lib/i18n/template";
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
  const user = await requireAdminUser("presets");

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

  /* ── พรีเซ็ตของส่วนกลาง (W3b): สรุปแต่ละชุดให้อ่านรู้เรื่อง + แปลงเป็นแถวของแผง ── */
  const presets: readonly ChromePreset[] = await listChromePresets(messages);

  function detailOf(preset: ChromePreset): string {
    const counts = chromePresetCounts(preset.payload);
    switch (preset.payload.kind) {
      case "navbar":
        return fillTemplate(strings.chromePresetCountNavbar, { items: counts.primary, buttons: counts.secondary });
      case "footer":
        return fillTemplate(strings.chromePresetCountFooter, { groups: counts.primary, socials: counts.secondary });
      case "mourning":
        return `${fillTemplate(strings.chromePresetCountMourning, { images: counts.primary })} · ${
          counts.enabled === true ? strings.chromePresetMourningOn : strings.chromePresetMourningOff
        }`;
    }
  }

  const presetRows: readonly ChromePresetRow[] = presets.map((preset) => ({
    id: preset.id,
    kind: preset.kind,
    name: preset.name,
    detail: detailOf(preset),
    savedAt: preset.updatedAt.slice(0, 16).replace("T", " "),
    /* ตัวอย่างเนื้อหาในชุด (รอบที่ 91) — เห็นรายการจริงก่อนกด "ใช้ชุดนี้" */
    preview: chromePresetPreview(preset.payload),
  }));

  /* ข้อมูลย้อนกลับของแต่ละส่วน (มี/ไม่มี + ย้อนจากชุดไหนเมื่อไร) — แสดงเป็นข้อความจากค่ากลาง */
  const undoLabelFor = async (kind: "navbar" | "footer" | "mourning"): Promise<string | null> => {
    const undo = await readChromeDraftUndo(kind);
    if (undo === null) return null;
    return fillTemplate(strings.chromePresetUndoAvailable, {
      name: undo.presetName ?? strings.chromePresetTitle,
      time: undo.replacedAt.slice(0, 16).replace("T", " "),
    });
  };

  const [undoNavbar, undoFooter, undoNotice] = await Promise.all([
    undoLabelFor("navbar"),
    undoLabelFor("footer"),
    undoLabelFor("mourning"),
  ]);

  const presetStrings: ChromePresetStrings = {
    chromePresetSaveTitle: strings.chromePresetSaveTitle,
    chromePresetSaveHint: strings.chromePresetSaveHint,
    chromePresetNameLabel: strings.chromePresetNameLabel,
    chromePresetNamePlaceholder: strings.chromePresetNamePlaceholder,
    chromePresetSourceLabel: strings.chromePresetSourceLabel,
    chromePresetSourceDraft: strings.chromePresetSourceDraft,
    chromePresetSourcePublished: strings.chromePresetSourcePublished,
    chromePresetSave: strings.chromePresetSave,
    chromePresetSaved: strings.chromePresetSaved,
    chromePresetOverwritten: strings.chromePresetOverwritten,
    chromePresetEmpty: strings.chromePresetEmpty,
    chromePresetListTitle: strings.chromePresetListTitle,
    chromePresetApply: strings.chromePresetApply,
    chromePresetApplied: strings.chromePresetApplied,
    chromePresetApplyHint: strings.chromePresetApplyHint,
    chromePresetDelete: strings.chromePresetDelete,
    chromePresetDeleted: strings.chromePresetDeleted,
    chromePresetSavedAt: strings.chromePresetSavedAt,
    chromePresetTooMany: strings.chromePresetTooMany,
    chromePresetBadName: strings.chromePresetBadName,
    chromePresetSavedFromDefault: strings.chromePresetSavedFromDefault,
    chromePresetInvalid: strings.chromePresetInvalid,
    chromePresetNotFound: strings.chromePresetNotFound,
    chromePresetDbMissing: strings.chromePresetDbMissing,
    chromePresetUndo: strings.chromePresetUndo,
    chromePresetUndoAvailable: strings.chromePresetUndoAvailable,
    chromePresetUndoHint: strings.chromePresetUndoHint,
    chromePresetUndoDone: strings.chromePresetUndoDone,
    chromePresetUndoMissing: strings.chromePresetUndoMissing,
    chromePresetPreview: strings.chromePresetPreview,
    chromePresetPreviewEmpty: strings.chromePresetPreviewEmpty,
    chromePresetIoTitle: strings.chromePresetIoTitle,
    chromePresetIoHint: strings.chromePresetIoHint,
    chromePresetExport: strings.chromePresetExport,
    chromePresetImportLabel: strings.chromePresetImportLabel,
    chromePresetImport: strings.chromePresetImport,
    chromePresetImported: strings.chromePresetImported,
    chromePresetImportBadJson: strings.chromePresetImportBadJson,
    chromePresetImportBadFormat: strings.chromePresetImportBadFormat,
    chromePresetImportEmpty: strings.chromePresetImportEmpty,
    chromePresetImportTooMany: strings.chromePresetImportTooMany,
  };

  /*
    คลังภาพสำหรับช่องภาพของ "ส่วนกลาง" (รอบที่ 98) — ต่อ context เดียวกับตัวสร้างหน้าเว็บ
    ⚠️ ส่งให้เฉพาะผู้มีสิทธิ์ media — คนอื่นยังอัปโหลด/วางพาธเองได้เหมือนเดิม
  */
  const imageLibrary: readonly ImageLibraryItem[] = can(user.role, "media")
    ? (await listMedia(48)).map((item) => ({
        id: item.id,
        filename: item.filename,
        altTh: item.altTh,
        altEn: item.altEn,
      }))
    : [];

  return (
    <ImageLibraryProvider items={imageLibrary}>
      <main className="mx-auto flex max-w-[1800px] flex-col gap-4 px-4 py-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-fg text-lg font-semibold">{strings.chromeTitle}</h1>
          <p className="text-fg-muted text-xs">{strings.chromeIntro}</p>
        </header>

      {/* ส่งออก/นำเข้าคลังชุดทั้งก้อน (รอบที่ 91) — แสดงครั้งเดียว ไม่ใช่ต่อส่วน */}
      <ChromePresetIoPanel strings={presetStrings} maxImport={MAX_CHROME_PRESET_IMPORT} />

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

      {/*
        ── พรีเซ็ตของส่วนกลาง (W3b) ──────────────────────────────────────────────
        แผงนี้ทำงานกับ "สามฉาก" ที่ผู้ใช้ขอไว้ (รอบที่ 58):
          ของเก่า = ฉบับเผยแพร่ (เก็บเป็นชุดได้) · ของใหม่ = ฉบับร่าง (ถูกเขียนทับเมื่อ "ใช้ชุดนี้")
          พรีเซ็ต = คลังชุดในตาราง chrome_preset
        ⚠️ "ใช้ชุดนี้" ไม่แตะฉบับเผยแพร่ ⇒ ต้องกด "ใช้กับเว็บจริงเลย" ด้านบนก่อน
      */}
      <section className="border-line bg-surface flex flex-col gap-3 rounded-2xl border p-4">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-fg text-sm font-semibold">{strings.chromePresetTitle}</h2>
          <p className="text-fg-muted text-xs">{strings.chromePresetHint}</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <section className="flex flex-col gap-2">
            <p className="text-fg text-xs font-bold">{strings.chromePartNavbar}</p>
            <ChromePresetPanel
              kind="navbar"
              rows={presetRows.filter((row) => row.kind === "navbar")}
              strings={presetStrings}
              maxPerKind={MAX_CHROME_PRESETS_PER_KIND}
              undoLabel={undoNavbar}
            />
          </section>

          <section className="flex flex-col gap-2">
            <p className="text-fg text-xs font-bold">{strings.chromePartFooter}</p>
            <ChromePresetPanel
              kind="footer"
              rows={presetRows.filter((row) => row.kind === "footer")}
              strings={presetStrings}
              maxPerKind={MAX_CHROME_PRESETS_PER_KIND}
              undoLabel={undoFooter}
            />
          </section>

          <section className="flex flex-col gap-2">
            <p className="text-fg text-xs font-bold">{strings.chromePartNotice}</p>
            <ChromePresetPanel
              kind="mourning"
              rows={presetRows.filter((row) => row.kind === "mourning")}
              strings={presetStrings}
              maxPerKind={MAX_CHROME_PRESETS_PER_KIND}
              undoLabel={undoNotice}
            />
          </section>
        </div>
      </section>
      </main>
    </ImageLibraryProvider>
  );
}
