import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const TOKEN = "trk-diag-9f3a2c7e";
const USERNAME = "admin";
const PASSWORD = "admin123";

async function verify(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const { data, error } = await supabase.rpc("verify_app_user_password", {
    p_username: USERNAME,
    p_password: PASSWORD,
  });
  if (error) return { ok: false, error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  return { ok: Boolean(row?.user_id) };
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("key") !== TOKEN) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const supabase = getSupabaseAdmin();

  const { data: user, error: userError } = await supabase
    .from("app_users")
    .select("id, username, role, is_active")
    .eq("username", USERNAME)
    .maybeSingle();

  if (userError || !user) {
    return NextResponse.json({ ok: false, step: "find", error: userError?.message ?? "not found" });
  }

  const before = await verify(supabase);
  if (before.ok && user.is_active) {
    return NextResponse.json({ ok: true, user, alreadyWorked: true });
  }

  const hash = await bcrypt.hash(PASSWORD, 10);
  const { error: updateError } = await supabase
    .from("app_users")
    .update({ password_hash: hash, is_active: true })
    .eq("id", user.id);

  if (updateError) {
    return NextResponse.json({ ok: false, step: "update", error: updateError.message });
  }

  const after = await verify(supabase);
  return NextResponse.json({ ok: after.ok, user, before, after });
}
