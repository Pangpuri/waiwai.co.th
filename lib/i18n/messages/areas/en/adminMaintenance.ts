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
    "Takes the public site offline for visitors. Used when the site needs to be paused temporarily — signed-in admins are unaffected.",
  maintenanceStateOn: "On — visitors see the maintenance notice",
  maintenanceStateOff: "Off — the site is serving normally",
  maintenanceStateUnclear: "The value is unclear, so it is treated as off (the site stays available)",
  maintenanceHowTo: "Please contact the system administrator to turn this mode on or off",
  maintenanceBypass: "Signed-in admins, the back office, draft previews and image files remain available",
  maintenanceEnvNote: "This is a system setting — it does not change website content",
};
