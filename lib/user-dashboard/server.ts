import "server-only";

import { getAdminSession } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type InspectUser = {
  id: string;
  username: string | null;
  salespersonName: string;
};

type AppUserRow = {
  id: string | number | null;
  username: string | null;
  salesperson_name: string | null;
};

export async function getInspectableUser(userId: string): Promise<{ user?: InspectUser; response?: Response }> {
  const { response } = await getAdminSession();

  if (response) {
    return { response };
  }

  const { data, error } = await getSupabaseAdmin()
    .from("app_users")
    .select("id,username,salesperson_name")
    .eq("id", userId)
    .eq("is_active", true)
    .eq("role", "salesperson")
    .maybeSingle();

  if (error) {
    console.error("Failed to resolve inspected app user", error);
    return { response: Response.json({ error: "Failed to resolve inspected user" }, { status: 500 }) };
  }

  const row = data as AppUserRow | null;
  const salespersonName = row?.salesperson_name?.trim();

  if (!row?.id || !salespersonName) {
    return { response: Response.json({ error: "Inspectable user not found" }, { status: 404 }) };
  }

  return {
    user: {
      id: String(row.id),
      username: row.username,
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
