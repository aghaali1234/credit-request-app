import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { isAdminUser } from "@/lib/is-admin-user";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { CustomerInvoicesView } from "@/components/customer-invoices-view";

type CreditRowInvoice = {
  customer_name: string | null;
  invoice_no: string | null;
  invoice_date: string | null;
  free_txt: string | null;
};

type CustomerInvoicesPageProps = {
  params: Promise<{ customerCode: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
};

export default async function CustomerInvoicesPage({ params, searchParams }: CustomerInvoicesPageProps) {
  const session = await getServerSession(authOptions);
  const isAdmin = isAdminUser(session?.user?.name);

  if (!session?.user?.salespersonName) {
    redirect("/");
  }

  const { customerCode: rawCustomerCode } = await params;
  const { tab } = await searchParams;
  const customerCode = decodeURIComponent(rawCustomerCode);
  const initialTab = tab === "credits" ? "credits" : "invoices";

  const supabaseAdmin = getSupabaseAdmin();
  const pageSize = 1000;
  let from = 0;
  let hasMore = true;
  let customerName: string | null = null;
  const invoicesByNo = new Map<string, { invoice_no: string; invoice_date: string; free_txt: string | null }>();

  while (hasMore) {
    const to = from + pageSize - 1;
    let query = supabaseAdmin
      .from("credit_rows")
      .select("customer_name,invoice_no,invoice_date,free_txt")
      .eq("customer_code", customerCode)
      .order("invoice_no", { ascending: false }).order("invoice_date", { ascending: false })
      .range(from, to);
    if (!isAdmin) {
      query = query.eq("salesperson", session.user.salespersonName);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Failed to fetch customer invoices", error);
      throw new Error("Failed to fetch customer invoices");
    }

    const rows = (data as CreditRowInvoice[]) ?? [];

    for (const row of rows) {
      if (!customerName && row.customer_name) {
        customerName = row.customer_name;
      }

      if (row.invoice_no && row.invoice_date) {
        const existingInvoice = invoicesByNo.get(row.invoice_no);

        if (!existingInvoice) {
          invoicesByNo.set(row.invoice_no, {
            invoice_no: row.invoice_no,
            invoice_date: row.invoice_date,
            free_txt: row.free_txt,
          });
        } else if (!existingInvoice.free_txt && row.free_txt) {
          existingInvoice.free_txt = row.free_txt;
        }
      }

    }

    hasMore = rows.length === pageSize;
    from += pageSize;
  }

  if (!customerName && invoicesByNo.size === 0) {
    notFound();
  }

  const invoices = Array.from(invoicesByNo.values()).sort((left, right) => right.invoice_no.localeCompare(left.invoice_no, undefined, { numeric: true }));

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">Customer</p>
          <h1 className="text-2xl font-semibold">{customerName ?? customerCode}</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">Code: {customerCode}</p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/60 dark:bg-zinc-900/40"
        >
          Back
        </Link>
      </div>

      <CustomerInvoicesView customerCode={customerCode} invoices={invoices} initialTab={initialTab} />
    </main>
  );
}
