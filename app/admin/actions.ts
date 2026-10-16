"use server";

import { redirect } from "next/navigation";

import {
  authenticateAdmin,
  clearAdminCookie,
  createAdminSession,
  ensureAdminUser,
  readAdminSession,
  revokeAdminSession,
  setAdminCookie,
} from "@/lib/admin-auth";
import { POLICY_ADMIN_LOGIN, clientSubject, consume } from "@/lib/rate-limit";
import { adminLoginSchema, fieldErrors } from "@/lib/validation";

export type LoginState = { fields: Record<string, string>; formError: string | null };

/**
 * The only way into the hiring team's side of the application.
 *
 * Failures are deliberately indistinguishable: a wrong password, an address with no account, and an
 * address that is merely close to a real one all produce the same sentence, so the form cannot be
 * used to enumerate administrators.
 */
export async function adminLogin(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const limit = await consume(POLICY_ADMIN_LOGIN, await clientSubject());
  if (!limit.allowed) {
    const minutes = Math.ceil(limit.retryAfterSeconds / 60);
    return {
      fields: {},
      formError: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    };
  }

  const parsed = adminLoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { fields: fieldErrors(parsed.error), formError: null };
  }

  // Runs the account into existence if it is missing and re-hashes it when the environment value
  // has changed, so rotating the password is a config edit rather than a support request.
  await ensureAdminUser();

  const adminId = await authenticateAdmin(parsed.data.email, parsed.data.password);
  if (!adminId) {
    return { fields: {}, formError: "Those credentials do not match an administrator account." };
  }

  const { token } = await createAdminSession(adminId);
  await setAdminCookie(token);
  redirect("/admin");
}

export async function adminLogout(): Promise<void> {
  const session = await readAdminSession();
  if (session) await revokeAdminSession(session.sessionId);
  await clearAdminCookie();
  redirect("/admin/login");
}
