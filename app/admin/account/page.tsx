import { AccountSettings } from "@/features/admin/ui/account-settings";
import { requireAdminUser } from "@/lib/auth/dal";
import { MIN_ADMIN_PASSWORD_LENGTH } from "@/lib/auth/users-repository";
import { ENV_ADMIN_ID } from "@/lib/auth/user-store";
import { getMessagesFor } from "@/lib/i18n/dictionaries";

export default async function AdminAccountPage() {
  const user = await requireAdminUser("account");
  const messages = await getMessagesFor("th");
  const strings = messages.admin;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-fg text-2xl font-bold">{strings.accountTitle}</h1>
        <p className="text-fg-muted text-sm">{strings.accountHint}</p>
      </header>

      {user.id === ENV_ADMIN_ID ? (
        <section className="border-line bg-surface rounded-2xl border p-5 sm:p-6">
          <p className="text-fg text-sm">{strings.accountCurrentEmail}: {user.email}</p>
          <p className="text-fg-muted mt-2 text-sm">{strings.accountEnvNotice}</p>
        </section>
      ) : (
        <AccountSettings
          currentEmail={user.email}
          minPasswordLength={MIN_ADMIN_PASSWORD_LENGTH}
          strings={strings}
        />
      )}
    </main>
  );
}
