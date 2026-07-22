import { getInspectableUser, toNumber } from "@/lib/user-dashboard/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type Row = { invoice_no: string | null; invoice_date: string | null; item_no: string | null; item_descp: string | null; quantity: number | string | null; sales_amount: number | string | null; sales_batch_number: string | null; sales_lot_no: string | null; batch_expiration_date: string | null; piece_price: number | string | null; free_txt: string | null };

export async function GET(request: Request, context: RouteContext<"/api/admin/user-dashboard/[userId]/customers/[customerCode]/invoice-item-search">) {
  const { userId, customerCode: rawCustomerCode } = await context.params;
  const { user, response } = await getInspectableUser(userId);
  if (response) return response;
  if (!user) return Response.json({ error: "Inspectable user not found" }, { status: 404 });
  const params = new URL(request.url).searchParams;
  const query = params.get("query")?.trim() ?? "";
  const documentType = params.get("documentType") === "credits" ? "credits" : "invoices";
  if (query.length < 2) return Response.json({ items: [] });

  let builder = getSupabaseAdmin().from("credit_rows").select("invoice_no,invoice_date,item_no,item_descp,quantity,sales_amount,sales_batch_number,sales_lot_no,batch_expiration_date,piece_price,free_txt").eq("customer_code", decodeURIComponent(rawCustomerCode)).eq("salesperson", user.salespersonName).or(`invoice_no.ilike.%${query}%,item_no.ilike.%${query}%,item_descp.ilike.%${query}%`);
  builder = documentType === "credits" ? builder.ilike("invoice_no", "CM-%") : builder.not("invoice_no", "ilike", "CM-%");
  const { data, error } = await builder.order("invoice_no", { ascending: false }).limit(50);
  if (error) return Response.json({ error: "Failed to search invoice items" }, { status: 500 });
  const items = ((data as Row[]) ?? []).map((row) => {
    const quantity = toNumber(row.quantity), salesAmount = toNumber(row.sales_amount), piecePrice = toNumber(row.piece_price);
    if (!row.invoice_no || !row.invoice_date || !row.item_no || !row.item_descp || quantity === null || salesAmount === null || !row.sales_batch_number || !row.sales_lot_no || !row.batch_expiration_date || piecePrice === null) return null;
    return { invoice_no: row.invoice_no, invoice_date: row.invoice_date, item_no: row.item_no, item_descp: row.item_descp, quantity, sales_amount: salesAmount, sales_batch_number: row.sales_batch_number, sales_lot_no: row.sales_lot_no, batch_expiration_date: row.batch_expiration_date, piece_price: piecePrice, free_txt: row.free_txt };
  }).filter((row): row is NonNullable<typeof row> => row !== null);
  return Response.json({ items });
}
