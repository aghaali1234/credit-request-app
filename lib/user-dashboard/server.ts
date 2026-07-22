import "server-only";

import { getAdminSession } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type InspectUser = {
  id: string;
  username: string | null;
  email: string | null;
  salespersonName: string;
};

type AppUserRow = {
  user_id: string | number | null;
  username: string | null;
  email?: string | null;
  salesperson_name: string | null;
};

export async function getInspectableUser(userId: string): Promise<{ user?: InspectUser; response?: Response }> {
  const { response } = await getAdminSession();

  if (response) {
    return { response };
  }

  const { data, error } = await getSupabaseAdmin()
    .from("app_users")
    .select("user_id,username,email,salesperson_name")
    .eq("user_id", userId)
    .eq("is_active", true)
    .eq("role", "salesperson")
    .maybeSingle();

  if (error) {
    console.error("Failed to resolve inspected app user", error);
    return { response: Response.json({ error: "Failed to resolve inspected user" }, { status: 500 }) };
  }

  const row = data as AppUserRow | null;
  const salespersonName = row?.salesperson_name?.trim();

  if (!row?.user_id || !salespersonName) {
    return { response: Response.json({ error: "Inspectable user not found" }, { status: 404 }) };
  }

  return {
    user: {
      id: String(row.user_id),
      username: row.username,
      email: row.email ?? null,
      salespersonName,
    },
  };
}

export function toNumber(value: number | string | null): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}
