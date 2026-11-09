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
  startFromTemplateTitle: "Start the content from a template",
  startFromTemplate: "Use this template to start",
  startFromTemplateHint:
    "This page has no draft yet — start the content from the template prepared in the system, then edit it freely. The template may differ from the live page.",
  startFromTemplateSourceNote:
    "To go back to content that was published before, use “Publish history” below.",
  templateMissingBody: "This page has no starting template — its content comes from the import system or the screen dedicated to that section.",
  /* Round 260: pages built by an importer have no "start from template" button on purpose */
  importedContentTitle: "This page uses imported content (no starting template)",
  importedContentBody:
    "This page's content comes from the reviewed content set, so there is no start-from-template button. You can still edit each block's text and images from the preview on the right. If you need to rebuild the whole page, please contact the system administrator.",
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
