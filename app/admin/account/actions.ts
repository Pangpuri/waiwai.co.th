"use server";

import { revalidatePath } from "next/cache";

import type { AccountActionState } from "@/features/admin/account-state";
import { currentSessionId, requireAdminUser } from "@/lib/auth/dal";
import {
  changeOwnAdminEmail,
  changeOwnPassword,
  isUsableAdminEmail,
  isUsableAdminPassword,
  normalizeAdminEmail,
} from "@/lib/auth/users-repository";

function readField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function revalidateAccount(): void {
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/account");
}

export async function changeOwnEmailAction(
  _previous: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const user = await requireAdminUser("account");
  const nextEmail = readField(formData, "nextEmail");
  const confirmEmail = readField(formData, "confirmEmail");
  const currentPassword = readField(formData, "currentPassword");

  if (nextEmail === "" || confirmEmail === "" || currentPassword === "") {
    return { code: "required" };
  }
  if (!isUsableAdminEmail(nextEmail)) return { code: "bad-email" };
  if (normalizeAdminEmail(nextEmail) !== normalizeAdminEmail(confirmEmail)) return { code: "email-mismatch" };

  const result = await changeOwnAdminEmail({
    id: user.id,
    currentPassword,
    nextEmail,
    actor: user.email,
  });
  if (!result.ok) {
    switch (result.reason) {
      case "bad-email":
        return { code: "bad-email" };
      case "duplicate-email":
        return { code: "duplicate-email" };
      case "same-email":
        return { code: "same-email" };
      case "wrong-password":
        return { code: "wrong-password" };
      case "no-database":
      case "env-account":
      case "not-found":
        return { code: "unavailable" };
      default:
        return { code: "failed" };
    }
  }

  revalidateAccount();
  return { code: "email-updated" };
}

export async function changeOwnPasswordAction(
  _previous: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const user = await requireAdminUser("account");
  const currentPassword = readField(formData, "currentPassword");
  const nextPassword = readField(formData, "nextPassword");
  const confirmPassword = readField(formData, "confirmPassword");

  if (currentPassword === "" || nextPassword === "" || confirmPassword === "") {
    return { code: "required" };
  }
  if (!isUsableAdminPassword(nextPassword)) return { code: "bad-password" };
  if (nextPassword !== confirmPassword) return { code: "password-mismatch" };

  const sid = await currentSessionId();
  if (sid === null) return { code: "unavailable" };

  const result = await changeOwnPassword({
    id: user.id,
    currentPassword,
    nextPassword,
    actor: user.email,
    exceptSid: sid,
  });
  if (!result.ok) {
    switch (result.reason) {
      case "bad-password":
        return { code: "bad-password" };
      case "wrong-password":
        return { code: "wrong-password" };
      case "no-database":
      case "env-account":
      case "not-found":
        return { code: "unavailable" };
      default:
        return { code: "failed" };
    }
  }

  revalidateAccount();
  return { code: "password-updated" };
}
