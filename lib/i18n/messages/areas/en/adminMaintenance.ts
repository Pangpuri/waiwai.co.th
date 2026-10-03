/**
 * Dictionary area: maintenance-mode card on the admin overview (X2.5) — English
 * ต้องมีคีย์ชุดเดียวกับ areas/th/adminMaintenance.ts เป๊ะ (ถ้าขาด → typecheck แดง)
 *
 * The switch lives in an env var (`MAINTENANCE_MODE`), not a button — see lib/maintenance/plan.ts.
 * This card reports the state and how to change it.
 */
export const adminMaintenance = {
  maintenanceTitle: "Maintenance mode",
  maintenanceHint:
    "Takes the public site offline for visitors. Used while migrating servers or repairing the database — signed-in admins are unaffected.",
  maintenanceStateOn: "On — visitors see the maintenance notice (status 503)",
  maintenanceStateOff: "Off — the site is serving normally",
  maintenanceStateUnclear:
    "The value is unclear, so it is treated as \"off\" (the site stays up). Valid values: 1 / true / on / yes",
  maintenanceHowTo: "Turn on: npm run maintenance:on · turn off: npm run maintenance:off (then restart the server)",
  maintenanceBypass: "Bypass: signed-in admins · /admin · draft preview pages · image files",
  maintenanceEnvNote: "This mode lives in an environment variable, not the database — no rebuild needed",
};
