import "server-only";

import { env } from "~/env";
import { getSession } from "./server";

const adminEmails = () =>
  new Set(
    (env.BILLION_ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );

export async function getNotificationAdminAccess() {
  const session = await getSession();
  const configured = Boolean(env.BILLION_ADMIN_EMAILS);
  const authorized =
    Boolean(session) &&
    adminEmails().has(session?.user.email.trim().toLowerCase() ?? "");

  return { session, configured, authorized };
}

export async function requireNotificationAdmin() {
  const access = await getNotificationAdminAccess();
  if (!access.session) {
    throw new Error("Sign in to manage notifications.");
  }
  if (!access.configured) {
    throw new Error("The notification admin allowlist is not configured.");
  }
  if (!access.authorized) {
    throw new Error("Your account is not authorized to manage notifications.");
  }
  return access.session.user;
}
