import "server-only";

import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type AppUserRoleRow = {
  id: string | number | null;
  role: string | null;
};

export type AppUserRoleCheck = {
  isAuthenticated: boolean;
  isAdmin: boolean;
  role: string | null;
  error?: string;
};

export async function getCurrentAppUserRole(): Promise<AppUserRoleCheck> {
  const session = await getServerSession(authOptions);
  const sessionUserId = session?.user?.id?.trim();

  if (!sessionUserId) {
    return {
      isAuthenticated: false,
      isAdmin: false,
      role: null,
      error: "Missing authenticated session user id.",
    };
  }

  const { data, error } = await getSupabaseAdmin()
    .from("app_users")
    .select("id,role")
    .eq("id", sessionUserId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("Failed to verify app user role", {
      sessionUserId,
      error,
    });

    return {
      isAuthenticated: true,
      isAdmin: false,
      role: null,
      error: "Failed to verify app user role.",
    };
  }

  const row = data as AppUserRoleRow | null;
  const role = row?.role?.trim().toLowerCase() ?? null;
  const appUserId = row?.id == null ? null : String(row.id);

  if (!row || appUserId !== sessionUserId) {
    console.warn(
      "Authenticated session user did not match an active app_users.id row",
      {
        sessionUserId,
        appUserId,
      },
    );
  }

  return {
    isAuthenticated: true,
    isAdmin: role === "admin",
    role,
  };
}

export async function getAdminSession() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return {
      response: Response.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const roleCheck = await getCurrentAppUserRole();

  if (roleCheck.error) {
    return {
      response: Response.json({ error: roleCheck.error }, { status: 500 }),
    };
  }

  if (!roleCheck.isAdmin) {
    return { response: Response.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { session };
}
