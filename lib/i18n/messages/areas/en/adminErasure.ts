/**
 * Dictionary area: the "delete everything for this email" tool in the inbox (PDPA · round 77)
 * ต้องมีคีย์ชุดเดียวกับ areas/th/adminErasure.ts เป๊ะ (ถ้าขาด → typecheck แดง)
 *
 * ⚠️ Wording must match what the system actually does — form data + résumé files are deleted,
 *    while security traces and staff audit records are **kept** under their own retention policy.
 */
export const adminErasure = {
  eraseTitle: "Rights request: delete everything for this email",
  eraseHint: "Deletes every form submission from this person (contact · newsletter · careers) plus their résumé files, in one step",
  eraseProcedureTitle: "Steps before pressing delete (do not skip)",
  eraseProcedure1:
    "1. Verify the requester's identity first — reply to the email address they used before and ask them to confirm details they sent us (phone number or subject)",
  eraseProcedure2: "2. Check the list below matches what the requester told you (if not, stop and ask them again)",
  eraseProcedure3: "3. Type the email twice so the two match, then delete — the system records what was deleted and how much (never the full email address)",
  eraseEmailLabel: "Requester email",
  eraseEmailPlaceholder: "someone@example.com",
  eraseCheck: "Check what will be deleted",
  erasePreviewTitle: "Found data for this email",
  eraseWillDelete: "Will delete {total} record(s) — contact {contact} · newsletter {newsletter} · careers {careers} · attachments {attachments}",
  eraseWillKeep:
    "Will keep: {attempts} security (sign-in) record(s) and staff audit records — under the retention policy published on /privacy",
  eraseNothingFound: "No data found for this email (a small typo finds nothing — check with the requester again)",
  eraseConfirmLabel: "Type the email again to confirm",
  eraseConfirmPlaceholder: "someone@example.com",
  eraseVerifiedLabel: "I have verified the requester's identity using the steps above",
  eraseSubmit: "Permanently delete this email's data",
  eraseInvalidEmail: "That email is not valid (needs @ and a domain with a dot)",
  eraseMismatch: "The email you typed again does not match the first field",
  eraseNotVerified: "You must confirm the requester's identity first (tick the box)",
  eraseDbMissing: "No database configured — this tool needs DATABASE_URL",
  auditEraseSubject: "Deletion under a rights request",
};
