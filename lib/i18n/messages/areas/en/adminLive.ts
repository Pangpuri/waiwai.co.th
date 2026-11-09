/**
 * Dictionary area: admin — "what pressing Publish does" (round 240 · formerly the `live*` group)
 *
 * **Owner's decision, 2026-10-09:** remove the "Make it live" switch (the second step confused
 * people being briefed). Home page: Publish = save + **go live immediately**.
 * Other pages: Publish = save only (not live yet).
 * ⇒ These strings have one job: state exactly what will happen / has happened (honest UI).
 *
 * ⚠️ Kept out of `admin.ts` because that area hit the 32KB cap (check:i18n: split, don't raise).
 * ⚠️ Never promise "now live" for a page that is not live — the two key pairs must match
 *    `publishGoesLive()` in `lib/blocks/live-scope.ts`.
 */
export const adminLive = {
  /* After a successful publish — the screen picks by the real state read from the DB (never guesses) */
  publishedLive: "Published — now live (visitors are seeing this version).",
  publishedSavedOnly: "Saved — this page is not live yet (the team will switch it on when the content is ready).",
  /* Hint under the Publish button — says up front what pressing it will do */
  publishHintLive: "Pressing “Publish” saves and goes live immediately (preview equals what visitors see).",
  publishHintSavedOnly: "This page is not live yet — pressing “Publish” saves it for later.",

  /*
    ── Revert to the site’s original design (round 246 · real case: the owner asked how to get back) ──
    A **one-way exit**, not a switch: it only turns blocks off · to use blocks again, press “Publish”.
    ⇒ The copy must always say “nothing is lost” and “how to turn it back on”.
  */
  layoutRevertTitle: "Restore this page to its default",
  layoutRevertHint:
    "This page is currently using a custom layout on the live site — use the button below to go back to the site’s original design · everything you built stays saved, but it will not be shown on the site · to use it again, press “Publish”",
  layoutRevertConfirm: "Confirm: restore this page to its default — go back to the site’s original design (everything you built stays saved)",
  layoutRevertButton: "Restore this page to its default",
  layoutRevertNeedsConfirm: "Nothing changed — tick the confirmation first",
  layoutRevertNotLive: "This page already uses the original design — nothing changed",
  layoutRevertDone: "This page has been restored to its default — back to the site’s original design · everything you built is still saved · press “Publish” to use it again",
  /* Audit-log trace (shown in history / my activity) */
  auditLayoutRevert: "Restored the page to its default",
};
