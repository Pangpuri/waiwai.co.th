/**
 * Dictionary area: admin — the "personal data retention" card (X2b)
 *
 * Split out of admin.ts, which is close to the 32 KB cap (check:i18n rule: "split areas, do not raise the cap").
 */
export const adminRetention = {
  retentionTitle: "Personal data retention",
  retentionHint:
    "Expired data is deleted automatically (at most once every 24 hours, and only when an admin visits the back office). To delete on a fixed schedule, add a cron job that runs `npm run db:purge` on the server.",
  retentionColData: "Data type",
  retentionColKeep: "Kept for",
  retentionColCutoff: "Deletes rows older than",
  retentionColDue: "Expired rows",
  retentionNeverRun: "Automatic deletion has not run yet — it will run the next time you sign in.",
  retentionLastRun: "Last deletion {time}",
  retentionNextRun: "Next run around {time}",
  retentionDueNow: "Due now",
  retentionDueTotal: "{count} expired rows",
  retentionNothingDue: "Nothing has expired yet",
  /* Content trash (round 174) — not personal data, but purged in the same run */
  retentionContentTrashNone: "Content trash (products/recipes/news): nothing due",
  retentionContentTrashDue: "Content trash (products/recipes/news): {count} item(s) will be deleted permanently",
  retentionPurgeNow: "Delete expired data now",
  retentionPurgeWarning: "Permanent and irreversible — résumé files of expired applications are deleted too.",
  retentionDbMissing: "The database is not configured yet — DATABASE_URL is required before retention can run.",
  retentionLabelContact: "Contact form messages",
  retentionLabelNewsletter: "Newsletter subscribers",
  retentionLabelCareers: "Job applications + résumés",
  retentionLabelBlockRevision: "Page revision history (latest block kept)",
  retentionLabelContentRevision: "Field revision history (latest kept)",
  retentionLabelEntityRevision: "Product/recipe/news revision history",
  retentionLabelLoginAttempt: "Sign-in attempts",
  retentionLabelAuditLog: "Content change log",
  retentionLabelAdminSession: "Back-office sessions",
  auditRetentionPurge: "Retention deletion",
};
