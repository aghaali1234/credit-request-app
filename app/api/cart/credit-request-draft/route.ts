import { getServerSession } from "next-auth";

import {
  buildCreditRequestDraftText,
  buildCreditRequestMailtoUrl,
  CREDIT_REQUEST_RECIPIENT,
  type CreditRequestCartItem,
} from "@/lib/credit-request-email";
import { authOptions } from "@/lib/auth";
import { ensureCartDraftId, listDraftPhotos, resolveUserId } from "@/lib/cart-draft";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type PersistedPhotoRef = {
  fileName: string;
  publicUrl: string;
  storagePath: string;
};

type CustomerNameRow = {
  customer_name: string | null;
  free_txt: string | null;
};

type CustomerBpEmailRow = {
  bp_email: string | null;
  free_txt: string | null;
};

async function loadCustomerNameForDraft({
  salesperson,
  customerCode,
}: {
  salesperson: string;
  customerCode: string | null;
}) {
  if (!customerCode) {
    return null;
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("credit_rows")
    .select("customer_name,free_txt")
    .eq("salesperson", salesperson)
    .eq("customer_code", customerCode)
    .not("customer_name", "is", null)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Failed to load customer name for draft", error);
    return null;
  }

  return (data as CustomerNameRow | null)?.customer_name ?? null;
}

async function loadBpEmailsForDraft({
  salesperson,
  customerCodes,
}: {
  salesperson: string;
  customerCodes: string[];
}) {
  const normalizedCustomerCodes = [...new Set(customerCodes.map((code) => code.trim()).filter(Boolean))];

  if (normalizedCustomerCodes.length === 0) {
    return [];
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("credit_rows")
    .select("bp_email,free_txt")
    .eq("salesperson", salesperson)
    .in("customer_code", normalizedCustomerCodes)
    .not("bp_email", "is", null);

  if (error) {
    console.error("Failed to load customer BP email for draft", error);
    return [];
  }

  const uniqueEmails = new Set<string>();

  for (const row of (data ?? []) as CustomerBpEmailRow[]) {
    const bpEmail = row.bp_email?.trim();

    if (bpEmail) {
      uniqueEmails.add(bpEmail);
    }
  }

  return [...uniqueEmails];
}

function isValidCartItem(value: unknown): value is CreditRequestCartItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Partial<CreditRequestCartItem>;
  return (
    typeof item.id === "string" &&
    typeof item.customer_code === "string" &&
    typeof item.invoice_no === "string" &&
    (typeof item.invoice_date === "undefined" || item.invoice_date === null || typeof item.invoice_date === "string") &&
    typeof item.item_no === "string" &&
    typeof item.item_descp === "string" &&
    typeof item.quantity === "number" &&
    typeof item.sales_amount === "number" &&
    typeof item.piece_price === "number" &&
    (item.sales_batch_number === null || typeof item.sales_batch_number === "string") &&
    (item.sales_lot_no === null || typeof item.sales_lot_no === "string") &&
    (item.credit_type === "case" || item.credit_type === "piece") &&
    typeof item.credit_amount === "number" &&
    typeof item.created_at === "string" &&
    (typeof item.need_pickup === "undefined" || typeof item.need_pickup === "boolean")
  );
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.salespersonName) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = await resolveUserId(session);
  if (!userId) {
    return Response.json({ error: "Unauthorized: missing user id in session" }, { status: 401 });
  }

  const formData = await request.formData();
  const cartRowsRaw = formData.get("cartRows");
  const subjectRaw = formData.get("subject");
  const notesRaw = formData.get("notes");
  const subject = typeof subjectRaw === "string" && subjectRaw.trim().length > 0 ? subjectRaw.trim() : null;
  const notes = typeof notesRaw === "string" ? notesRaw.trim() : "";

  if (typeof cartRowsRaw !== "string") {
    return Response.json({ error: "Missing cart rows payload" }, { status: 400 });
  }

  let cartRowsCandidate: unknown;

  try {
    cartRowsCandidate = JSON.parse(cartRowsRaw) as unknown;
  } catch {
    return Response.json({ error: "Invalid cart rows JSON" }, { status: 400 });
  }

  if (!Array.isArray(cartRowsCandidate) || cartRowsCandidate.length === 0) {
    return Response.json({ error: "No cart rows provided" }, { status: 400 });
  }

  if (!subject) {
    return Response.json({ error: "Missing email subject" }, { status: 400 });
  }

  if (!cartRowsCandidate.every((item) => isValidCartItem(item))) {
    return Response.json({ error: "Invalid cart row fields" }, { status: 400 });
  }

  try {
    const cartRows = cartRowsCandidate as CreditRequestCartItem[];
    const draftId = await ensureCartDraftId({ userId, salesperson: session.user.salespersonName });
    const persistedPhotos = await listDraftPhotos(draftId);
    const customerName = await loadCustomerNameForDraft({
      salesperson: session.user.salespersonName,
      customerCode: cartRows[0]?.customer_code ?? null,
    });
    const bpEmailCcRecipients = await loadBpEmailsForDraft({
      salesperson: session.user.salespersonName,
      customerCodes: cartRows.map((row) => row.customer_code),
    });

    const uploadedPhotos: PersistedPhotoRef[] = persistedPhotos.map((photo) => ({
      fileName: photo.file_name,
      publicUrl: photo.public_url,
      storagePath: photo.storage_path,
    }));

    const draft = buildCreditRequestDraftText({
      cartRows,
      uploadedPhotos: uploadedPhotos.map((photo) => ({ fileName: photo.fileName, publicUrl: photo.publicUrl })),
      customerName,
      notes,
    });
    const mailtoDraft = buildCreditRequestMailtoUrl({
      subject,
      text: draft.text,
      ccRecipients: bpEmailCcRecipients,
    });

    return Response.json({
      ok: true,
      recipient: CREDIT_REQUEST_RECIPIENT,
      photos: uploadedPhotos,
      draft: {
        ...draft,
        subject,
      },
      mailtoUrl: mailtoDraft.url,
      isBodyTruncated: mailtoDraft.isBodyTruncated,
    });
  } catch (error) {
    console.error("Failed to prepare draft", error);
    return Response.json({ error: "Failed to prepare draft" }, { status: 500 });
  }
}
