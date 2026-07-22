import { getInspectableUser } from "@/lib/user-dashboard/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type Row = { customer_name: string | null; invoice_no: string | null; invoice_date: string | null; free_txt: string | null };
function hasReason(v: string | null) { const t = v?.trim(); return Boolean(t && t !== "0"); }

export async function GET(_request: Request, context: RouteContext<"/api/admin/user-dashboard/[userId]/customers/[customerCode]/invoices">) {
  const { userId, customerCode: rawCustomerCode } = await context.params;
  const { user, response } = await getInspectableUser(userId);
  if (response) return response;
  if (!user) return Response.json({ error: "Inspectable user not found" }, { status: 404 });
  const customerCode = decodeURIComponent(rawCustomerCode);
  const pageSize = 1000;
  let from = 0;
  let hasMore = true;
  let customerName: string | null = null;
  const invoicesByNo = new Map<string, { invoice_no: string; invoice_date: string; free_txt: string | null }>();

  while (hasMore) {
    const { data, error } = await getSupabaseAdmin()
      .from("credit_rows")
      .select("customer_name,invoice_no,invoice_date,free_txt")
      .eq("customer_code", customerCode)
      .eq("salesperson", user.salespersonName)
      .order("invoice_no", { ascending: false })
      .order("invoice_date", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) {
      console.error("Failed to fetch inspected invoices", error);
      return Response.json({ error: "Failed to fetch invoices" }, { status: 500 });
    }
    const rows = (data as Row[]) ?? [];
    for (const row of rows) {
      if (!customerName && row.customer_name) customerName = row.customer_name;
      if (row.invoice_no && row.invoice_date) {
        const existing = invoicesByNo.get(row.invoice_no);
        if (!existing) invoicesByNo.set(row.invoice_no, { invoice_no: row.invoice_no, invoice_date: row.invoice_date, free_txt: row.free_txt });
        else if (!hasReason(existing.free_txt) && hasReason(row.free_txt)) existing.free_txt = row.free_txt;
      }
    }
    hasMore = rows.length === pageSize;
    from += pageSize;
  }
  return Response.json({ customerName, invoices: Array.from(invoicesByNo.values()).sort((a,b) => b.invoice_no.localeCompare(a.invoice_no, undefined, { numeric: true })) });
}
