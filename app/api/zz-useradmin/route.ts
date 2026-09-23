import { NextResponse } from "next/server"

import { getSupabaseAdmin } from "@/lib/supabase-admin"

export const dynamic = "force-dynamic"

const DIAG_KEY = "trk-diag-9f3a2c7e"

export async function GET(request: Request) {
  const url = new URL(request.url)
  if (url.searchParams.get("key") !== DIAG_KEY) {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }

  const supabase = getSupabaseAdmin()

  // Pull every app_users row so we can see the exact column shape and find Omer.
  const { data, error } = await supabase.from("app_users").select("*")

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 200 })
  }

  const rows = (data ?? []) as Record<string, unknown>[]
  const columns = rows.length > 0 ? Object.keys(rows[0]) : []

  // Redact any password/hash columns from the output.
  const redact = (row: Record<string, unknown>) => {
    const clone: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(row)) {
      if (/pass|hash|secret|token/i.test(k)) {
        clone[k] = v == null ? null : "[redacted]"
      } else {
        clone[k] = v
      }
    }
    return clone
  }

  const matches = rows.filter((r) => {
    const blob = JSON.stringify(r).toLowerCase()
    return blob.includes("omer") || blob.includes("colak") || blob.includes("çolak")
  })

  return NextResponse.json(
    {
      ok: true,
      columns,
      totalUsers: rows.length,
      allUsersLite: rows.map((r) => ({
        id: r.id ?? r.user_id,
        username: r.username,
        salesperson_name: r.salesperson_name,
        email: r.email,
        role: r.role,
        is_active: r.is_active,
      })),
      omerMatches: matches.map(redact),
    },
    { status: 200 },
  )
}
