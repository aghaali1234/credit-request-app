import { getAdminSession } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type AppUserRow = {
  user_id: string | number | null;
  username: string | null;
  email?: string | null;
  salesperson_name: string | null;
};

type PasswordUpdateBody = {
  salesperson?: unknown;
  password?: unknown;
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
    .select("user_id,username,email,salesperson_name")
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

      if (!row.user_id || !salespersonName) {
        return null;
      }

      return {
        id: String(row.user_id),
        username: row.username,
        email: row.email ?? null,
        salespersonName,
      };
    })
    .filter((user): user is NonNullable<typeof user> => user !== null);

  return Response.json({ users, salespeople: users.map((user) => user.salespersonName) });
}

export async function PATCH(request: Request) {
  const adminError = await assertAdminSession();

  if (adminError) {
    return adminError;
  }

  const body = (await request.json()) as PasswordUpdateBody;
  const salesperson =
    typeof body.salesperson === "string" ? body.salesperson.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!salesperson) {
    return Response.json({ error: "Missing salesperson" }, { status: 400 });
  }

  if (password.length < 6) {
    return Response.json(
      { error: "Password must be at least 6 characters." },
      { status: 400 },
    );
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.rpc("update_app_user_password", {
    p_salesperson_name: salesperson,
    p_new_password: password,
  });

  if (error) {
    console.error("update_app_user_password RPC failed", error);
    return Response.json(
      {
        error:
          "Failed to update password. Please make sure the update_app_user_password Supabase function exists.",
      },
      { status: 500 },
    );
  }

  if (!data) {
    return Response.json(
      { error: "No app user found for this salesperson." },
      { status: 404 },
    );
  }

  return Response.json({ ok: true, salesperson });
}
