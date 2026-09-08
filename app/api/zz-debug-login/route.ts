import { NextResponse, type NextRequest } from "next/server"

export const dynamic = "force-dynamic"

const DEBUG_SECRET = "trk-diag-9f3a2c7e"

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("key") !== DEBUG_SECRET) {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
  const out: Record<string, unknown> = {
    urlHost: url ? new URL(url).host : "(EMPTY)",
    serviceKeyPresent: Boolean(key),
    serviceKeyLen: key.length,
    nextAuthSecretPresent: Boolean(process.env.NEXTAUTH_SECRET),
    nextAuthUrl: process.env.NEXTAUTH_URL ?? "(EMPTY)",
    resendPresent: Boolean(process.env.RESEND_API_KEY),
  }

  if (!url || !key) {
    return NextResponse.json({ ...out, note: "missing supabase env in runtime" }, { status: 200 })
  }

  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" }

  try {
    const usersRes = await fetch(
      `${url}/rest/v1/app_users?select=username,salesperson_name,is_active&order=username`,
      { headers, cache: "no-store" },
    )
    const usersText = await usersRes.text()
    let userCount: number | string = "n/a"
    let sample: unknown = usersText.slice(0, 800)
    try {
      const rows = JSON.parse(usersText)
      if (Array.isArray(rows)) {
        userCount = rows.length
        sample = rows.slice(0, 60).map((r: { username?: string; is_active?: boolean }) => ({
          username: r.username,
          is_active: r.is_active,
        }))
      }
    } catch {
      // keep raw text
    }
    out.appUsersStatus = usersRes.status
    out.appUsersCount = userCount
    out.appUsersSample = sample

    const rpcRes = await fetch(`${url}/rest/v1/rpc/verify_app_user_password`, {
      method: "POST",
      headers,
      body: JSON.stringify({ p_username: "__nonexistent_probe__", p_password: "x" }),
      cache: "no-store",
    })
    out.rpcStatus = rpcRes.status
    out.rpcBody = (await rpcRes.text()).slice(0, 800)
  } catch (error) {
    out.error = error instanceof Error ? error.message : String(error)
  }

  return NextResponse.json(out, { status: 200 })
}
