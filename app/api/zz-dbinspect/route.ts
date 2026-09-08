import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const TOKEN = "trk-diag-9f3a2c7e"

const TABLES = ["app_users", "customers", "credit_customer_list", "dl_rows"]

export async function GET(request: Request) {
  const url = new URL(request.url)
  if (url.searchParams.get("key") !== TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const base =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_PUBLIC_URL || ""
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

  const result: Record<string, unknown> = {
    hasUrl: Boolean(base),
    hasServiceKey: Boolean(key),
    projectRef: base ? base.replace(/^https?:\/\//, "").split(".")[0] : null,
  }

  if (!base || !key) {
    result.status = "MISSING_SUPABASE_ENV"
    return NextResponse.json(result)
  }

  const headers = { apikey: key, Authorization: `Bearer ${key}` }

  try {
    const health = await fetch(`${base}/auth/v1/health`, {
      headers: { apikey: key },
    })
    result.authHealth = health.status
  } catch (e) {
    result.authHealth = `ERR: ${(e as Error).message}`
  }

  const tables: Record<string, string> = {}
  for (const t of TABLES) {
    try {
      const r = await fetch(`${base}/rest/v1/${t}?select=*&limit=1`, {
        headers: { ...headers, Prefer: "count=exact" },
      })
      tables[t] = `HTTP ${r.status} count=${r.headers.get("content-range") ?? "n/a"}`
    } catch (e) {
      tables[t] = `ERR: ${(e as Error).message}`
    }
  }
  result.tables = tables
  result.status = "OK"

  return NextResponse.json(result)
}
