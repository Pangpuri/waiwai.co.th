/**
 * Dictionary area: admin — slides cards & campaigns (round 188)
 *
 * Split out of the `adminHero` area per the check:i18n rule.
 * ⚠️ Card copy (title/body) is entered by the admin — we do not translate content for them.
 */
export const adminHeroCards = {
  heroCardSectionTitle: "Cards on slides (campaigns)",
  heroCardSectionHint: "A card is overlaid on its slide image · set a time window to publish/retire it automatically",
  heroCardAdd: "Add card",
  heroCardEmpty: "No cards on this slide yet",
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
  heroCardMax: "Up to {max} cards per slide",
  heroCardTitleRequired: "Thai title is required (a card without text is not saved)",
  heroCardSaveFailed: "Could not save — check the Thai title and that the end time is after the start time",
  heroCardEnglishOptional: "English fields are optional — fill them in yourself (Thai is used when empty)",
};
