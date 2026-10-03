/**
 * Dictionary area: admin — block templates and their coverage (S2)
 *
 * Split out per the check:i18n rule ("admin area hit the cap ⇒ split a sub-area, do not raise the cap").
 */
export const adminTemplate = {
  startFromTemplate: "Start from the current content",
  startFromTemplateHint: "Pulls the same copy the live site uses as a starting point — then edit freely.",
  templateMissingBody: "This page has no block template yet — keep editing it with the field-based content screen for now.",
  templateMissingList:
    "Pages with a block template today: Home · About · Careers · Contact · Products · Recipes · News · Certifications · Executives",
  templateCoverageTitle: "Not covered by this template yet",
  templateCoverageNote:
    "Once you turn on “use with the live site”, the page shows only blocks — the parts listed below disappear from it. Add blocks first if you need them.",
  templateCoverageNone: "This template covers every part of this page",
  coverageGallery: "Curated image gallery / real photos",
  coverageLightbox: "Full-screen image viewer",
  coverageForm: "Forms (contact / job application)",
  coverageMap: "Location map",
  coverageJobBoard: "Open positions table",
  coverageSampleData: "Sample (mockup) cards",
  coverageRosterText: "Per-person names and titles (currently inside the image)",
};
