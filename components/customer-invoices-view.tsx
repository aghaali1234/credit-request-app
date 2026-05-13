"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { MODAL_NAVIGATION_CLEANUP_EVENT } from "@/components/navigation-modal-cleanup";
import { ProductCreditRequestModal, type InvoiceItem } from "@/components/product-credit-request-modal";
import { NotFromRecentInvoicesNote } from "@/components/not-from-recent-invoices-note";

type InvoiceSummary = {
  invoice_no: string;
  invoice_date: string;
  free_txt: string | null;
};

type SearchResultItem = InvoiceItem & {
  invoice_no: string;
  invoice_date: string;
};

type DocumentTab = "invoices" | "credits";

const OLDER_RECORDS_CUTOFF_DATE = "2026-01-01";
const OLDER_RECORDS_PAGE_SIZE = 10;

function formatFreeTxtReason(freeTxt: string | null | undefined) {
  const trimmedReason = freeTxt?.trim();
  return trimmedReason && trimmedReason !== "0" ? trimmedReason : "-";
}

function toComparableDate(invoiceDate: string) {
  const trimmedDate = invoiceDate.trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmedDate);

  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const dottedDateMatch = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(trimmedDate);

  if (dottedDateMatch) {
    return `${dottedDateMatch[3]}-${dottedDateMatch[2]}-${dottedDateMatch[1]}`;
  }

  const parsedTimestamp = Date.parse(trimmedDate);

  if (!Number.isNaN(parsedTimestamp)) {
    return new Date(parsedTimestamp).toISOString().slice(0, 10);
  }

  return trimmedDate;
}

function isOlderThanCutoff(invoiceDate: string) {
  return toComparableDate(invoiceDate) < OLDER_RECORDS_CUTOFF_DATE;
}

type CustomerInvoicesViewProps = {
  customerCode: string;
  invoices: InvoiceSummary[];
  initialTab?: DocumentTab;
};

export function CustomerInvoicesView({ customerCode, invoices, initialTab = "invoices" }: CustomerInvoicesViewProps) {
  const [activeTab, setActiveTab] = useState<DocumentTab>(initialTab);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<SearchResultItem | null>(null);
  const [visibleOlderInvoiceCount, setVisibleOlderInvoiceCount] = useState(0);
  const [visibleOlderCreditCount, setVisibleOlderCreditCount] = useState(0);
  const debounceTimeoutRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    function resetPopupState() {
      setSelectedResult(null);
    }

    window.addEventListener(MODAL_NAVIGATION_CLEANUP_EVENT, resetPopupState);
    return () => {
      window.removeEventListener(MODAL_NAVIGATION_CLEANUP_EVENT, resetPopupState);
    };
  }, []);

  function runSearch(nextValue: string, documentType: DocumentTab) {
    const normalizedSearchTerm = nextValue.trim();

    if (normalizedSearchTerm.length < 2) {
      if (debounceTimeoutRef.current !== null) {
        window.clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      setSearchResults([]);
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    if (debounceTimeoutRef.current !== null) {
      window.clearTimeout(debounceTimeoutRef.current);
    }

    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsSearching(true);
    setSearchError(null);

    debounceTimeoutRef.current = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/customers/${encodeURIComponent(customerCode)}/invoice-item-search?query=${encodeURIComponent(normalizedSearchTerm)}&documentType=${documentType}`,
          { signal: abortController.signal },
        );

        if (abortControllerRef.current !== abortController) {
          return;
        }

        if (!response.ok) {
          setSearchError("Failed to search items.");
          setSearchResults([]);
          return;
        }

        const payload = (await response.json()) as { items?: SearchResultItem[] };
        if (abortControllerRef.current === abortController) {
          setSearchResults(payload.items ?? []);
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }

        if (abortControllerRef.current === abortController) {
          setSearchError("Failed to search items.");
          setSearchResults([]);
        }
      } finally {
        if (abortControllerRef.current === abortController) {
          setIsSearching(false);
        }
      }
    }, 250);
  }

  function handleTabChange(nextTab: DocumentTab) {
    setActiveTab(nextTab);
    setSelectedResult(null);
    runSearch(searchTerm, nextTab);
  }

  const isSearchActive = searchTerm.trim().length >= 2;
  const isCreditsTab = activeTab === "credits";
  const invoiceRows = useMemo(() => invoices.filter((invoice) => !invoice.invoice_no.startsWith("CM-")), [invoices]);
  const creditRows = useMemo(() => invoices.filter((invoice) => invoice.invoice_no.startsWith("CM-")), [invoices]);
  const { displayedRows, hiddenOlderCount, showOlderRecords } = useMemo(() => {
    const currentRows = activeTab === "invoices" ? invoiceRows : creditRows;
    const currentVisibleOlderCount = activeTab === "invoices" ? visibleOlderInvoiceCount : visibleOlderCreditCount;
    const recentRows = currentRows.filter((invoice) => !isOlderThanCutoff(invoice.invoice_date));
    const olderRows = currentRows.filter((invoice) => isOlderThanCutoff(invoice.invoice_date));

    return {
      displayedRows: [...recentRows, ...olderRows.slice(0, currentVisibleOlderCount)],
      hiddenOlderCount: Math.max(olderRows.length - currentVisibleOlderCount, 0),
      showOlderRecords: () => {
        if (activeTab === "invoices") {
          setVisibleOlderInvoiceCount((currentCount) => Math.min(currentCount + OLDER_RECORDS_PAGE_SIZE, olderRows.length));
          return;
        }

        setVisibleOlderCreditCount((currentCount) => Math.min(currentCount + OLDER_RECORDS_PAGE_SIZE, olderRows.length));
      },
    };
  }, [activeTab, creditRows, invoiceRows, visibleOlderCreditCount, visibleOlderInvoiceCount]);

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => handleTabChange("invoices")}
          className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
            activeTab === "invoices"
              ? "border-zinc-800 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
              : "border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800/60"
          }`}
        >
          Invoices
        </button>
        <button
          type="button"
          onClick={() => handleTabChange("credits")}
          className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
            activeTab === "credits"
              ? "border-zinc-800 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
              : "border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800/60"
          }`}
        >
          Credits
        </button>
      </div>

      <div className="space-y-1">
        <label htmlFor="customer-invoice-search" className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
          Search {isCreditsTab ? "credits" : "invoices"} by Invoice No, Item No, or Item Description
        </label>
        <input
          id="customer-invoice-search"
          type="search"
          value={searchTerm}
          onChange={(event) => {
            const nextValue = event.target.value;
            setSearchTerm(nextValue);
            runSearch(nextValue, activeTab);
          }}
          placeholder="Minimum 2 characters"
          className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 outline-none transition focus:border-zinc-500 dark:focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:focus:ring-zinc-700/60"
        />
      </div>

      {searchError ? <p className="text-sm text-red-600">{searchError}</p> : null}

      {isSearchActive ? (
        <div className="space-y-2">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            {isSearching ? `Searching ${isCreditsTab ? "credit" : "invoice"} items...` : `${searchResults.length} matching ${isCreditsTab ? "credit" : "invoice"} item(s) found.`}
          </p>

          {!isSearching && searchResults.length > 0 ? (
            <ul className="space-y-2">
              {searchResults.map((item, index) => (
                <li key={`${item.invoice_no}-${item.item_no}-${index}`} className="rounded-md border border-zinc-200 dark:border-zinc-800 text-sm">
                  {isCreditsTab ? (
                    <Link
                      href={`/dashboard/customers/${encodeURIComponent(customerCode)}/invoices/${encodeURIComponent(item.invoice_no)}`}
                      className="block px-3 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60 dark:bg-zinc-900/40"
                    >
                      <p className="text-zinc-600 dark:text-zinc-300">Credit No: {item.invoice_no}</p>
                      <p className="mb-2 text-zinc-600 dark:text-zinc-300">Credit Date: {item.invoice_date}</p>
                      <p className="mb-2 text-zinc-600 dark:text-zinc-300">Lot Number: {item.sales_lot_no}</p>
                      <p className="mb-2 text-zinc-600 dark:text-zinc-300">Reason: {formatFreeTxtReason(item.free_txt)}</p>
                      <p className="font-medium text-blue-700">{item.item_no}</p>
                      <p className="text-zinc-700 dark:text-zinc-200">{item.item_descp}</p>
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSelectedResult(item)}
                      className="block w-full px-3 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60 dark:bg-zinc-900/40"
                    >
                      <p className="text-zinc-600 dark:text-zinc-300">Invoice No: {item.invoice_no}</p>
                      <p className="mb-2 text-zinc-600 dark:text-zinc-300">Invoice Date: {item.invoice_date}</p>
                      <p className="mb-2 text-zinc-600 dark:text-zinc-300">Lot Number: {item.sales_lot_no}</p>
                      <p className="font-medium text-blue-700">{item.item_no}</p>
                      <p className="text-zinc-700 dark:text-zinc-200">{item.item_descp}</p>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : null}

          {!isSearching && searchResults.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-300">No matching items found.</p>
          ) : null}
        </div>
      ) : (
        <ul className="space-y-2">
          {displayedRows.map((invoice) => (
            <li key={invoice.invoice_no} className="rounded-md border border-zinc-200 dark:border-zinc-800 text-sm">
              <Link
                href={`/dashboard/customers/${encodeURIComponent(customerCode)}/invoices/${encodeURIComponent(invoice.invoice_no)}`}
                className="block px-3 py-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60 dark:bg-zinc-900/40"
              >
                <p className="font-medium">{activeTab === "invoices" ? "Invoice No" : "Credit No"}: {invoice.invoice_no}</p>
                <p className="text-zinc-600 dark:text-zinc-300">
                  {activeTab === "invoices" ? "Invoice Date" : "Credit Date"}: {invoice.invoice_date}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!isSearchActive && hiddenOlderCount > 0 ? (
        <div className="flex justify-center pt-1 pb-2">
          <button
            type="button"
            onClick={showOlderRecords}
            className="inline-flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-3.5 py-1.5 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:border-zinc-400 hover:bg-zinc-50 hover:text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-50 dark:focus:ring-zinc-700"
            aria-label={`See more older ${isCreditsTab ? "credit" : "invoice"} records`}
          >
            <span>See More</span>
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m5 7.5 5 5 5-5" />
            </svg>
          </button>
        </div>
      ) : null}

      {selectedResult ? (
        <ProductCreditRequestModal
          item={selectedResult}
          customerCode={customerCode}
          invoiceNo={selectedResult.invoice_no}
          onClose={() => setSelectedResult(null)}
        />
      ) : null}

      {activeTab === "invoices" ? <NotFromRecentInvoicesNote customerCode={customerCode} /> : null}
    </section>
  );
}
