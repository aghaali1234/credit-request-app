import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { AdminDashboard } from "@/components/admin-dashboard";
import { DashboardCustomers } from "@/components/dashboard-customers";
import { authOptions } from "@/lib/auth";
import { isAdminUser } from "@/lib/is-admin-user";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type CustomerRow = {
  customer_code: string | null;
  customer_name: string | null;
};

type SalespersonRow = {
  salesperson: string | null;
};

async function fetchSalespeople() {
  const supabaseAdmin = getSupabaseAdmin();
  const pageSize = 1000;
  let from = 0;
  let hasMore = true;
  const salespeople = new Set<string>();

  while (hasMore) {
    const to = from + pageSize - 1;
    const { data, error } = await supabaseAdmin
      .from("credit_rows")
      .select("salesperson")
      .not("salesperson", "is", null)
      .order("salesperson", { ascending: true })
      .range(from, to);

    if (error) {
      console.error("Failed to fetch dashboard salespeople", error);
      throw new Error("Failed to fetch dashboard salespeople");
    }

    const rows = (data as SalespersonRow[]) ?? [];

    for (const row of rows) {
      const trimmedSalesperson = row.salesperson?.trim();

      if (trimmedSalesperson) {
        salespeople.add(trimmedSalesperson);
      }
    }

    hasMore = rows.length === pageSize;
    from += pageSize;
  }

  return Array.from(salespeople).sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.salespersonName) {
    redirect("/");
  }

  const isAdmin = isAdminUser(session.user.name);

  if (isAdmin) {
    const salespeople = await fetchSalespeople();

    return (
      <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-semibold">Turkana Food INC.</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Credit Request Form Creator</p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Welcome, {session.user.salespersonName}</p>
        <AdminDashboard salespeople={salespeople} />
      </main>
    );
  }

  const supabaseAdmin = getSupabaseAdmin();
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
