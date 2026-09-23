import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"

import { getSupabaseAdmin } from "@/lib/supabase-admin"

export const dynamic = "force-dynamic"

const DIAG_KEY = "trk-diag-9f3a2c7e"
const OMER_NAME = "Omer Colak"

function authed(request: Request) {
  const url = new URL(request.url)
  return url.searchParams.get("key") === DIAG_KEY
}

export async function GET(request: Request) {
  if (!authed(request)) {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }

  const supabase = getSupabaseAdmin()
  const url = new URL(request.url)
  const mode = url.searchParams.get("mode") ?? "count"

  // Discover every exposed table/view and its columns via the PostgREST OpenAPI spec,
  // then surface any that expose a "salesperson" column (candidate base tables for the view).
  if (mode === "schema") {
    const base = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string
    const specRes = await fetch(`${base}/rest/v1/`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
    const spec = (await specRes.json()) as {
      definitions?: Record<string, { properties?: Record<string, { description?: string }> }>
    }
    const defs = spec.definitions ?? {}
    const withSalesperson: Record<string, string[]> = {}
    for (const [tableName, def] of Object.entries(defs)) {
      const cols = Object.keys(def.properties ?? {})
      if (cols.some((c) => c.toLowerCase().includes("salesperson") || c.toLowerCase().includes("sales_person"))) {
        withSalesperson[tableName] = cols
      }
    }
    return NextResponse.json(
      { ok: specRes.ok, allTables: Object.keys(defs), tablesWithSalesperson: withSalesperson },
      { status: 200 },
    )
  }

  // Distinct salesperson values that look like Omer, plus a count of his customers.
  const { data: omerRows, error: omerErr } = await supabase
    .from("credit_customer_list")
    .select("customer_code", { count: "exact", head: false })
    .eq("salesperson", OMER_NAME)

  // Also gather the distinct spellings so we don't miss a case/spacing variant.
  const { data: sampleRows } = await supabase
    .from("credit_customer_list")
    .select("salesperson")
    .ilike("salesperson", "%omer%")
    .limit(2000)

  const variantCounts: Record<string, number> = {}
  for (const r of (sampleRows ?? []) as { salesperson: string | null }[]) {
    const key = r.salesperson ?? "(null)"
    variantCounts[key] = (variantCounts[key] ?? 0) + 1
  }

  return NextResponse.json(
    {
      ok: !omerErr,
      omerExactName: OMER_NAME,
      omerExactCustomerCount: (omerRows ?? []).length,
      omerNameVariants: variantCounts,
      error: omerErr?.message ?? null,
    },
    { status: 200 },
  )
}

export async function POST(request: Request) {
  if (!authed(request)) {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }

  let body: {
    username?: string
    password?: string
    name?: string
    email?: string
    reassignCustomers?: boolean
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 })
  }

  const { username, password, name, email, reassignCustomers } = body
  if (!username || !password || !name || !email) {
    return NextResponse.json({ error: "username, password, name, email are all required" }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()

  // bcryptjs emits a $2a$ hash which pgcrypto's crypt() verifies correctly.
  const passwordHash = bcrypt.hashSync(password, 10)

  // 1) Reassign Omer's book of business FIRST (so nothing is orphaned if this errors).
  // credit_customer_list is a non-updatable VIEW, so we update every underlying base
  // table that carries the salesperson name string.
  const BASE_TABLES = [
    "credit_rows",
    "credit_requests",
    "credit_request_cart_items",
    "credit_request_cart_drafts",
    "credit_rows_analytics",
  ]
  const reassignedByTable: Record<string, number | string> = {}
  if (reassignCustomers) {
    for (const table of BASE_TABLES) {
      const { data: updated, error: reErr } = await supabase
        .from(table)
        .update({ salesperson: name })
        .eq("salesperson", OMER_NAME)
        .select("*")

      if (reErr) {
        // A table may legitimately not have the column / not exist; record and continue.
        reassignedByTable[table] = `error: ${reErr.message}`
        continue
      }
      reassignedByTable[table] = (updated ?? []).length
    }
  }

  // 2) Update Omer's app_users row (id 4) to become Abdeldjalil.
  const { data: userUpdated, error: userErr } = await supabase
    .from("app_users")
    .update({
      username,
      salesperson_name: name,
      email,
      password_hash: passwordHash,
      is_active: true,
      role: "salesperson",
    })
    .eq("username", "Omer")
    .select("id,username,salesperson_name,email,role,is_active")

  if (userErr) {
    return NextResponse.json({ ok: false, step: "user-update", error: userErr.message }, { status: 200 })
  }

  // 3) Verify the new password actually validates through the app's own RPC.
  const { data: verifyData, error: verifyErr } = await supabase.rpc("verify_app_user_password", {
    p_username: username,
    p_password: password,
  })

  return NextResponse.json(
    {
      ok: true,
      reassignedByTable,
      updatedUser: userUpdated,
      passwordVerifies: !verifyErr && Array.isArray(verifyData) ? verifyData.length > 0 : Boolean(verifyData),
      verifyError: verifyErr?.message ?? null,
    },
    { status: 200 },
  )
}
