import { getInspectableUser } from "@/lib/user-dashboard/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type Row = { customer_code: string | null; customer_name: string | null };

export async function GET(_request: Request, context: RouteContext<"/api/admin/user-dashboard/[userId]/customers">) {
  const { userId } = await context.params;
  const { user, response } = await getInspectableUser(userId);
  if (response) return response;
  if (!user) return Response.json({ error: "Inspectable user not found" }, { status: 404 });

  const { data, error } = await getSupabaseAdmin()
    .from("credit_customer_list")
    .select("customer_code,customer_name")
    .eq("salesperson", user.salespersonName)
    .order("customer_code", { ascending: true });

  if (error) {
    console.error("Failed to fetch inspected customers", error);
    return Response.json({ error: "Failed to fetch customers" }, { status: 500 });
  }

  const customers = ((data as Row[]) ?? []).filter((row): row is { customer_code: string; customer_name: string } => Boolean(row.customer_code) && Boolean(row.customer_name));
  return Response.json({ user, customers });
}
