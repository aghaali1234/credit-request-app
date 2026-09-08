import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key");
  if (key !== "trk-diag-9f3a2c7e") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const base =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_PUBLIC_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const result: Record<string, unknown> = {
    hasUrl: Boolean(base),
    hasServiceKey: Boolean(serviceKey),
    projectRef: base
      ? base.replace(/^https?:\/\//, "").split(".")[0]
      : null,
  };

  if (!base || !serviceKey) {
    result.verdict = "MISSING_SUPABASE_ENV";
    return NextResponse.json(result);
  }

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    Prefer: "count=exact",
  };

  const tables = ["app_users", "customers", "credit_customer_list", "dl_rows"];
  const counts: Record<string, string> = {};
  for (const t of tables) {
    try {
      const r = await fetch(`${base}/rest/v1/${t}?select=*&limit=1`, {
        headers,
      });
      counts[t] = `HTTP ${r.status} count=${r.headers.get("content-range") ?? "n/a"}`;
    } catch (e) {
      counts[t] = `ERR ${(e as Error).message}`;
    }
  }
  result.tables = counts;
  return NextResponse.json(result);
}
