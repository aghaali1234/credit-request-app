import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { isAdminUser } from "@/lib/is-admin-user";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type CreditRowsSalesperson = {
  salesperson: string | null;
};

type PasswordUpdateBody = {
  salesperson?: unknown;
  password?: unknown;
};

async function assertAdminSession() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.salespersonName) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminUser(session.user.name)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}

export async function GET() {
  const adminError = await assertAdminSession();

  if (adminError) {
    return adminError;
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("credit_rows")
    .select("salesperson")
    .not("salesperson", "is", null)
    .order("salesperson", { ascending: true })
    .limit(20000);

  if (error) {
    console.error("Failed to fetch user settings salespeople", error);
    return Response.json(
      { error: "Failed to fetch salespeople" },
      { status: 500 },
    );
  }

  const salespeople = Array.from(
    new Set(
      ((data as CreditRowsSalesperson[]) ?? [])
        .map((row) => row.salesperson?.trim())
        .filter((salesperson): salesperson is string => Boolean(salesperson)),
    ),
  ).sort((first, second) => first.localeCompare(second));

  return Response.json({ salespeople });
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
