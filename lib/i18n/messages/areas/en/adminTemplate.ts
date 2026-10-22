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
  startFromTemplateTitle: "Start from the built-in template",
  startFromTemplate: "Use the built-in template",
  startFromTemplateReplace: "Use the built-in template (replaces the draft)",
  startFromTemplateOverwrite: "Tick to confirm replacing the current draft",
  startFromTemplateNeedsConfirm: "Not applied — you did not tick the confirmation. Your draft is unchanged",
  startFromTemplateHint:
    "Builds the content from this page's “template in code” — it is not a copy of the published page, so it may differ from the live site. Edit freely afterwards; your chosen layout is kept.",
  startFromTemplateSourceNote:
    "To go back to content that was published before, use “Publish history” below — this button creates a fresh set from the template; it does not restore the old one.",
  templateMissingBody: "This page has no block template yet — keep editing it with the field-based content screen for now.",
  /* Round 260: pages built by an importer have no "start from template" button on purpose */
  importedContentTitle: "This page is built by an importer (no starting template)",
  importedContentBody:
    "This page's content comes from the reviewed content set, so there is no “start from template” button — that button would overwrite every part that has been reviewed and edited. You can still edit each block's text and images from the preview on the right. To rebuild the whole page, run this page's import script locally, then publish here.",
  templateMissingList:
    "Pages with a block template today: Home · Contact · Certifications · Executives · Product category pages (About is built by an importer and is not built from a template)",
  templateCoverageTitle: "Not covered by this template yet",
  templateCoverageNote:
    "Once published, the page shows only blocks — the parts listed below disappear from it. Add blocks first if you need them.",
  templateCoverageNone: "This template covers every part of this page",
  templateCoverageJumpHint: "Click a part to go where it is edited (the add-block panel, or the screen that owns it)",
  coverageGallery: "Curated image gallery / real photos",
  coverageLightbox: "Full-screen image viewer",
  coverageForm: "Forms (contact / job application)",
  coverageMap: "Location map",
  coverageWhereToBuy: "\"Where to buy\" section (edit on the home content screen)",
  coverageRosterText: "Per-person names and titles (currently inside the image)",
};
