import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { DashboardCustomers } from "@/components/dashboard-customers";
import { authOptions } from "@/lib/auth";
import { isAdminUser } from "@/lib/is-admin-user";
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
  const isAdmin = isAdminUser(session.user.name);
  let customerQuery = supabaseAdmin
    .from("credit_customer_list")
    .select("customer_code,customer_name")
    .order("customer_code", { ascending: true });

  if (!isAdmin) {
    customerQuery = customerQuery.eq("salesperson", session.user.salespersonName);
  }

  const { data, error } = await customerQuery;

  if (error) {
    console.error("Failed to fetch dashboard customers", error);
    throw new Error("Failed to fetch dashboard customers");
  }

  const customers = ((data as CustomerRow[]) ?? []).filter(
    (row): row is { customer_code: string; customer_name: string } =>
      Boolean(row.customer_code) && Boolean(row.customer_name),
  );

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Turkana Food INC.</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
        Credit Request Form Creator
      </p>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
        Welcome, {session.user.salespersonName}
      </p>
      <DashboardCustomers initialCustomers={customers} />
    </main>
  );
}
