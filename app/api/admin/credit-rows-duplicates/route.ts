import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { isAdminUser } from "@/lib/is-admin-user";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type RemoveDuplicatesRpcResponse = number | { deleted_count?: number } | null;

function getDeletedCount(data: RemoveDuplicatesRpcResponse) {
  if (typeof data === "number") {
    return data;
  }

  return data?.deleted_count ?? 0;
}

export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.salespersonName) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminUser(session.user.name)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.rpc("remove_duplicate_credit_rows");

  if (error) {
    console.error("Failed to remove duplicate credit_rows", error);
    return Response.json(
      {
        error:
          "Duplicate remove failed. Please make sure the remove_duplicate_credit_rows SQL function exists in Supabase.",
      },
      { status: 500 },
    );
  }

  return Response.json({ deletedRows: getDeletedCount(data) });
}
