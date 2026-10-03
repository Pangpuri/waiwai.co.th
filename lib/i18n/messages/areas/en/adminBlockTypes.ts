/**
 * Admin area: labels for the editor panel of the four new block types (round 86).
 *
 * Split into its own area because the `admin` area already hit the 32KB cap
 * (rule: split sub-areas instead of raising the cap).
 */
export const adminBlockTypes = {
  /* Table */
  blockTableColumns: "Columns ({n}/{max})",
  blockAddColumn: "Add column",
  blockRemoveColumn: "Remove column",
  blockFirstColumnHeader: "First column is a row header",
  blockTableRows: "Rows ({n}/{max})",
  blockAddRow: "Add row",
  blockRemoveRow: "Remove row",
  /* Gallery */
  blockGalleryItems: "Images ({n}/{max})",
  blockAddImage: "Add image",
  blockRemoveImage: "Remove image",
  blockItemNumber: "Image {n}",
  blockGalleryColumns: "Columns",
  /* Form */
  blockFormKind: "Form type",
  blockFormContact: "Contact form",
  blockFormNewsletter: "Newsletter form",
  blockFormCareers: "Job application form",
  blockFormHint: "This uses the site's real form system — stored in the database, bot trap, PDPA consent.",
  /* Map */
  blockMapLink: "Map link (https://…)",
  blockMapLinkText: "Button label (optional)",
};
