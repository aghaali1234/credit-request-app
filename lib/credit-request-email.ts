export type CreditType = "case" | "piece";

export type CreditRequestCartItem = {
  id: string;
  customer_code: string;
  invoice_no: string;
  invoice_date?: string | null;
  item_no: string;
  item_descp: string;
  quantity: number;
  sales_amount: number;
  piece_price: number;
  sales_batch_number: string | null;
  sales_lot_no: string | null;
  credit_type: CreditType;
  credit_amount: number;
  created_at: string;
  need_pickup?: boolean;
};

export type UploadedPhotoReference = {
  fileName: string;
  publicUrl: string;
};

const CREDIT_REQUEST_RECIPIENT = "credit@turkanafood.com";
const CREDIT_REQUEST_CC_RECIPIENT = "yerdogan@turkanafood.com";

function money(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  if (maxLength <= 3) {
    return value.slice(0, maxLength);
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

function isEmailStandaloneReasonRow(itemDescription: string) {
  return itemDescription.trim().startsWith("Reason:");
}

function parseEmailReasonAndDescription(itemDescription: string) {
  const normalizedDescription = itemDescription.trim();

  if (normalizedDescription.startsWith("Reason:")) {
    const reason = normalizedDescription.replace(/^Reason:/, "").trim();
    return { description: "-", reason: reason.length > 0 ? reason : null };
  }

  const splitOnReason = normalizedDescription.split(/\s*\|\s*Reason:\s*/i);
  if (splitOnReason.length > 1) {
    const [descriptionPart, ...reasonParts] = splitOnReason;
    const reason = reasonParts.join(" | ").trim();
    return {
      description: descriptionPart.trim() || "-",
      reason: reason.length > 0 ? reason : null,
    };
  }

  return { description: normalizedDescription || "-", reason: null };
}

function toEmailReasonRowKey(item: CreditRequestCartItem) {
  return `${item.customer_code}::${item.invoice_no}::${item.item_no}`;
}

function compactText(value: string, maxLength: number) {
  return truncate((value || "-").replace(/\s+/g, " ").trim(), maxLength);
}

function formatSelectedItemBlock({
  item,
  description,
  reason,
}: {
  item: CreditRequestCartItem;
  description: string;
  reason: string;
}) {
  const pickupLabel = item.need_pickup ? "Yes" : "No";
  return [
    `Item: ${compactText(item.item_no || "-", 24)}`,
    `Desc: ${compactText(description, 52)}`,
    `Qty: ${String(item.quantity ?? 0)} Amount: ${money(Number(item.credit_amount ?? 0))}`,
    `Reason: ${compactText(reason || "-", 32)} Batch: ${compactText(item.sales_batch_number || "-", 20)} Lot: ${compactText(item.sales_lot_no || "-", 20)} Type: ${compactText(item.credit_type || "-", 8)} Pickup: ${pickupLabel}`,
  ];
}

function encodeMailtoValue(value: string) {
  return encodeURIComponent(value);
}

export function buildCreditRequestDraftText({
  cartRows,
  uploadedPhotos,
  customerName,
  notes,
}: {
  cartRows: CreditRequestCartItem[];
  uploadedPhotos: UploadedPhotoReference[];
  customerName?: string | null;
  notes?: string;
}) {
  const nonNoteItems = cartRows.filter((item) => !isEmailStandaloneReasonRow(item.item_descp));
  const reasonRowsByKey = new Map<string, string[]>();

  for (const item of cartRows) {
    if (!isEmailStandaloneReasonRow(item.item_descp)) {
      continue;
    }

    const parsed = parseEmailReasonAndDescription(item.item_descp);
    if (!parsed.reason) {
      continue;
    }

    const key = toEmailReasonRowKey(item);
    const existing = reasonRowsByKey.get(key) ?? [];
    existing.push(parsed.reason);
    reasonRowsByKey.set(key, existing);
  }

  const displayRows = nonNoteItems.map((item) => {
    const parsed = parseEmailReasonAndDescription(item.item_descp);
    const key = toEmailReasonRowKey(item);
    const queuedReason = reasonRowsByKey.get(key)?.shift() ?? null;

    return {
      item,
      description: parsed.description,
      reason: parsed.reason ?? queuedReason ?? "—",
    };
  });

  const uniqueCustomers = [...new Set(cartRows.map((item) => item.customer_code).filter(Boolean))];
  const uniqueInvoices = [...new Set(cartRows.map((item) => item.invoice_no).filter(Boolean))];
  const totalCreditAmount = cartRows.reduce((sum, item) => sum + Number(item.credit_amount || 0), 0);

  const subject = `Credit Request - Customer ${uniqueCustomers.join(", ") || "N/A"} - Invoice ${
    uniqueInvoices.join(", ") || "N/A"
  } - ${nonNoteItems.length} Item(s) - Total ${money(totalCreditAmount)}`;

  const selectedItemLines =
    displayRows.length > 0
      ? displayRows.flatMap(({ item, description, reason }, index) => [
          ...formatSelectedItemBlock({ item, description, reason }),
          ...(index < displayRows.length - 1 ? [""] : []),
        ])
      : ["No selected product rows found."];

  const textLines = [
    "Hello Credit Team,",
    "",
    ...(notes && notes.trim().length > 0 ? [notes.trim(), ""] : []),
    "Please review the credit request details below.",
    "",
    `Customer Code: ${uniqueCustomers.join(", ") || "-"}`,
    `Customer Name: ${compactText(customerName || "-", 64)}`,
    `Invoice No: ${uniqueInvoices.join(", ") || "-"}`,
    `Total Requested Credit Amount: ${money(totalCreditAmount)}`,
    "",
    ...selectedItemLines,
    "",
    "Photo:",
    ...(uploadedPhotos.some((photo) => Boolean(photo.publicUrl))
      ? uploadedPhotos.filter((photo) => Boolean(photo.publicUrl)).map((photo) => photo.publicUrl)
      : ["No hosted photo links available."]),
    "",
    "Thank you.",
  ];

  return {
    subject,
    text: textLines.join("\n"),
  };
}

export function buildCreditRequestMailtoUrl({ subject, text }: { subject: string; text: string }) {
  const buildUrl = (body: string) =>
    `mailto:${CREDIT_REQUEST_RECIPIENT}?cc=${encodeMailtoValue(CREDIT_REQUEST_CC_RECIPIENT)}&subject=${encodeMailtoValue(subject)}&body=${encodeMailtoValue(body)}`;
  return {
    url: buildUrl(text),
    isBodyTruncated: false,
  };
}

export { CREDIT_REQUEST_CC_RECIPIENT, CREDIT_REQUEST_RECIPIENT };
