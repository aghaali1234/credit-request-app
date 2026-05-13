import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { isAdminUser } from "@/lib/is-admin-user";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type CreditRowSearchResult = {
  invoice_no: string | null;
  invoice_date: string | null;
  item_no: string | null;
  item_descp: string | null;
  quantity: number | string | null;
  sales_amount: number | string | null;
  sales_batch_number: string | null;
  sales_lot_no: string | null;
  batch_expiration_date: string | null;
  piece_price: number | string | null;
  free_txt: string | null;
};

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

export async function GET(
  request: Request,
  context: RouteContext<"/api/customers/[customerCode]/invoice-item-search">,
) {
  const session = await getServerSession(authOptions);
  const salespersonName = session?.user?.salespersonName;
  const isAdmin = isAdminUser(session?.user?.name);

  if (!salespersonName) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { customerCode: rawCustomerCode } = await context.params;
  const customerCode = decodeURIComponent(rawCustomerCode);
  const searchParams = new URL(request.url).searchParams;
  const query = searchParams.get("query")?.trim() ?? "";
  const documentType = searchParams.get("documentType") === "credits" ? "credits" : "invoices";

  if (query.length < 2) {
    return Response.json({ items: [] });
  }

  const supabaseAdmin = getSupabaseAdmin();
  let queryBuilder = supabaseAdmin
    .from("credit_rows")
    .select(
      "invoice_no,invoice_date,item_no,item_descp,quantity,sales_amount,sales_batch_number,sales_lot_no,batch_expiration_date,piece_price,free_txt",
    )
    .eq("customer_code", customerCode)
    .or(`invoice_no.ilike.%${query}%,item_no.ilike.%${query}%,item_descp.ilike.%${query}%`);

  queryBuilder =
    documentType === "credits"
      ? queryBuilder.ilike("invoice_no", "CM-%")
      : queryBuilder.not("invoice_no", "ilike", "CM-%");

  if (!isAdmin) {
    queryBuilder = queryBuilder.eq("salesperson", salespersonName);
  }
  const { data, error } = await queryBuilder.order("invoice_no", { ascending: false }).limit(50);

  if (error) {
    console.error("Failed to search customer invoice items", error);
    return Response.json({ error: "Failed to search customer invoice items" }, { status: 500 });
  }

  const items = ((data as CreditRowSearchResult[]) ?? [])
    .map((row) => {
      const quantity = toNumber(row.quantity);
      const salesAmount = toNumber(row.sales_amount);
      const piecePrice = toNumber(row.piece_price);

      if (
        !row.invoice_no ||
        !row.invoice_date ||
        !row.item_no ||
        !row.item_descp ||
        quantity === null ||
        salesAmount === null ||
        !row.sales_batch_number ||
        !row.sales_lot_no ||
        !row.batch_expiration_date ||
        piecePrice === null
      ) {
        return null;
      }

      return {
        invoice_no: row.invoice_no,
        invoice_date: row.invoice_date,
        item_no: row.item_no,
        item_descp: row.item_descp,
        quantity,
        sales_amount: salesAmount,
        sales_batch_number: row.sales_batch_number,
        sales_lot_no: row.sales_lot_no,
        batch_expiration_date: row.batch_expiration_date,
        piece_price: piecePrice,
        free_txt: row.free_txt,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  return Response.json({ items });
}
