/**
 * Dictionary area: admin — block templates and their coverage (S2)
 *
 * Split out per the check:i18n rule ("admin area hit the cap ⇒ split a sub-area, do not raise the cap").
 */
export const adminTemplate = {
  previewPartsBarTitle: "Viewing: {label}",
  previewPartsFull: "Full page preview (header nav · footer included)",
  previewPartsContent: "Main content only (no header nav · footer · notice)",
  previewPartsNav: "Header nav only",
  previewPartsFooter: "Footer only",
  previewPartsNotice: "Announcement notice only",
  startFromTemplate: "Start from the current content",
  startFromTemplateReplace: "Start over from the current content (replaces the draft)",
  startFromTemplateOverwrite: "Tick to confirm replacing the current draft",
  startFromTemplateNeedsConfirm: "Not applied — you did not tick the confirmation. Your draft is unchanged",
  startFromTemplateHint: "Pulls the same copy the live site uses as a starting point — then edit freely.",
  templateMissingBody: "This page has no block template yet — keep editing it with the field-based content screen for now.",
  /* Round 260: pages built by an importer have no "start from template" button on purpose */
  importedContentTitle: "This page is built by an importer (no starting template)",
  importedContentBody:
    "This page's content comes from the original site, so there is no “start from template” button — that button would overwrite every part that has been reviewed and edited. You can still edit each block's text and images from the preview on the right. To rebuild the whole page, run this page's import script locally, then publish here.",
  templateMissingList:
    "Pages with a block template today: Home · Careers · Contact · Products · Recipes · News · Certifications · Executives · Product category pages (About is imported from the original site)",
  templateCoverageTitle: "Not covered by this template yet",
  templateCoverageNote:
    "Once you turn on “use with the live site”, the page shows only blocks — the parts listed below disappear from it. Add blocks first if you need them.",
  templateCoverageNone: "This template covers every part of this page",
  coverageGallery: "Curated image gallery / real photos",
  coverageLightbox: "Full-screen image viewer",
  coverageForm: "Forms (contact / job application)",
  coverageMap: "Location map",
  coverageJobBoard: "Open positions table",
  coverageWhereToBuy: "\"Where to buy\" section (edit on the home content screen)",
  coverageSampleData: "Sample (mockup) cards",
  coverageRosterText: "Per-person names and titles (currently inside the image)",
};
