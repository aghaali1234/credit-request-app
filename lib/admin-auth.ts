import "server-only";

import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type AppUserRoleRow = {
  role: string | null;
};

export async function getAdminSession() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !session.user.salespersonName) {
    return { response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data, error } = await getSupabaseAdmin()
    .from("app_users")
    .select("role")
    .eq("user_id", session.user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("Failed to verify admin role", error);
    return { response: Response.json({ error: "Failed to verify admin role" }, { status: 500 }) };
  }

  const role = (data as AppUserRoleRow | null)?.role?.trim().toLowerCase();

  if (role !== "admin") {
    return { response: Response.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { session };
}
