import { getAdminSession } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

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

export async function GET(request: Request) {
  const { response } = await getAdminSession();

  if (response) {
    return response;
  }

  const salesperson = new URL(request.url).searchParams
    .get("salesperson")
    ?.trim();

  if (!salesperson) {
    return Response.json({ error: "Missing salesperson" }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("credit_rows")
    .select(
      "salesperson,customer_code,customer_name,invoice_no,invoice_date,item_no,item_descp,quantity,sales_amount",
    )
    .eq("salesperson", salesperson)
    .order("invoice_date", { ascending: false })
    .order("invoice_no", { ascending: false })
    .limit(500);

  if (error) {
    console.error("Failed to fetch salesperson credit rows", error);
    return Response.json(
      { error: "Failed to fetch salesperson credit rows" },
      { status: 500 },
    );
  }

  return Response.json({ rows: (data as CreditRow[]) ?? [] });
}
