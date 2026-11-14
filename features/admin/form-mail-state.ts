export type FormMailRoutingState = {
  readonly status: "idle" | "saved" | "invalid" | "failed";
};

export const INITIAL_FORM_MAIL_ROUTING_STATE: FormMailRoutingState = { status: "idle" };
