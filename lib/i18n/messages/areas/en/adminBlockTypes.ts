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
  /* Job board (round 88) */
  blockJobItems: "Positions ({n}/{max})",
  blockAddJob: "Add position",
  blockRemoveJob: "Remove position",
  blockJobNumber: "Position {n}",
  blockJobTitle: "Job title",
  blockJobDepartment: "Department (used for grouping)",
  blockJobOpenings: "Openings (0 = not specified)",
  blockJobQualifications: "Qualifications",
  blockJobExperience: "Experience (optional)",
  blockJobGrouping: "Group by department",
  /* Management roster (round 88) */
  blockRosterMembers: "People ({n}/{max})",
  blockAddMember: "Add person",
  blockRemoveMember: "Remove person",
  blockMemberNumber: "Person {n}",
  blockMemberName: "Full name",
  blockMemberRole: "Role",
  blockRosterColumns: "Columns",
  blockMemberPhotoHint: "Personal photo (optional)",
  /* Page layout (X1.8) */
  layoutLabel: "Page layout",
  layoutHint:
    "Full width = blocks stacked as usual · Sidebar = a table of contents built automatically from page headings · Landing = first block as configured, the rest in a narrow centred column",
  /* Per-language layout (round 92) */
  layoutLabelEn: "English page layout (unset = same as Thai)",
};
