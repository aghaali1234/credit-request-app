import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { isAdminUser } from "@/lib/is-admin-user";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { InvoiceItemsTable } from "@/components/invoice-items-table";

type InvoiceItemRow = {
  customer_name: string | null;
  invoice_date: string | null;
  item_no: string | null;
  item_descp: string | null;
  quantity: number | string | null;
  sales_amount: number | string | null;
  sales_batch_number: string | null;
  sales_lot_no: string | null;
  batch_expiration_date: string | null;
  piece_price: number | string | null;
  free_txt?: string | null;
};

type InvoiceItemsPageProps = {
  params: Promise<{ customerCode: string; invoiceNo: string }>;
};

export default async function InvoiceItemsPage({ params }: InvoiceItemsPageProps) {
  const session = await getServerSession(authOptions);
  const isAdmin = isAdminUser(session?.user?.name);

  if (!session?.user?.salespersonName) {
    redirect("/");
  }

  const { customerCode: rawCustomerCode, invoiceNo: rawInvoiceNo } = await params;
  const customerCode = decodeURIComponent(rawCustomerCode);
  const invoiceNo = decodeURIComponent(rawInvoiceNo);
  const isCreditInvoice = invoiceNo.startsWith("CM-");
  const backHref = `/dashboard/customers/${encodeURIComponent(customerCode)}${isCreditInvoice ? "?tab=credits" : ""}`;

  const supabaseAdmin = getSupabaseAdmin();
  const pageSize = 1000;
  let from = 0;
  let hasMore = true;
  let customerName: string | null = null;
  let invoiceDate: string | null = null;
  const items: Array<{
    item_no: string;
    item_descp: string;
    quantity: number;
    sales_amount: number;
    sales_batch_number: string;
    sales_lot_no: string;
    batch_expiration_date: string;
    piece_price: number;
    free_txt?: string | null;
  }> = [];

  function toNumber(value: number | string | null): number | null {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return null;
  }

  const itemSelectColumns = isCreditInvoice
    ? "customer_name,invoice_date,item_no,item_descp,quantity,sales_amount,sales_batch_number,sales_lot_no,batch_expiration_date,piece_price,free_txt"
    : "customer_name,invoice_date,item_no,item_descp,quantity,sales_amount,sales_batch_number,sales_lot_no,batch_expiration_date,piece_price";

  while (hasMore) {
    const to = from + pageSize - 1;
    let query = supabaseAdmin
      .from("credit_rows")
      .select(itemSelectColumns)
      .eq("customer_code", customerCode)
      .eq("invoice_no", invoiceNo)
      .order("item_no", { ascending: true })
      .range(from, to);
    if (!isAdmin) {
      query = query.eq("salesperson", session.user.salespersonName);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Failed to fetch invoice items", error);
      throw new Error("Failed to fetch invoice items");
    }

    const rows = (data as unknown as InvoiceItemRow[]) ?? [];

    for (const row of rows) {
      if (!customerName && row.customer_name) {
        customerName = row.customer_name;
      }

      if (!invoiceDate && row.invoice_date) {
        invoiceDate = row.invoice_date;
      }

      const quantity = toNumber(row.quantity);
      const salesAmount = toNumber(row.sales_amount);
      const piecePrice = toNumber(row.piece_price);

      if (
        row.item_no &&
        row.item_descp &&
        quantity !== null &&
        salesAmount !== null &&
        row.sales_batch_number &&
        row.sales_lot_no &&
        row.batch_expiration_date &&
        piecePrice !== null
      ) {
        items.push({
          item_no: row.item_no,
          item_descp: row.item_descp,
          quantity,
          sales_amount: salesAmount,
          sales_batch_number: row.sales_batch_number,
          sales_lot_no: row.sales_lot_no,
          batch_expiration_date: row.batch_expiration_date,
          piece_price: piecePrice,
          free_txt: row.free_txt ?? null,
        });
      }
    }

    hasMore = rows.length === pageSize;
    from += pageSize;
  }

  if (items.length === 0) {
    notFound();
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">Customer</p>
          <h1 className="text-2xl font-semibold">{customerName ?? customerCode}</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">Code: {customerCode}</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">{isCreditInvoice ? "Credit No" : "Invoice No"}: {invoiceNo}</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">{isCreditInvoice ? "Credit Date" : "Invoice Date"}: {invoiceDate ?? "-"}</p>
        </div>
        <Link
          href={backHref}
          className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/60 dark:bg-zinc-900/40"
        >
          Back
        </Link>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{isCreditInvoice ? "Credit Items" : "Invoice Items"}</h2>
        <InvoiceItemsTable items={items} customerCode={customerCode} invoiceNo={invoiceNo} invoiceDate={invoiceDate} allowItemSelection={!isCreditInvoice} showReason={isCreditInvoice} />
      </section>
    </main>
  );
}
