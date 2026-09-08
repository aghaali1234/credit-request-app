import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

// Temporary diagnostic endpoint. Guarded by a shared token so it is not
// publicly meaningful. Reports whether the server can reach Supabase and
// whether the login RPC responds — WITHOUT exposing any secret values.
export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key")
  if (key !== "trk-diag-9f3a2c7e") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_PUBLIC_URL ?? ""
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""

  const result: Record<string, unknown> = {
    hasUrl: Boolean(url),
    hasServiceKey: Boolean(serviceKey),
    hasNextAuthSecret: Boolean(process.env.NEXTAUTH_SECRET),
    urlHost: url ? new URL(url).host : null,
  }

  if (!url || !serviceKey) {
    result.verdict = "MISSING_SUPABASE_ENV"
    return NextResponse.json(result)
  }

  try {
    const supabase = createClient(url, serviceKey, {
      auth: { persistSession: false },
    })

    const usersRes = await supabase
      .from("app_users")
      .select("username", { count: "exact", head: true })
    result.appUsersError = usersRes.error?.message ?? null
    result.appUsersCount = usersRes.count ?? null

    const rpcRes = await supabase.rpc("verify_app_user_password", {
      p_username: "__diag__",
      p_password: "__diag__",
    })
    result.rpcError = rpcRes.error?.message ?? null
    result.rpcReturnedForFakeUser = rpcRes.data ?? null

    if (usersRes.error || rpcRes.error) {
      result.verdict = "DB_ERROR"
    } else {
      result.verdict = "DB_OK"
    }
  } catch (error) {
    result.verdict = "DB_UNREACHABLE"
    result.exception = error instanceof Error ? error.message : String(error)
  }

  return NextResponse.json(result)
}
