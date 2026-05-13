"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";

import { useFreshFileInput } from "@/components/use-fresh-file-input";
import { formatUsdCurrency } from "@/lib/currency";

type InvoiceItem = {
  item_no: string;
  item_descp: string;
  quantity: number;
  sales_amount: number;
  sales_batch_number: string;
  sales_lot_no: string;
  batch_expiration_date: string;
  piece_price: number;
  free_txt?: string | null;
};

type CreditType = "case" | "piece";
type ReasonOption =
  | "Did Not Want / Refused"
  | "Damaged"
  | "Short Date Delivery"
  | "Molded"
  | "Sugared"
  | "Wrong Item / Price"
  | "Expired"
  | "Missing"
  | "Other";

const REASON_OPTIONS: ReasonOption[] = [
  "Did Not Want / Refused",
  "Damaged",
  "Short Date Delivery",
  "Molded",
  "Sugared",
  "Wrong Item / Price",
  "Expired",
  "Missing",
  "Other",
];

type ProductCreditRequestModalProps = {
  item: InvoiceItem;
  customerCode: string;
  invoiceNo: string;
  invoiceDate?: string | null;
  onClose: () => void;
};

export function ProductCreditRequestModal({ item, customerCode, invoiceNo, invoiceDate, onClose }: ProductCreditRequestModalProps) {
  const [creditType, setCreditType] = useState<CreditType>("case");
  const [caseCount, setCaseCount] = useState<string>("");
  const [piecesPerCase, setPiecesPerCase] = useState<string>("");
  const [requestedPieces, setRequestedPieces] = useState<string>("");
  const [selectedReason, setSelectedReason] = useState<ReasonOption | null>(null);
  const [otherReason, setOtherReason] = useState("");
  const [isReasonDropdownOpen, setIsReasonDropdownOpen] = useState(false);
  const [isMobileReasonSheetOpen, setIsMobileReasonSheetOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingPicture, setIsUploadingPicture] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pictureError, setPictureError] = useState<string | null>(null);
  const { fileInputKey: pictureInputKey, fileInputRef: pictureInputRef, resetFileInput: resetPictureInput } = useFreshFileInput();
  const reasonDropdownRef = useRef<HTMLDivElement | null>(null);

  const resetTransientPopupState = useCallback(() => {
    setIsSubmitting(false);
    setIsUploadingPicture(false);
    setSubmitError(null);
    setPictureError(null);
    setIsReasonDropdownOpen(false);
    setIsMobileReasonSheetOpen(false);
    resetPictureInput();
  }, [resetPictureInput]);

  useLayoutEffect(() => {
    return () => {
      resetTransientPopupState();
    };
  }, [resetTransientPopupState]);

  useEffect(() => {
    function resetAfterPageRestore() {
      resetTransientPopupState();
    }

    window.addEventListener("pageshow", resetAfterPageRestore);
    window.addEventListener("pagehide", resetAfterPageRestore);

    return () => {
      window.removeEventListener("pageshow", resetAfterPageRestore);
      window.removeEventListener("pagehide", resetAfterPageRestore);
    };
  }, [resetTransientPopupState]);

  useEffect(() => {
    if (!isReasonDropdownOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (!reasonDropdownRef.current?.contains(target)) {
        setIsReasonDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [isReasonDropdownOpen]);

  const numericCaseCount = Number(caseCount);
  const numericPiecesPerCase = Number(piecesPerCase);
  const numericRequestedPieces = Number(requestedPieces);

  const pieceUnitPrice = useMemo(() => {
    if (!Number.isFinite(numericPiecesPerCase) || numericPiecesPerCase <= 0) {
      return null;
    }

    return item.piece_price / numericPiecesPerCase;
  }, [item.piece_price, numericPiecesPerCase]);

  const caseCreditAmount = useMemo(() => {
    if (!Number.isFinite(numericCaseCount) || numericCaseCount <= 0) {
      return null;
    }

    if (numericCaseCount > item.quantity) {
      return null;
    }

    return item.piece_price * numericCaseCount;
  }, [item.piece_price, item.quantity, numericCaseCount]);

  const pieceCreditAmount = useMemo(() => {
    if (!pieceUnitPrice || !Number.isFinite(numericRequestedPieces) || numericRequestedPieces <= 0) {
      return null;
    }

    return pieceUnitPrice * numericRequestedPieces;
  }, [pieceUnitPrice, numericRequestedPieces]);

  const autoCreditAmount = creditType === "case" ? caseCreditAmount : pieceCreditAmount;

  async function addSelectedItemToCart() {
    if (autoCreditAmount === null || !Number.isFinite(autoCreditAmount)) {
      return;
    }

    if (creditType === "case" && numericCaseCount > item.quantity) {
      setSubmitError(`Case quantity cannot be greater than ${item.quantity}.`);
      return;
    }

    if (!selectedReason) {
      setSubmitError("Please select at least one reason.");
      return;
    }

    const resolvedReasons: string[] = [
      ...(selectedReason !== "Other" ? [selectedReason] : []),
      ...(selectedReason === "Other" && otherReason.trim().length > 0 ? [otherReason.trim()] : []),
    ];

    if (resolvedReasons.length === 0) {
      setSubmitError("Please enter a reason for Other.");
      return;
    }

    const requestedQuantity = creditType === "case" ? numericCaseCount : numericRequestedPieces;
    if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0) {
      setSubmitError("Please enter a valid requested quantity.");
      return;
    }

    const itemDescriptionWithReason = `${item.item_descp} | Reason: ${resolvedReasons.join(" - ")}`;

    setIsSubmitting(true);
    setSubmitError(null);
    const response = await fetch("/api/cart", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customer_code: customerCode,
        invoice_no: invoiceNo,
        invoice_date: invoiceDate ?? null,
        item_no: item.item_no,
        item_descp: itemDescriptionWithReason,
        quantity: requestedQuantity,
        sales_amount: item.sales_amount,
        sales_batch_number: item.sales_batch_number,
        sales_lot_no: item.sales_lot_no,
        batch_expiration_date: item.batch_expiration_date,
        piece_price: item.piece_price,
        credit_type: creditType,
        credit_amount: autoCreditAmount,
      }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { details?: string; error?: string } | null;
      setSubmitError(payload?.details ?? payload?.error ?? "Failed to add item to cart");
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    window.dispatchEvent(new Event("cart-updated"));
    onClose();
  }

  function onPickPicture(event: ReactMouseEvent<HTMLButtonElement>) {
    if (isUploadingPicture || isSubmitting) {
      event.preventDefault();
      return;
    }

    setPictureError(null);
    pictureInputRef.current?.click();
  }

  async function onPictureSelected(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (files.length === 0) {
      return;
    }

    const isConfirmed = window.confirm("Please make sure LOT NUMBER is visible.");
    if (!isConfirmed) {
      return;
    }

    setIsUploadingPicture(true);
    setPictureError(null);

    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append("photos", file);
      });

      const response = await fetch("/api/cart/photos", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setPictureError(payload?.error ?? "Failed to upload picture.");
        return;
      }

      window.dispatchEvent(new Event("cart-photos-updated"));
    } catch {
      setPictureError("Failed to upload picture.");
    } finally {
      setIsUploadingPicture(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/40 p-2 sm:p-4">
      <div className="max-h-[calc(100dvh-1rem)] w-full max-w-[min(42rem,calc(100dvh-1rem))] overflow-y-auto rounded-lg bg-white p-3 shadow-xl dark:bg-zinc-900 sm:max-h-[90dvh] sm:p-5">
        <div className="mb-3 flex items-start justify-between gap-3 sm:mb-4">
          <h3 className="text-base font-semibold sm:text-lg">Product Detail & Credit Request</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs"
          >
            Close
          </button>
        </div>

        <section className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50/80 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/40">
          <div className="border-b border-zinc-200/80 bg-white/80 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/70">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">Product details</p>
                <h4 className="mt-1 line-clamp-2 text-sm font-semibold leading-tight text-zinc-950 dark:text-zinc-50 sm:text-base">
                  {item.item_descp}
                </h4>
              </div>
              <div className="shrink-0 rounded-full border border-zinc-200 bg-white px-2 py-1 text-xs font-semibold text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100">
                #{item.item_no}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 p-2 sm:p-3">
            <div className="rounded-md border border-zinc-200 bg-white px-2.5 py-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
              <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Quantity</p>
              <p className="mt-1 text-sm font-semibold text-zinc-950 dark:text-zinc-50">{item.quantity}</p>
            </div>
            <div className="rounded-md border border-zinc-200 bg-white px-2.5 py-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
              <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Sales Amount</p>
              <p className="mt-1 text-sm font-semibold text-zinc-950 dark:text-zinc-50">{formatUsdCurrency(item.sales_amount)}</p>
            </div>
            <div className="rounded-md border border-zinc-200 bg-white px-2.5 py-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
              <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Sales Lot No</p>
              <p className="mt-1 truncate text-sm font-semibold text-zinc-950 dark:text-zinc-50">{item.sales_lot_no}</p>
            </div>
            <div className="rounded-md border border-zinc-200 bg-white px-2.5 py-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
              <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Expiration</p>
              <p className="mt-1 truncate text-sm font-semibold text-zinc-950 dark:text-zinc-50">{item.batch_expiration_date}</p>
            </div>
            <div className="col-span-2 rounded-md border border-zinc-200 bg-white px-2.5 py-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Case Price</p>
                <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                  {formatUsdCurrency(item.piece_price)}
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800 sm:mt-5 sm:p-4">
          <h4 className="mb-2 font-semibold sm:mb-3">Reason</h4>
          <div className="sm:hidden">
            <button
              type="button"
              onClick={() => setIsMobileReasonSheetOpen(true)}
              className="flex w-full items-center justify-between rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-left text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-800/60"
            >
              <span className="truncate">{selectedReason ?? "Select reason"}</span>
              <span className="ml-3 text-xs text-zinc-500 dark:text-zinc-400">›</span>
            </button>
          </div>

          <div ref={reasonDropdownRef} className="relative hidden sm:block">
            <button
              type="button"
              onClick={() => setIsReasonDropdownOpen((previous) => !previous)}
              className="flex w-full items-center justify-between rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-left text-sm"
            >
              <span className="truncate">
                {selectedReason ?? "Select reason"}
              </span>
              <span className="ml-3 text-xs text-zinc-500 dark:text-zinc-400">{isReasonDropdownOpen ? "▲" : "▼"}</span>
            </button>

            <div
              className={`absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-zinc-300 bg-white p-2 shadow-lg transition-all duration-200 ease-out dark:border-zinc-700 dark:bg-zinc-900 ${
                isReasonDropdownOpen
                  ? "pointer-events-auto translate-y-0 opacity-100"
                  : "pointer-events-none -translate-y-1 opacity-0"
              }`}
            >
              <div className="grid gap-2 text-sm">
                {REASON_OPTIONS.map((option) => {
                  const checked = selectedReason === option;
                  return (
                    <label key={option} className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="credit-request-reason"
                        checked={checked}
                        onChange={(event) => {
                          if (event.target.checked) {
                            setSelectedReason(option);
                            setIsReasonDropdownOpen(false);
                            if (option !== "Other") {
                              setOtherReason("");
                            }
                          }
                        }}
                      />
                      {option}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {isMobileReasonSheetOpen ? (
            <div className="fixed inset-0 z-[60] sm:hidden">
              <button
                type="button"
                onClick={() => setIsMobileReasonSheetOpen(false)}
                className="absolute inset-0 bg-black/40"
                aria-label="Close reason selector"
              />
              <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white p-4 shadow-2xl dark:bg-zinc-900">
                <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                <div className="mb-3 flex items-center justify-between">
                  <h5 className="text-base font-semibold">Select Reason</h5>
                  <button
                    type="button"
                    onClick={() => setIsMobileReasonSheetOpen(false)}
                    className="rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700"
                  >
                    Done
                  </button>
                </div>
                <div className="max-h-[50vh] space-y-2 overflow-y-auto pb-2">
                  {REASON_OPTIONS.map((option) => {
                    const checked = selectedReason === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => {
                          setSelectedReason(option);
                          if (option !== "Other") {
                            setOtherReason("");
                          }
                          setIsMobileReasonSheetOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm ${
                          checked
                            ? "border-zinc-900 bg-zinc-100 dark:border-zinc-100 dark:bg-zinc-800"
                            : "border-zinc-300 dark:border-zinc-700"
                        }`}
                      >
                        <span>{option}</span>
                        {checked ? <span className="text-xs">✓</span> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}

          {selectedReason === "Other" ? (
            <label className="mt-3 block text-sm">
              <span className="mb-1 block text-zinc-700 dark:text-zinc-200">Other reason</span>
              <input
                type="text"
                value={otherReason}
                onChange={(event) => setOtherReason(event.target.value)}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2"
              />
            </label>
          ) : null}
        </div>

        <div className="mt-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800 sm:mt-5 sm:p-4">
          <h4 className="mb-2 font-semibold sm:mb-3">Credit Request Amount</h4>

          <div className="mb-3 flex gap-4 text-sm sm:mb-4">
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="credit-type"
                checked={creditType === "case"}
                onChange={() => setCreditType("case")}
              />
              Case credit
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="credit-type"
                checked={creditType === "piece"}
                onChange={() => setCreditType("piece")}
              />
              Piece credit
            </label>
          </div>

          {creditType === "case" ? (
            <div className="space-y-2 text-sm">
              <label className="block">
                <span className="mb-1 block text-zinc-700 dark:text-zinc-200">Case Quantity</span>
                <input
                  type="number"
                  min="0"
                  max={item.quantity}
                  step="1"
                  value={caseCount}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    const nextCaseCount = Number(nextValue);
                    if (!Number.isFinite(nextCaseCount)) {
                      setCaseCount("");
                      return;
                    }

                    if (nextCaseCount > item.quantity) {
                      setCaseCount(String(item.quantity));
                      return;
                    }

                    setCaseCount(nextValue);
                  }}
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2"
                />
              </label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Maximum allowed: {item.quantity}</p>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <label className="block">
                <span className="mb-1 block text-zinc-700 dark:text-zinc-200">Pieces Per Case</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={piecesPerCase}
                  onChange={(event) => setPiecesPerCase(event.target.value.replace(/\D/g, ""))}
                  placeholder="How many piece are in one case"
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-zinc-700 dark:text-zinc-200">Requested Piece Quantity</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={requestedPieces}
                  onChange={(event) => setRequestedPieces(event.target.value.replace(/\D/g, ""))}
                  placeholder="How any pieces are requested for credit"
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2"
                />
              </label>
            </div>
          )}

          <div className="mt-3 rounded-md bg-zinc-50 p-2.5 text-sm dark:bg-zinc-900/40 sm:mt-4 sm:p-3">
            <p className="font-medium">Calculated Credit Request Amount</p>
            <p className="mt-1 text-lg font-semibold">
              {autoCreditAmount !== null && Number.isFinite(autoCreditAmount)
                ? autoCreditAmount.toFixed(2)
                : "Please fill in required fields"}
            </p>
          </div>

          {submitError ? <p className="mt-3 text-sm text-red-600">{submitError}</p> : null}
          {pictureError ? <p className="mt-3 text-sm text-red-600">{pictureError}</p> : null}

          <input
            key={pictureInputKey}
            ref={pictureInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => void onPictureSelected(event)}
            disabled={isUploadingPicture || isSubmitting}
          />

          <div className="mt-3 flex justify-end gap-2 sm:mt-4">
            <button
              type="button"
              onClick={onPickPicture}
              disabled={isUploadingPicture || isSubmitting}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200"
            >
              {isUploadingPicture ? "Uploading..." : "Add Photos"}
            </button>
            <button
              type="button"
              onClick={() => void addSelectedItemToCart()}
              disabled={
                autoCreditAmount === null ||
                !Number.isFinite(autoCreditAmount) ||
                isSubmitting ||
                isUploadingPicture
              }
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Adding..." : "Add"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export type { InvoiceItem };
