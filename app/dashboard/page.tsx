import Link from "next/link";
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

type CreditRow = {
  salesperson: string | null;
  customer_code: string | null;
  customer_name: string | null;
  invoice_no: string | null;
  invoice_date: string | null;
  item_no: string | null;
  item_descp: string | null;
  quantity: number | string | null;
  sales_amount: number | string | null;
};

type DashboardPageProps = {
  searchParams: Promise<{ salesperson?: string | string[] }>;
};

function normalizeSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatCell(value: CreditRow[keyof CreditRow]) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  return String(value);
}

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

    const rows = (data as Pick<CreditRow, "salesperson">[]) ?? [];

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

async function fetchSalespersonRows(salesperson: string | undefined) {
  if (!salesperson) {
    return [];
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("credit_rows")
    .select("salesperson,customer_code,customer_name,invoice_no,invoice_date,item_no,item_descp,quantity,sales_amount")
    .eq("salesperson", salesperson)
    .order("invoice_date", { ascending: false })
    .order("invoice_no", { ascending: false })
    .limit(500);

  if (error) {
    console.error("Failed to fetch salesperson credit rows", error);
    throw new Error("Failed to fetch salesperson credit rows");
  }

  return (data as CreditRow[]) ?? [];
}

function AdminDashboard({ salespeople, selectedSalesperson, rows }: { salespeople: string[]; selectedSalesperson?: string; rows: CreditRow[] }) {
  return (
    <section className="mt-6 space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white/75 p-4 shadow-sm shadow-zinc-200/60 dark:border-zinc-800 dark:bg-zinc-950/70 dark:shadow-black/20">
        <h2 className="text-lg font-semibold tracking-tight">Admin Dashboard</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
          Select a salesperson to list that person&apos;s credit rows data.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {salespeople.map((salesperson) => {
            const isSelected = salesperson === selectedSalesperson;

            return (
              <Link
                key={salesperson}
                href={`/dashboard?salesperson=${encodeURIComponent(salesperson)}`}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                  isSelected
                    ? "border-zinc-950 bg-zinc-950 text-white dark:border-white dark:bg-white dark:text-zinc-950"
                    : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-200 dark:hover:bg-zinc-800/60"
                }`}
              >
                {salesperson}
              </Link>
            );
          })}
        </div>
        {salespeople.length === 0 ? <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">No salesperson data found.</p> : null}
      </div>

      {selectedSalesperson ? (
        <div className="rounded-2xl border border-zinc-200 bg-white/75 p-4 shadow-sm shadow-zinc-200/60 dark:border-zinc-800 dark:bg-zinc-950/70 dark:shadow-black/20">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold">{selectedSalesperson}</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">Showing up to 500 credit rows.</p>
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{rows.length} row(s)</p>
          </div>

          {rows.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="min-w-full divide-y divide-zinc-200 text-left text-sm dark:divide-zinc-800">
                <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/80 dark:text-zinc-400">
                  <tr>
                    {[
                      "Customer Code",
                      "Customer",
                      "Invoice",
                      "Invoice Date",
                      "Item No",
                      "Item Description",
                      "Qty",
                      "Sales Amount",
                    ].map((header) => (
                      <th key={header} scope="col" className="whitespace-nowrap px-3 py-2 font-semibold">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                  {rows.map((row, index) => (
                    <tr key={`${row.invoice_no}-${row.item_no}-${index}`} className="dark:bg-zinc-950/30">
                      <td className="whitespace-nowrap px-3 py-2 font-medium">{formatCell(row.customer_code)}</td>
                      <td className="min-w-52 px-3 py-2">{formatCell(row.customer_name)}</td>
                      <td className="whitespace-nowrap px-3 py-2">{formatCell(row.invoice_no)}</td>
                      <td className="whitespace-nowrap px-3 py-2">{formatCell(row.invoice_date)}</td>
                      <td className="whitespace-nowrap px-3 py-2">{formatCell(row.item_no)}</td>
                      <td className="min-w-64 px-3 py-2">{formatCell(row.item_descp)}</td>
                      <td className="whitespace-nowrap px-3 py-2">{formatCell(row.quantity)}</td>
                      <td className="whitespace-nowrap px-3 py-2">{formatCell(row.sales_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-300">No rows found for this salesperson.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.salespersonName) {
    redirect("/");
  }

  const isAdmin = isAdminUser(session.user.name);
  const { salesperson } = await searchParams;
  const selectedSalesperson = normalizeSearchParam(salesperson)?.trim();

  if (isAdmin) {
    const salespeople = await fetchSalespeople();
    const selectedValidSalesperson = selectedSalesperson && salespeople.includes(selectedSalesperson) ? selectedSalesperson : undefined;
    const rows = await fetchSalespersonRows(selectedValidSalesperson);

    return (
      <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-semibold">Turkana Food INC.</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Credit Request Form Creator</p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Welcome, {session.user.salespersonName}</p>
        <AdminDashboard salespeople={salespeople} selectedSalesperson={selectedValidSalesperson} rows={rows} />
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
