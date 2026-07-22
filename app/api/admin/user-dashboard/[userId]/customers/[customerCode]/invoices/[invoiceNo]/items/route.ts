import { getInspectableUser, toNumber } from "@/lib/user-dashboard/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type Row = { customer_name: string | null; invoice_date: string | null; item_no: string | null; item_descp: string | null; quantity: number | string | null; sales_amount: number | string | null; sales_batch_number: string | null; sales_lot_no: string | null; batch_expiration_date: string | null; piece_price: number | string | null; free_txt?: string | null };

export async function GET(_request: Request, context: RouteContext<"/api/admin/user-dashboard/[userId]/customers/[customerCode]/invoices/[invoiceNo]/items">) {
  const { userId, customerCode: rawCustomerCode, invoiceNo: rawInvoiceNo } = await context.params;
  const { user, response } = await getInspectableUser(userId);
  if (response) return response;
  if (!user) return Response.json({ error: "Inspectable user not found" }, { status: 404 });
  const customerCode = decodeURIComponent(rawCustomerCode);
  const invoiceNo = decodeURIComponent(rawInvoiceNo);
  const isCreditInvoice = invoiceNo.startsWith("CM-");
  const select = isCreditInvoice ? "customer_name,invoice_date,item_no,item_descp,quantity,sales_amount,sales_batch_number,sales_lot_no,batch_expiration_date,piece_price,free_txt" : "customer_name,invoice_date,item_no,item_descp,quantity,sales_amount,sales_batch_number,sales_lot_no,batch_expiration_date,piece_price";
  const { data, error } = await getSupabaseAdmin().from("credit_rows").select(select).eq("customer_code", customerCode).eq("invoice_no", invoiceNo).eq("salesperson", user.salespersonName).order("item_no", { ascending: true }).limit(1000);
  if (error) return Response.json({ error: "Failed to fetch invoice items" }, { status: 500 });
  let customerName: string | null = null, invoiceDate: string | null = null;
  const items = ((data as unknown as Row[]) ?? []).map((row) => {
    if (!customerName && row.customer_name) customerName = row.customer_name;
    if (!invoiceDate && row.invoice_date) invoiceDate = row.invoice_date;
    const quantity = toNumber(row.quantity), salesAmount = toNumber(row.sales_amount), piecePrice = toNumber(row.piece_price);
    if (!row.item_no || !row.item_descp || quantity === null || salesAmount === null || !row.sales_batch_number || !row.sales_lot_no || !row.batch_expiration_date || piecePrice === null) return null;
    return { item_no: row.item_no, item_descp: row.item_descp, quantity, sales_amount: salesAmount, sales_batch_number: row.sales_batch_number, sales_lot_no: row.sales_lot_no, batch_expiration_date: row.batch_expiration_date, piece_price: piecePrice, free_txt: row.free_txt ?? null };
  }).filter((row): row is NonNullable<typeof row> => row !== null);
  return Response.json({ customerName, invoiceDate, items });
}
