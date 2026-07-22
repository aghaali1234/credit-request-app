import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { isAdminUser } from "@/lib/is-admin-user";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type RemoveDuplicatesRpcResponse = number | { deleted_count?: number } | null;

type SupabaseErrorDetails = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

function getDeletedCount(data: RemoveDuplicatesRpcResponse) {
  if (typeof data === "number") {
    return data;
  }

  return data?.deleted_count ?? 0;
}

function serializeSupabaseError(error: unknown): SupabaseErrorDetails {
  if (error && typeof error === "object") {
    const supabaseError = error as Partial<SupabaseErrorDetails>;

    return {
      message: supabaseError.message ?? "Supabase RPC request failed.",
      code: supabaseError.code,
      details: supabaseError.details,
      hint: supabaseError.hint,
    };
  }

  return { message: "Supabase RPC request failed." };
}

function getSupabaseProjectHost() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    return undefined;
  }

  try {
    return new URL(supabaseUrl).host;
  } catch {
    return "Invalid Supabase URL";
  }
}

export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.salespersonName) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminUser(session.user.name)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin.rpc("remove_duplicate_credit_rows");

    if (error) {
      const rpcError = serializeSupabaseError(error);

      console.error("Failed to remove duplicate credit_rows", {
        ...rpcError,
        supabaseProjectHost: getSupabaseProjectHost(),
        rawError: error,
      });

      return Response.json(
        {
          error: "Duplicate remove failed. Supabase RPC returned an error.",
          supabase: rpcError,
        },
        { status: 500 },
      );
    }

    return Response.json({ deletedRows: getDeletedCount(data) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";

    console.error("Failed to remove duplicate credit_rows", {
      message,
      supabaseProjectHost: getSupabaseProjectHost(),
      rawError: error,
    });

    return Response.json(
      {
        error: "Duplicate remove failed before the Supabase RPC could complete.",
        supabase: { message },
      },
      { status: 500 },
    );
  }
}
