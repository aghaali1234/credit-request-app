import { getAdminSession } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type AppUserRow = {
  id: string | number | null;
  username: string | null;
  salesperson_name: string | null;
};


async function assertAdminSession() {
  const { response } = await getAdminSession();
  return response ?? null;
}


export async function GET() {
  const adminError = await assertAdminSession();

  if (adminError) {
    return adminError;
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("app_users")
    .select("id,username,salesperson_name")
    .eq("is_active", true)
    .eq("role", "salesperson")
    .order("salesperson_name", { ascending: true });

  if (error) {
    console.error("Failed to fetch app users for user settings", error);
    return Response.json(
      { error: "Failed to fetch app users" },
      { status: 500 },
    );
  }

  const users = ((data as AppUserRow[]) ?? [])
    .map((row) => {
      const salespersonName = row.salesperson_name?.trim() || row.username?.trim();

      if (!row.id || !salespersonName) {
        return null;
      }

      return {
        id: String(row.id),
        username: row.username,
        salespersonName,
      };
    })
    .filter((user): user is NonNullable<typeof user> => user !== null);

  return Response.json({ users, salespeople: users.map((user) => user.salespersonName) });
}

