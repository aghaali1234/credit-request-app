import { getAdminSession } from "@/lib/admin-auth";
import { chunkRecords, transformCsv } from "@/lib/credit-rows-upload";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const DEFAULT_BATCH_SIZE = 500;

export async function POST(request: Request) {
  const { response } = await getAdminSession();

  if (response) {
    return response;
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "CSV file is required." }, { status: 400 });
  }

  if (!file.name.toLowerCase().endsWith(".csv")) {
    return Response.json(
      { error: "Only CSV files can be uploaded." },
      { status: 400 },
    );
  }

  try {
    const csvText = await file.text();
    const { records, recognizedColumns, missingColumns } =
      transformCsv(csvText);
    const batchSize =
      Number(process.env.BATCH_SIZE ?? DEFAULT_BATCH_SIZE) ||
      DEFAULT_BATCH_SIZE;
    const batches = chunkRecords(records, batchSize);
    const supabaseAdmin = getSupabaseAdmin();

    for (const batch of batches) {
      const { error } = await supabaseAdmin
        .from(process.env.TABLE_NAME ?? "credit_rows")
        .insert(batch);

      if (error) {
        console.error("Failed to upload credit_rows batch", error);
        return Response.json(
          { error: `Upload failed: ${error.message}` },
          { status: 500 },
        );
      }
    }

    return Response.json({
      fileName: file.name,
      rowsUploaded: records.length,
      batches: batches.length,
      batchSize,
      recognizedColumns,
      missingColumns,
      uploadedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "CSV upload failed.";
    return Response.json({ error: message }, { status: 400 });
  }
}
