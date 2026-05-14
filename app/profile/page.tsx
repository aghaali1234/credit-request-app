import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type AnalyticsRow = {
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

type NamedTotal = {
  key: string;
  name: string;
  sales: number;
  quantity: number;
  invoices: Set<string>;
};

type DisplayTotal = {
  key: string;
  name: string;
  sales: number;
  quantity: number;
  invoices: number;
};

type MonthlyTotal = {
  month: string;
  sales: number;
  quantity: number;
};

type RecentInvoice = {
  invoiceNo: string;
  invoiceDate: string;
  customerName: string;
  sales: number;
  quantity: number;
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function toNumber(value: number | string | null) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function upsertNamedTotal(
  totals: Map<string, NamedTotal>,
  key: string | null,
  name: string | null,
  sales: number,
  quantity: number,
  invoiceNo: string | null,
) {
  if (!key || !name) {
    return;
  }

  const existing = totals.get(key) ?? {
    key,
    name,
    sales: 0,
    quantity: 0,
    invoices: new Set<string>(),
  };

  existing.sales += sales;
  existing.quantity += quantity;

  if (invoiceNo) {
    existing.invoices.add(invoiceNo);
  }

  totals.set(key, existing);
}

function toDisplayTotals(totals: Map<string, NamedTotal>) {
  return Array.from(totals.values())
    .map((total) => ({
      key: total.key,
      name: total.name,
      sales: total.sales,
      quantity: total.quantity,
      invoices: total.invoices.size,
    }))
    .sort((left, right) => right.sales - left.sales);
}

function BarChart({ data, valueKey, formatter }: { data: MonthlyTotal[]; valueKey: "sales" | "quantity"; formatter: (value: number) => string }) {
  const maxValue = Math.max(...data.map((item) => item[valueKey]), 1);

  return (
    <div className="flex h-64 items-end gap-2 pt-4">
      {data.map((item) => {
        const value = item[valueKey];
        const height = Math.max((value / maxValue) * 100, value > 0 ? 4 : 0);

        return (
          <div key={item.month} className="flex h-full flex-1 flex-col justify-end gap-2">
            <div className="flex flex-1 items-end rounded-t-xl bg-zinc-100 p-1 dark:bg-zinc-900">
              <div
                className="w-full rounded-t-lg bg-gradient-to-t from-sky-700 to-cyan-400 shadow-sm"
                style={{ height: `${height}%` }}
                title={`${item.month}: ${formatter(value)}`}
              />
            </div>
            <div className="text-center text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{item.month}</div>
          </div>
        );
      })}
    </div>
  );
}

function HorizontalBars({ data, label, formatter }: { data: DisplayTotal[]; label: "name" | "key"; formatter: (value: number) => string }) {
  const maxValue = Math.max(...data.map((item) => item.sales), 1);

  return (
    <div className="space-y-4 pt-2">
      {data.map((item) => {
        const width = Math.max((item.sales / maxValue) * 100, item.sales > 0 ? 6 : 0);

        return (
          <div key={item.key} className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium text-zinc-800 dark:text-zinc-100">{item[label]}</span>
              <span className="shrink-0 text-zinc-500 dark:text-zinc-400">{formatter(item.sales)}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
              <div className="h-full rounded-full bg-gradient-to-r from-sky-700 via-cyan-500 to-emerald-400" style={{ width: `${width}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: Array<Array<string | number>>;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
          <thead className="bg-zinc-50 dark:bg-zinc-900/80">
            <tr>
              {headers.map((header) => (
                <th key={header} scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
            {rows.length > 0 ? (
              rows.map((row, rowIndex) => (
                <tr key={row.join("-") || rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={`${rowIndex}-${cellIndex}`} className="whitespace-nowrap px-4 py-3 text-zinc-700 dark:text-zinc-200">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={headers.length} className="px-4 py-6 text-center text-zinc-500 dark:text-zinc-400">
                  No data
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  const salespersonName = session?.user?.salespersonName;

  if (!salespersonName) {
    redirect("/");
  }

  const supabaseAdmin = getSupabaseAdmin();
  const pageSize = 1000;
  let from = 0;
  let hasMore = true;
  const rows: AnalyticsRow[] = [];

  while (hasMore) {
    const to = from + pageSize - 1;
    const { data, error } = await supabaseAdmin
      .from("credit_rows_analytics")
      .select("salesperson,customer_code,customer_name,invoice_no,invoice_date,item_no,item_descp,quantity,sales_amount")
      .eq("salesperson", salespersonName)
      .gte("invoice_date", "2026-01-01")
      .lt("invoice_date", "2027-01-01")
      .not("invoice_no", "ilike", "CM-%")
      .order("invoice_date", { ascending: false })
      .range(from, to);

    if (error) {
      console.error("Failed to fetch salesperson profile analytics", error);
      throw new Error("Failed to fetch salesperson profile analytics");
    }

    const pageRows = (data as AnalyticsRow[]) ?? [];
    rows.push(...pageRows);
    hasMore = pageRows.length === pageSize;
    from += pageSize;
  }

  const monthlyTotals: MonthlyTotal[] = MONTHS.map((month) => ({ month, sales: 0, quantity: 0 }));
  const customerTotals = new Map<string, NamedTotal>();
  const productTotals = new Map<string, NamedTotal>();
  const invoiceTotals = new Map<string, RecentInvoice>();
  const activeCustomers = new Set<string>();
  const uniqueInvoices = new Set<string>();
  let totalSales = 0;
  let totalQuantity = 0;

  for (const row of rows) {
    const sales = toNumber(row.sales_amount);
    const quantity = toNumber(row.quantity);
    totalSales += sales;
    totalQuantity += quantity;

    if (row.customer_code) {
      activeCustomers.add(row.customer_code);
    }

    if (row.invoice_no) {
      uniqueInvoices.add(row.invoice_no);
    }

    if (row.invoice_date) {
      const date = new Date(`${row.invoice_date}T00:00:00`);
      const monthIndex = date.getUTCMonth();

      if (!Number.isNaN(date.getTime()) && monthIndex >= 0 && monthIndex < 12) {
        monthlyTotals[monthIndex].sales += sales;
        monthlyTotals[monthIndex].quantity += quantity;
      }
    }

    upsertNamedTotal(customerTotals, row.customer_code, row.customer_name, sales, quantity, row.invoice_no);
    upsertNamedTotal(productTotals, row.item_no, row.item_descp, sales, quantity, row.invoice_no);

    if (row.invoice_no && row.invoice_date) {
      const existingInvoice = invoiceTotals.get(row.invoice_no) ?? {
        invoiceNo: row.invoice_no,
        invoiceDate: row.invoice_date,
        customerName: row.customer_name ?? row.customer_code ?? "-",
        sales: 0,
        quantity: 0,
      };

      existingInvoice.sales += sales;
      existingInvoice.quantity += quantity;
      invoiceTotals.set(row.invoice_no, existingInvoice);
    }
  }

  const topCustomers = toDisplayTotals(customerTotals);
  const topProducts = toDisplayTotals(productTotals);
  const recentInvoices = Array.from(invoiceTotals.values())
    .sort((left, right) => {
      const dateCompare = right.invoiceDate.localeCompare(left.invoiceDate);
      return dateCompare === 0 ? right.invoiceNo.localeCompare(left.invoiceNo, undefined, { numeric: true }) : dateCompare;
    })
    .slice(0, 10);
  const topProduct = topProducts[0]?.name ?? "-";
  const topCustomer = topCustomers[0]?.name ?? "-";

  const kpis = [
    { label: "Total Sales", value: formatCurrency(totalSales) },
    { label: "Total Quantity Sold", value: formatNumber(totalQuantity) },
    { label: "Active Customers", value: formatNumber(activeCustomers.size) },
    { label: "Unique Invoices", value: formatNumber(uniqueInvoices.size) },
    { label: "Top Product", value: topProduct },
    { label: "Top Customer", value: topCustomer },
  ];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.14),_transparent_34%),linear-gradient(180deg,_#f8fafc_0%,_#ffffff_42%)] px-4 py-8 text-zinc-950 dark:bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_32%),linear-gradient(180deg,_#09090b_0%,_#18181b_48%)] dark:text-zinc-50 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl space-y-8">
        <header className="flex flex-col gap-4 rounded-3xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/70 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.28em] text-sky-700 dark:text-sky-300">2026</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Salesperson Profile</h1>
            <p className="mt-2 text-sm font-medium text-zinc-600 dark:text-zinc-300">{salespersonName}</p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-sky-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Dashboard
          </Link>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {kpis.map((kpi) => (
            <article key={kpi.label} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{kpi.label}</h2>
              <p className="mt-3 truncate text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50" title={kpi.value}>
                {kpi.value}
              </p>
            </article>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <article className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-lg font-semibold">Monthly Sales for 2026</h2>
            <BarChart data={monthlyTotals} valueKey="sales" formatter={formatCompactCurrency} />
          </article>

          <article className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-lg font-semibold">Monthly Quantity for 2026</h2>
            <BarChart data={monthlyTotals} valueKey="quantity" formatter={formatNumber} />
          </article>

          <article className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-lg font-semibold">Top 5 Products by Sales</h2>
            <HorizontalBars data={topProducts.slice(0, 5)} label="name" formatter={formatCompactCurrency} />
          </article>

          <article className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-lg font-semibold">Top 5 Customers by Sales</h2>
            <HorizontalBars data={topCustomers.slice(0, 5)} label="name" formatter={formatCompactCurrency} />
          </article>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="space-y-3">
            <h2 className="text-xl font-semibold">Top Customers by Sales</h2>
            <DataTable
              headers={["Customer", "Sales", "Quantity", "Invoices"]}
              rows={topCustomers.slice(0, 10).map((customer) => [
                customer.name,
                formatCurrency(customer.sales),
                formatNumber(customer.quantity),
                formatNumber(customer.invoices),
              ])}
            />
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-semibold">Top Products by Sales</h2>
            <DataTable
              headers={["Product", "Sales", "Quantity", "Invoices"]}
              rows={topProducts.slice(0, 10).map((product) => [
                product.name,
                formatCurrency(product.sales),
                formatNumber(product.quantity),
                formatNumber(product.invoices),
              ])}
            />
          </div>

          <div className="space-y-3 xl:col-span-2">
            <h2 className="text-xl font-semibold">Recent Sales / Recent Invoices</h2>
            <DataTable
              headers={["Invoice", "Date", "Customer", "Sales", "Quantity"]}
              rows={recentInvoices.map((invoice) => [
                invoice.invoiceNo,
                formatDate(invoice.invoiceDate),
                invoice.customerName,
                formatCurrency(invoice.sales),
                formatNumber(invoice.quantity),
              ])}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
