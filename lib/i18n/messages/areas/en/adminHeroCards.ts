/**
 * Dictionary area: admin — feedback copy for the "Slides" screen (round 188 · 194 · cleanup 290)
 *
 * Split out of the `adminHero` area per the check:i18n rule.
 *
 * ⚠️ Cleanup history (do not assume a "campaign card" still exists from the file name)
 *    · Round 194 removed the 1:1 slide-card keys (7 keys)
 *    · Round 205 removed the whole "campaign / card-on-slide" module (tables dropped)
 *    · Round 290 removed the remaining unreferenced campaign-card keys (18 keys per locale) — guarded by check:i18n check 5
 */
export const adminHeroCards = {
  feedbackSlideAdded: "Slide added",
  feedbackSlideRemoved: "Slide moved to trash",
  feedbackSlideMoved: "Slide order updated",
  feedbackSlideReordered: "New slide order saved",
  feedbackSlideSaved: "Slide saved",
  feedbackEffectSaved: "Effect and speed saved",
  feedbackSlideRestored: "Slide restored",
  feedbackSlidePurged: "Slide deleted forever",
  feedbackErrorInvalid: "Could not save — missing or invalid data (see the fields below)",
  feedbackErrorSaveFailed: "Could not save — the database is unavailable, please try again",
  /* Round 195: name the field that failed (the generic message made it look like nothing was missing) */
};
