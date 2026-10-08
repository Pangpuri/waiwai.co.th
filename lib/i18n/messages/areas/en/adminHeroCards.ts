/**
 * Dictionary area: admin — slides & campaigns (round 188 · revisited in round 194)
 *
 * Split out of the `adminHero` area per the check:i18n rule.
 * ⚠️ Card copy (title/body) is entered by the admin — we do not translate content for them.
 * ⚠️ Round 194 removed the 1:1 slide-card keys (7 unused keys) — the rest is campaign copy.
 */
export const adminHeroCards = {
  heroCardTitle: "Title",
  heroCardBody: "Body",
  heroCardCtaLabel: "Button label",
  heroCardCtaHref: "Button link (optional)",
  heroCardPosition: "Position on the image",
  heroCardPositionLeft: "Left",
  heroCardPositionCenter: "Center",
  heroCardPositionRight: "Right",
  heroCardStarts: "Show from",
  heroCardEnds: "Show until",
  heroCardWindowHint: "Leave empty for no limit · the server clock decides when it appears/disappears",
  heroCardStateAlways: "Always shown",
  heroCardStateScheduled: "Scheduled",
  heroCardStateLive: "Live now",
  heroCardStateExpired: "Expired",
  heroCardSave: "Save card",
  heroCardRemove: "Remove card",
  heroCardTitleRequired: "Thai title is required (a card without text is not saved)",
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
