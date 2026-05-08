"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ChangeEvent, MouseEvent as ReactMouseEvent } from "react";

type CreditType = "case" | "piece";

type NotFromRecentInvoicesNoteProps = {
  customerCode: string;
};

type ItemLookupOption = {
  item_no: string;
  item_descp: string;
};

type LookupSearchBy = "item_no" | "item_descp";

export function NotFromRecentInvoicesNote({
  customerCode,
}: NotFromRecentInvoicesNoteProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [itemNo, setItemNo] = useState("");
  const [description, setDescription] = useState("");
  const [creditType, setCreditType] = useState<CreditType>("case");
  const [quantity, setQuantity] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [itemOptions, setItemOptions] = useState<ItemLookupOption[]>([]);
  const [isItemLookupLoading, setIsItemLookupLoading] = useState(false);
  const [activeLookupField, setActiveLookupField] =
    useState<LookupSearchBy | null>(null);
  const lookupAbortControllerRef = useRef<AbortController | null>(null);
  const lookupDebounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const pictureInputId = useId();
  const [isUploadingPicture, setIsUploadingPicture] = useState(false);
  const [pictureError, setPictureError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (lookupAbortControllerRef.current) {
        lookupAbortControllerRef.current.abort();
      }

      if (lookupDebounceTimeoutRef.current) {
        clearTimeout(lookupDebounceTimeoutRef.current);
      }
    };
  }, []);

  function resetLookupState() {
    setItemOptions([]);
    setActiveLookupField(null);
    setIsItemLookupLoading(false);
  }

  function loadItemOptions(searchValue: string, searchBy: LookupSearchBy) {
    const normalizedSearch = searchValue.trim();
    if (normalizedSearch.length < 2) {
      if (lookupAbortControllerRef.current) {
        lookupAbortControllerRef.current.abort();
      }
      if (lookupDebounceTimeoutRef.current) {
        clearTimeout(lookupDebounceTimeoutRef.current);
      }
      resetLookupState();
      return;
    }

    setActiveLookupField(searchBy);
    setIsItemLookupLoading(true);

    if (lookupAbortControllerRef.current) {
      lookupAbortControllerRef.current.abort();
    }
    if (lookupDebounceTimeoutRef.current) {
      clearTimeout(lookupDebounceTimeoutRef.current);
    }

    lookupDebounceTimeoutRef.current = setTimeout(async () => {
      const controller = new AbortController();
      lookupAbortControllerRef.current = controller;

      const response = await fetch(
        `/api/customers/${encodeURIComponent(customerCode)}/item-lookup?query=${encodeURIComponent(normalizedSearch)}&searchBy=${encodeURIComponent(searchBy)}`,
        { signal: controller.signal },
      ).catch(() => null);

      if (controller.signal.aborted) {
        return;
      }

      setIsItemLookupLoading(false);

      if (!response?.ok) {
        setItemOptions([]);
        return;
      }

      const payload = (await response.json().catch(() => null)) as {
        items?: ItemLookupOption[];
      } | null;
      const options = payload?.items ?? [];
      setItemOptions(options);
    }, 220);
  }

  function closeLookupDropdownWithDelay() {
    setTimeout(() => {
      setActiveLookupField(null);
    }, 120);
  }

  function applyItemOption(option: ItemLookupOption) {
    setItemNo(option.item_no);
    setDescription(option.item_descp);
    resetLookupState();
  }

  function openModal() {
    setSubmitError(null);
    setPictureError(null);
    resetLookupState();
    setIsModalOpen(true);
  }

  function closeModal() {
    if (isSubmitting || isUploadingPicture) {
      return;
    }

    setIsModalOpen(false);
  }

  function onPickPicture(event: ReactMouseEvent<HTMLLabelElement>) {
    if (isUploadingPicture || isSubmitting) {
      event.preventDefault();
      return;
    }

    const isConfirmed = window.confirm(
      "Please make sure LOT NUMBER is visible.",
    );
    if (!isConfirmed) {
      event.preventDefault();
    }
  }

  async function onPictureSelected(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (files.length === 0) {
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

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
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

  async function addNoteToCart() {
    const trimmedReason = reason.trim();

    if (trimmedReason.length === 0) {
      setSubmitError("Reason is required.");
      return;
    }

    const parsedAmount = Number(amount);
    const creditAmount = Number.isFinite(parsedAmount) ? parsedAmount : 0;
    const parsedQuantity = Number(quantity);
    const noteQuantity = Number.isFinite(parsedQuantity) ? parsedQuantity : 0;

    const trimmedDescription = description.trim();
    const itemDescription =
      trimmedDescription.length > 0
        ? `${trimmedDescription} | Reason: ${trimmedReason}`
        : `Reason: ${trimmedReason}`;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_code: customerCode,
          invoice_no: invoiceNo.trim() || "NOT_FROM_RECENT_INVOICES",
          invoice_date: null,
          item_no: itemNo.trim() || "NOT_FROM_RECENT_INVOICES",
          item_descp: itemDescription,
          quantity: noteQuantity,
          sales_amount: 0,
          sales_batch_number: null,
          sales_lot_no: null,
          batch_expiration_date: null,
          piece_price: 0,
          credit_type: creditType,
          credit_amount: creditAmount,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          details?: string;
          error?: string;
        } | null;
        setSubmitError(
          payload?.details ?? payload?.error ?? "Failed to add note to cart",
        );
        return;
      }

      setIsModalOpen(false);
      setInvoiceNo("");
      setItemNo("");
      setDescription("");
      setCreditType("case");
      setQuantity("");
      setAmount("");
      setReason("");
      resetLookupState();
      window.dispatchEvent(new Event("cart-updated"));
    } catch {
      setSubmitError("Failed to add note to cart");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div className="mt-5 rounded-md border border-zinc-200 dark:border-zinc-800 p-4">
        <h3 className="text-base font-semibold">Not from recent invoices</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
          Please add credit note if the item is not from the invoices above
        </p>

        <div className="mt-3">
          <button
            type="button"
            onClick={openModal}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white"
          >
            Add
          </button>
        </div>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-lg bg-white dark:bg-zinc-900 p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <h3 className="text-lg font-semibold">Add Credit Note</h3>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs"
              >
                Close
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <label className="block">
                <span className="mb-1 block text-zinc-700 dark:text-zinc-200">
                  Invoice No
                </span>
                <input
                  type="text"
                  value={invoiceNo}
                  onChange={(event) => setInvoiceNo(event.target.value)}
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-zinc-700 dark:text-zinc-200">
                  Item No
                </span>
                <div className="relative">
                  <input
                    type="text"
                    value={itemNo}
                    onChange={(event) => {
                      const value = event.target.value;
                      setItemNo(value);
                      loadItemOptions(value, "item_no");
                    }}
                    onFocus={() => setActiveLookupField("item_no")}
                    onBlur={closeLookupDropdownWithDelay}
                    className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2"
                  />
                  {activeLookupField === "item_no" && itemOptions.length > 0 ? (
                    <ul className="absolute z-10 mt-1 max-h-52 w-full overflow-y-auto rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 py-1 shadow-lg">
                      {itemOptions.map((option) => (
                        <li key={`${option.item_no}-${option.item_descp}`}>
                          <button
                            type="button"
                            onClick={() => applyItemOption(option)}
                            className="block w-full px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/60 dark:bg-zinc-900/40"
                          >
                            <p className="font-medium text-zinc-800 dark:text-zinc-100">
                              {option.item_no}
                            </p>
                            <p className="text-xs text-zinc-600 dark:text-zinc-300">
                              {option.item_descp}
                            </p>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                {isItemLookupLoading && activeLookupField === "item_no" ? (
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Searching items…
                  </p>
                ) : null}
              </label>

              <label className="block">
                <span className="mb-1 block text-zinc-700 dark:text-zinc-200">
                  Description
                </span>
                <div className="relative">
                  <input
                    type="text"
                    value={description}
                    onChange={(event) => {
                      const value = event.target.value;
                      setDescription(value);
                      loadItemOptions(value, "item_descp");
                    }}
                    onFocus={() => setActiveLookupField("item_descp")}
                    onBlur={closeLookupDropdownWithDelay}
                    className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2"
                  />
                  {activeLookupField === "item_descp" &&
                  itemOptions.length > 0 ? (
                    <ul className="absolute z-10 mt-1 max-h-52 w-full overflow-y-auto rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 py-1 shadow-lg">
                      {itemOptions.map((option) => (
                        <li
                          key={`${option.item_no}-${option.item_descp}-description`}
                        >
                          <button
                            type="button"
                            onClick={() => applyItemOption(option)}
                            className="block w-full px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/60 dark:bg-zinc-900/40"
                          >
                            <p className="font-medium text-zinc-800 dark:text-zinc-100">
                              {option.item_no}
                            </p>
                            <p className="text-xs text-zinc-600 dark:text-zinc-300">
                              {option.item_descp}
                            </p>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                {isItemLookupLoading && activeLookupField === "item_descp" ? (
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Searching items…
                  </p>
                ) : null}
              </label>

              <label className="block">
                <span className="mb-1 block text-zinc-700 dark:text-zinc-200">
                  Type
                </span>
                <select
                  value={creditType}
                  onChange={(event) =>
                    setCreditType(event.target.value as CreditType)
                  }
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2"
                >
                  <option value="case">case</option>
                  <option value="piece">piece</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-zinc-700 dark:text-zinc-200">
                  Quantity
                </span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-zinc-700 dark:text-zinc-200">
                  Amount
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-zinc-700 dark:text-zinc-200">
                  Reason*
                </span>
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2"
                  rows={3}
                />
              </label>
            </div>

            {submitError ? (
              <p className="mt-3 text-sm text-red-600">{submitError}</p>
            ) : null}
            {pictureError ? (
              <p className="mt-3 text-sm text-red-600">{pictureError}</p>
            ) : null}

            <input
              id={pictureInputId}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => void onPictureSelected(event)}
              disabled={isUploadingPicture || isSubmitting}
            />

            <div className="mt-4 flex justify-end gap-2">
              <label
                htmlFor={pictureInputId}
                onClick={onPickPicture}
                aria-disabled={isUploadingPicture || isSubmitting}
                className={`rounded-md border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm text-zinc-700 dark:text-zinc-200 ${
                  isUploadingPicture || isSubmitting
                    ? "cursor-not-allowed opacity-50"
                    : "cursor-pointer"
                }`}
              >
                {isUploadingPicture ? "Uploading..." : "Add Picture"}
              </label>
              <button
                type="button"
                onClick={() => void addNoteToCart()}
                disabled={isSubmitting || isUploadingPicture}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? "Adding..." : "Add"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
