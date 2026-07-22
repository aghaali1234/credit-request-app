import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { AdminDashboard } from "@/components/admin-dashboard";
import { AdminLogoutButton } from "@/components/admin-logout-button";
import { DashboardCustomers } from "@/components/dashboard-customers";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type CustomerRow = {
  customer_code: string | null;
  customer_name: string | null;
};

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.salespersonName) {
    redirect("/");
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: currentUser } = await supabaseAdmin
    .from("app_users")
    .select("role")
    .eq("user_id", session.user.id)
    .eq("is_active", true)
    .maybeSingle();
  const isAdmin =
    typeof currentUser?.role === "string" &&
    currentUser.role.trim().toLowerCase() === "admin";

  if (isAdmin) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-8 dark:bg-slate-950 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-7xl">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-blue-700 dark:text-blue-400">Turkana Food INC.</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">Admin Dashboard</h1>
            </div>
            <AdminLogoutButton />
          </div>
          <AdminDashboard />
        </div>
      </main>
    );
  }

  const { data, error } = await supabaseAdmin
    .from("credit_customer_list")
    .select("customer_code,customer_name")
    .eq("salesperson", session.user.salespersonName)
    .order("customer_code", { ascending: true });

  if (error) {
    console.error("Failed to fetch dashboard customers", error);
    throw new Error("Failed to fetch dashboard customers");
  }

  const customers = ((data as CustomerRow[]) ?? []).filter(
    (row): row is { customer_code: string; customer_name: string } => Boolean(row.customer_code) && Boolean(row.customer_name),
  );

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Turkana Food INC.</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Credit Request Form Creator</p>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Welcome, {session.user.salespersonName}</p>
      <DashboardCustomers initialCustomers={customers} />
    </main>
  );
}
