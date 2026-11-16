export type AccountActionCode =
  | null
  | "required"
  | "bad-email"
  | "email-mismatch"
  | "duplicate-email"
  | "same-email"
  | "bad-password"
  | "password-mismatch"
  | "wrong-password"
  | "email-updated"
  | "password-updated"
  | "unavailable"
  | "failed";

export type AccountActionState = { readonly code: AccountActionCode };

export const INITIAL_ACCOUNT_ACTION_STATE: AccountActionState = { code: null };
