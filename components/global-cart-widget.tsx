"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ChangeEvent, MouseEvent as ReactMouseEvent } from "react";
import Image from "next/image";
import { cleanupDocumentInteractionState, MODAL_NAVIGATION_CLEANUP_EVENT } from "@/components/navigation-modal-cleanup";
import type { CreditRequestCartItem } from "@/lib/credit-request-email";

type CartItem = CreditRequestCartItem;

type DraftResponse = {
  recipient: string;
  mailtoUrl: string;
  isBodyTruncated: boolean;
  draft: {
    subject: string;
    text: string;
  };
  photos: Array<{
    fileName: string;
    publicUrl: string;
    storagePath: string;
  }>;
};

type CartPhoto = {
  id: string;
  fileName: string;
  publicUrl: string;
  storagePath: string;
  createdAt?: string;
  previewUrl?: string;
};

type DisplayCartRow = CartItem & {
  displayDescription: string;
  reason: string | null;
};

function isStandaloneReasonRow(item: CartItem) {
  return item.item_descp.trim().startsWith("Reason:");
}

function parseReasonAndDescription(itemDescription: string) {
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

function toReasonRowKey(item: CartItem) {
  return `${item.customer_code}::${item.invoice_no}::${item.item_no}`;
}


export function GlobalCartWidget() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [authorized, setAuthorized] = useState(true);
  const [pictures, setPictures] = useState<CartPhoto[]>([]);
  const [selectedPicture, setSelectedPicture] = useState<CartPhoto | null>(null);
  const [isPreviewImageBroken, setIsPreviewImageBroken] = useState(false);
  const [isUploadingPictures, setIsUploadingPictures] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isRemovingAll, setIsRemovingAll] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [removeAllError, setRemoveAllError] = useState<string | null>(null);
  const [pendingPictureFiles, setPendingPictureFiles] = useState<File[]>([]);
  const [isPhotoUploadConfirmOpen, setIsPhotoUploadConfirmOpen] = useState(false);
  const [isRemoveAllConfirmOpen, setIsRemoveAllConfirmOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [pickupSelectionsById, setPickupSelectionsById] = useState<Record<string, boolean>>({});
  const [cartInteractionRevision, setCartInteractionRevision] = useState(0);
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const cartRows = useMemo(() => {
    const isManualNote = (item: CartItem) => isStandaloneReasonRow(item);
    const regularItems = items.filter((item) => !isManualNote(item));
    const noteItems = items.filter((item) => isManualNote(item));
    return [...regularItems, ...noteItems];
  }, [items]);

  const displayRows = useMemo<DisplayCartRow[]>(() => {
    const reasonRowsByKey = new Map<string, string[]>();

    for (const item of items) {
      if (!isStandaloneReasonRow(item)) {
        continue;
      }

      const parsed = parseReasonAndDescription(item.item_descp);
      if (!parsed.reason) {
        continue;
      }

      const key = toReasonRowKey(item);
      const existing = reasonRowsByKey.get(key) ?? [];
      existing.push(parsed.reason);
      reasonRowsByKey.set(key, existing);
    }

    return items
      .filter((item) => !isStandaloneReasonRow(item))
      .map((item) => {
        const parsed = parseReasonAndDescription(item.item_descp);
        const key = toReasonRowKey(item);
        const queuedReason = reasonRowsByKey.get(key)?.shift() ?? null;

        return {
          ...item,
          displayDescription: parsed.description,
          reason: parsed.reason ?? queuedReason,
        };
      });
  }, [items]);

  const cartItemCount = useMemo(() => {
    const regularRows = items.filter((item) => !isStandaloneReasonRow(item));
    const regularKeys = new Set(regularRows.map((item) => toReasonRowKey(item)));
    const standaloneRowsWithoutRegularPair = items.filter(
      (item) => isStandaloneReasonRow(item) && !regularKeys.has(toReasonRowKey(item)),
    );

    return regularRows.length + standaloneRowsWithoutRegularPair.length;
  }, [items]);

  const totalCreditAmount = useMemo(() => {
    return displayRows.reduce((sum, item) => sum + Number(item.credit_amount || 0), 0);
  }, [displayRows]);

  const loadCart = useCallback(async () => {
    const response = await fetch("/api/cart", { cache: "no-store" });

    if (response.status === 401) {
      setAuthorized(false);
      return;
    }

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as { items?: CartItem[] };
    const nextItems = payload.items ?? [];
    setItems(nextItems);
    setPickupSelectionsById((prev) => {
      const next: Record<string, boolean> = {};
      for (const item of nextItems) {
        next[item.id] = prev[item.id] ?? false;
      }
      return next;
    });
    setAuthorized(true);
  }, []);

  const loadPhotos = useCallback(async () => {
    const response = await fetch("/api/cart/photos", { cache: "no-store" });

    if (response.status === 401) {
      setAuthorized(false);
      return;
    }

    if (!response.ok) {
      setPhotoError("Unable to load saved photos.");
      return;
    }

    const payload = (await response.json()) as { photos?: CartPhoto[] };
    setPictures(payload.photos ?? []);
    setPhotoError(null);
    setAuthorized(true);
  }, []);

  const refreshCartInteractionState = useCallback(() => {
    // Mobile bfcache restores can keep stale DOM listeners until React commits a
    // fresh tree. Bump a key synchronously instead of relying on a deferred
    // requestAnimationFrame callback that may run while the modal is closed or
    // while the page is frozen.
    setCartInteractionRevision((currentRevision) => currentRevision + 1);
  }, []);

  const resetCartTransientUiState = useCallback(() => {
    setIsSending(false);
    setIsRemovingAll(false);
    setIsUploadingPictures(false);
    setSelectedPicture(null);
    setIsPreviewImageBroken(false);
    setPendingPictureFiles([]);
    setIsPhotoUploadConfirmOpen(false);
    setIsRemoveAllConfirmOpen(false);
    setSendError(null);
    setRemoveAllError(null);
    refreshCartInteractionState();
  }, [refreshCartInteractionState]);

  const reinitializeCartUi = useCallback(() => {
    cleanupDocumentInteractionState();
    resetCartTransientUiState();
    void loadCart();
    void loadPhotos();
  }, [loadCart, loadPhotos, resetCartTransientUiState]);

  const closeCartModal = useCallback(() => {
    setIsOpen(false);
    resetCartTransientUiState();
    cleanupDocumentInteractionState();
  }, [resetCartTransientUiState]);

  const openCartModal = useCallback(() => {
    window.dispatchEvent(new Event(MODAL_NAVIGATION_CLEANUP_EVENT));
    reinitializeCartUi();
    setIsOpen(true);
  }, [reinitializeCartUi]);

  async function deleteCartItemById(id: string) {
    const response = await fetch(`/api/cart?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });

    return response.ok;
  }

  async function removeItem(id: string) {
    const selectedItem = items.find((item) => item.id === id);
    if (!selectedItem) {
      return;
    }

    const linkedReasonRows = items.filter(
      (item) => isStandaloneReasonRow(item) && toReasonRowKey(item) === toReasonRowKey(selectedItem),
    );

    const didRemoveMainItem = await deleteCartItemById(id);
    if (!didRemoveMainItem) {
      return;
    }

    if (linkedReasonRows.length > 0) {
      await Promise.all(linkedReasonRows.map((reasonRow) => deleteCartItemById(reasonRow.id)));
    }

    await loadCart();
  }

  function onPickPictures(event: ReactMouseEvent<HTMLButtonElement>) {
    if (isUploadingPictures || isPhotoUploadConfirmOpen) {
      event.preventDefault();
      return;
    }

    setPhotoError(null);
    fileInputRef.current?.click();
  }

  async function uploadSelectedPictures(files: File[]) {
    if (files.length === 0) {
      return;
    }

    setPhotoError(null);
    setIsUploadingPictures(true);

    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append("photos", file);
      });

      const response = await fetch("/api/cart/photos", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as { photos?: CartPhoto[]; error?: string };
      if (!response.ok) {
        setPhotoError(payload.error ?? "Failed to upload photos.");
        return;
      }

      if (payload.photos?.length) {
        await loadPhotos();
      }
    } catch {
      setPhotoError("Failed to upload photos.");
    } finally {
      setIsUploadingPictures(false);
    }
  }

  function onPicturesSelected(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (files.length === 0) {
      return;
    }

    setPendingPictureFiles(files);
    setIsPhotoUploadConfirmOpen(true);
  }

  async function confirmPictureUpload() {
    const files = pendingPictureFiles;
    setPendingPictureFiles([]);
    setIsPhotoUploadConfirmOpen(false);
    await uploadSelectedPictures(files);
  }

  function cancelPictureUpload() {
    setPendingPictureFiles([]);
    setIsPhotoUploadConfirmOpen(false);
  }

  async function removePicture(photoId: string) {
    const response = await fetch("/api/cart/photos", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoId }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setPhotoError(payload?.error ?? "Failed to remove photo.");
      return;
    }

    setPhotoError(null);
    setPictures((previousPictures) => previousPictures.filter((picture) => picture.id !== photoId));
    setSelectedPicture((currentPicture) => (currentPicture?.id === photoId ? null : currentPicture));
  }

  function removeAllFromCart() {
    if ((items.length === 0 && pictures.length === 0) || isRemovingAll) {
      return;
    }

    setRemoveAllError(null);
    setIsRemoveAllConfirmOpen(true);
  }

  async function confirmRemoveAllFromCart() {
    if ((items.length === 0 && pictures.length === 0) || isRemovingAll) {
      return;
    }

    setIsRemoveAllConfirmOpen(false);
    const wasRemoved = await clearCartData();
    if (!wasRemoved) {
      setRemoveAllError("Failed to remove all cart data.");
    }
  }

  function cancelRemoveAllFromCart() {
    setIsRemoveAllConfirmOpen(false);
  }

  async function clearCartData() {
    setIsRemovingAll(true);
    setRemoveAllError(null);
    setSendError(null);

    try {
      const response = await fetch("/api/cart", { method: "DELETE" });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setRemoveAllError(payload?.error ?? "Failed to remove all cart data.");
        return false;
      }

      setSelectedPicture(null);
      setItems([]);
      setPictures([]);
      setPendingPictureFiles([]);
      setIsPhotoUploadConfirmOpen(false);
      setIsRemoveAllConfirmOpen(false);
      setNotes("");
      setPhotoError(null);
      await loadCart();
      await loadPhotos();
      return true;
    } catch {
      setRemoveAllError("Failed to remove all cart data.");
      return false;
    } finally {
      setIsRemovingAll(false);
    }
  }

  async function sendCreditRequest() {
    if (cartRows.length === 0 || isSending) {
      return;
    }

    const hasMissingRequiredItemData = cartRows.some(
      (item) => !item.customer_code || !item.invoice_no || !item.item_no || !item.item_descp,
    );

    if (hasMissingRequiredItemData) {
      setSendError("Unable to prepare draft. Some cart fields are missing required values.");
      return;
    }

    setIsSending(true);
    setSendError(null);

    try {
      const now = new Date();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      const yy = String(now.getFullYear()).slice(-2);
      const todayMMDDYY = `${mm}${dd}${yy}`;
      const customerCode = cartRows[0]?.customer_code?.trim() || "UNKNOWN";
      const subject = `Credit request: ${customerCode}-${todayMMDDYY}`;

      const formData = new FormData();
      const cartRowsWithPickup = cartRows.map((item) => ({
        ...item,
        need_pickup: Boolean(pickupSelectionsById[item.id]),
      }));
      formData.set("cartRows", JSON.stringify(cartRowsWithPickup));
      formData.set("subject", subject);
      formData.set("notes", notes.trim());

      const response = await fetch("/api/cart/credit-request-draft", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as DraftResponse & { error?: string };

      if (!response.ok) {
        setSendError(payload.error ?? "Failed to prepare draft.");
        return;
      }

      if (!payload.mailtoUrl) {
        setSendError("Unable to prepare email draft link.");
        return;
      }

      const wasCartCleared = await clearCartData();
      if (!wasCartCleared) {
        setSendError("Email draft was prepared, but cart could not be cleared. Please use Remove All.");
        return;
      }

      window.location.assign(payload.mailtoUrl);
    } catch {
      setSendError("Failed to prepare the email draft.");
    } finally {
      setIsSending(false);
    }
  }

  useEffect(() => {
    if (!isOpen && !selectedPicture) {
      cleanupDocumentInteractionState();
    }

    return () => {
      cleanupDocumentInteractionState();
    };
  }, [isOpen, selectedPicture]);

  useEffect(() => {
    function restoreCleanInteractiveState() {
      closeCartModal();
    }

    window.addEventListener(MODAL_NAVIGATION_CLEANUP_EVENT, restoreCleanInteractiveState);

    return () => {
      window.removeEventListener(MODAL_NAVIGATION_CLEANUP_EVENT, restoreCleanInteractiveState);
      cleanupDocumentInteractionState();
    };
  }, [closeCartModal]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadCart();
      void loadPhotos();
    }, 0);

    function handleUpdated() {
      void loadCart();
    }

    function handlePhotosUpdated() {
      void loadPhotos();
    }

    function handlePageShow() {
      reinitializeCartUi();
    }

    function handlePageHide() {
      resetCartTransientUiState();
    }

    window.addEventListener("cart-updated", handleUpdated);
    window.addEventListener("cart-photos-updated", handlePhotosUpdated);
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("cart-updated", handleUpdated);
      window.removeEventListener("cart-photos-updated", handlePhotosUpdated);
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [loadCart, loadPhotos, reinitializeCartUi, resetCartTransientUiState]);

  useEffect(() => {
    if (!selectedPicture) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedPicture(null);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedPicture]);

  if (!authorized) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={openCartModal}
        className="fixed bottom-4 right-4 z-40 inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-lg shadow-slate-900/10 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-zinc-900 dark:text-slate-200 dark:hover:bg-slate-800/60"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="9" cy="20" r="1.25" />
          <circle cx="17" cy="20" r="1.25" />
          <path d="M3 4h2l2.3 10.2a1 1 0 0 0 1 .8h8.7a1 1 0 0 0 1-.8L20 8H7" />
        </svg>
        <span>Cart ({cartItemCount})</span>
      </button>

      {isOpen ? (
        <div
          key={cartInteractionRevision}
          className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/60 px-3 py-4 backdrop-blur-sm sm:px-6 md:py-8"
          data-interaction-revision={cartInteractionRevision}
        >
          <div className="mx-auto flex max-h-[calc(100vh-2rem)] w-full max-w-[1180px] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20 dark:border-slate-700 dark:bg-zinc-900 md:max-h-[calc(100vh-4rem)]">
            <div className="border-b border-slate-200 bg-white/95 px-5 py-5 dark:border-slate-700 dark:bg-zinc-900/95 md:px-8">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Credit Request Cart</h3>
                </div>
                <div className="grid w-full grid-cols-3 items-center gap-2 lg:flex lg:w-auto lg:justify-end">
                  <button
                    type="button"
                    onClick={() => void sendCreditRequest()}
                    disabled={displayRows.length === 0 || isSending || isRemovingAll}
                    className="inline-flex h-9 min-w-0 items-center justify-center truncate whitespace-nowrap rounded-lg bg-slate-900 px-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3 lg:min-w-[132px] dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
                  >
                    <span className="truncate">{isSending ? "Preparing..." : "Send Credit"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={removeAllFromCart}
                    disabled={(items.length === 0 && pictures.length === 0) || isRemovingAll}
                    className="inline-flex h-9 min-w-0 items-center justify-center truncate whitespace-nowrap rounded-lg border border-rose-300 bg-rose-50 px-2.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3 lg:min-w-[104px]"
                  >
                    <span className="truncate">{isRemovingAll ? "Removing..." : "Remove All"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={closeCartModal}
                    className="inline-flex h-9 min-w-0 items-center justify-center truncate whitespace-nowrap rounded-lg border border-slate-300 px-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 sm:px-3 lg:min-w-[80px] dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200 dark:hover:bg-slate-800/60"
                  >
                    <span className="truncate">Close</span>
                  </button>
                </div>
              </div>

            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-6 md:px-8">
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-900/50 sm:px-4">
                <div className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 shadow-sm dark:bg-zinc-900 sm:flex-none sm:min-w-[120px] sm:gap-4">
                  <span className="truncate text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Item</span>
                  <span className="shrink-0 text-sm font-semibold text-slate-900 dark:text-slate-100">{cartItemCount}</span>
                </div>
                <div className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 shadow-sm dark:bg-zinc-900 sm:flex-none sm:min-w-[180px] sm:gap-4">
                  <span className="truncate text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Total Credit</span>
                  <span className="shrink-0 text-sm font-semibold text-slate-900 dark:text-slate-100">${totalCreditAmount.toFixed(2)}</span>
                </div>
              </div>
              {displayRows.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-5 text-sm text-slate-500 dark:text-slate-400">
                  No items in cart yet.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm dark:border-slate-700">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                      <tr>
                        <th className="px-3 py-3 text-left font-semibold">Need Pick-up</th>
                        <th className="px-3 py-3 text-left font-semibold">Customer Code</th>
                        <th className="px-3 py-3 text-left font-semibold">Invoice No</th>
                        <th className="px-3 py-3 text-left font-semibold">Item No</th>
                        <th className="px-3 py-3 text-left font-semibold">Item Description</th>
                        <th className="px-3 py-3 text-left font-semibold">Sales Batch Number</th>
                        <th className="px-3 py-3 text-left font-semibold">Sales Lot No</th>
                        <th className="px-3 py-3 text-left font-semibold">Reason</th>
                        <th className="px-3 py-3 text-center font-semibold">Credit Type</th>
                        <th className="px-3 py-3 text-right font-semibold">Qty</th>
                        <th className="px-3 py-3 text-right font-semibold">Credit Amount</th>
                        <th className="px-3 py-3 text-center font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayRows.map((item) => (
                        <tr key={item.id} className="border-t border-slate-200 text-slate-700 transition hover:bg-slate-50/80 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800/40">
                          <td className="px-3 py-3">
                            <input
                              type="checkbox"
                              checked={Boolean(pickupSelectionsById[item.id])}
                              onChange={(event) => {
                                const isChecked = event.target.checked;
                                setPickupSelectionsById((prev) => ({ ...prev, [item.id]: isChecked }));
                              }}
                              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                            />
                          </td>
                          <td className="px-3 py-3">{item.customer_code}</td>
                          <td className="px-3 py-3">{item.invoice_no}</td>
                          <td className="px-3 py-3">{item.item_no}</td>
                          <td className="px-3 py-3">{item.displayDescription}</td>
                          <td className="px-3 py-3">{item.sales_batch_number ?? "—"}</td>
                          <td className="px-3 py-3">{item.sales_lot_no ?? "—"}</td>
                          <td className="px-3 py-3">{item.reason ?? "—"}</td>
                          <td className="px-3 py-3 text-center">{item.credit_type}</td>
                          <td className="px-3 py-3 text-right">{item.quantity ?? 0}</td>
                          <td className="px-3 py-3 text-right">{Number(item.credit_amount).toFixed(2)}</td>
                          <td className="px-3 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => void removeItem(item.id)}
                              className="inline-flex h-8 min-w-[76px] items-center justify-center whitespace-nowrap rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200 dark:hover:bg-slate-800/60"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900/40">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Photo Evidence</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    id={fileInputId}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(event) => {
                      void onPicturesSelected(event);
                    }}
                    className="sr-only"
                    disabled={isUploadingPictures}
                  />
                  <button
                    type="button"
                    onClick={onPickPictures}
                    disabled={isUploadingPictures || isPhotoUploadConfirmOpen}
                    className="inline-flex h-10 min-w-[116px] items-center justify-center whitespace-nowrap rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    {isUploadingPictures ? "Uploading..." : "Add Photos"}
                  </button>
                </div>

                {isPhotoUploadConfirmOpen ? (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <p className="font-semibold">Please make sure LOT NUMBER is visible.</p>
                    <p className="mt-1 text-xs">Upload {pendingPictureFiles.length} selected photo{pendingPictureFiles.length === 1 ? "" : "s"}?</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void confirmPictureUpload()}
                        className="inline-flex h-8 items-center justify-center rounded-lg bg-amber-900 px-3 text-xs font-semibold text-white transition hover:bg-amber-800"
                      >
                        Upload Photos
                      </button>
                      <button
                        type="button"
                        onClick={cancelPictureUpload}
                        className="inline-flex h-8 items-center justify-center rounded-lg border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-900 transition hover:bg-amber-100"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 min-h-14 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-zinc-900 p-3">
                  {isUploadingPictures ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">Uploading photo evidence...</p>
                  ) : pictures.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                      {pictures.map((picture) => (
                        <div
                          key={picture.id}
                          className="group relative overflow-hidden rounded-md border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 shadow-sm"
                        >
                          <button
                            type="button"
                            onClick={() => void removePicture(picture.id)}
                            className="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/90 text-[10px] text-white shadow transition hover:bg-slate-900"
                            aria-label={`Remove ${picture.fileName}`}
                          >
                            ✕
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsPreviewImageBroken(false);
                              setSelectedPicture(picture);
                            }}
                            className="block aspect-square w-full"
                            aria-label={`Preview ${picture.fileName}`}
                          >
                            <Image
                              src={picture.previewUrl ?? picture.publicUrl}
                              alt={picture.fileName}
                              width={256}
                              height={256}
                              unoptimized
                              className="h-full w-full object-cover transition duration-150 group-hover:scale-[1.02]"
                            />
                          </button>
                          <p className="truncate border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-zinc-900 px-2 py-1 text-[10px] text-slate-600">
                            {picture.fileName}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      No photos uploaded yet. Click <strong>Add Photos</strong> to attach evidence.
                    </p>
                  )}
                </div>
                {photoError ? (
                  <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {photoError}
                  </p>
                ) : null}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900/40">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Notes</p>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={4}
                  className="mt-2 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none ring-0 transition focus:border-slate-400"
                />
              </div>

              {isRemoveAllConfirmOpen ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  <p className="font-semibold">Remove all credit request cart items and all uploaded photo evidence?</p>
                  <p className="mt-1 text-xs">This action cannot be undone.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void confirmRemoveAllFromCart()}
                      disabled={isRemovingAll}
                      className="inline-flex h-8 items-center justify-center rounded-lg bg-rose-700 px-3 text-xs font-semibold text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isRemovingAll ? "Removing..." : "Yes, Remove All"}
                    </button>
                    <button
                      type="button"
                      onClick={cancelRemoveAllFromCart}
                      disabled={isRemovingAll}
                      className="inline-flex h-8 items-center justify-center rounded-lg border border-rose-300 bg-white px-3 text-xs font-semibold text-rose-800 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}

              {sendError ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{sendError}</p>
              ) : null}
              {removeAllError ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {removeAllError}
                </p>
              ) : null}
            </div>
          </div>

          {selectedPicture ? (
            <div
              className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 p-4"
              role="dialog"
              aria-modal="true"
              aria-label="Photo preview"
              onClick={() => setSelectedPicture(null)}
            >
              <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(event) => event.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => setSelectedPicture(null)}
                  className="absolute -right-3 -top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm text-white"
                  aria-label="Close photo preview"
                >
                  ✕
                </button>
                {!isPreviewImageBroken ? (
                  <Image
                    src={selectedPicture.publicUrl}
                    alt={selectedPicture.fileName}
                    width={1200}
                    height={900}
                    unoptimized
                    className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
                    onError={() => setIsPreviewImageBroken(true)}
                  />
                ) : (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                    <p>Unable to render this full-size preview in the modal.</p>
                    <a
                      href={selectedPicture.publicUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block font-medium underline"
                    >
                      Open image in new tab
                    </a>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
