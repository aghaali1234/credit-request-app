"use client";

import { useEffect, useMemo, useState } from "react";

import { MODAL_NAVIGATION_CLEANUP_EVENT } from "@/components/navigation-modal-cleanup";
import { ProductCreditRequestModal, type InvoiceItem } from "@/components/product-credit-request-modal";
import { formatUsdCurrency } from "@/lib/currency";

function formatFreeTxtReason(freeTxt: string | null | undefined) {
  const trimmedReason = freeTxt?.trim();
  return trimmedReason && trimmedReason !== "0" ? trimmedReason : "-";
}

type InvoiceItemWithReason = InvoiceItem & {
  free_txt?: string | null;
};

type InvoiceItemsTableProps = {
  items: InvoiceItemWithReason[];
  customerCode: string;
  invoiceNo: string;
  invoiceDate?: string | null;
  allowItemSelection?: boolean;
  showReason?: boolean;
};

export function InvoiceItemsTable({
  items,
  customerCode,
  invoiceNo,
  invoiceDate,
  allowItemSelection = true,
  showReason = false,
}: InvoiceItemsTableProps) {
  const [selectedItem, setSelectedItem] = useState<InvoiceItem | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const normalizedSearchTerm = searchTerm.trim().toLocaleLowerCase();
  const filteredItems = useMemo(() => {
    if (normalizedSearchTerm.length === 0) {
      return items;
    }

    return items.filter((item) => {
      const itemNo = item.item_no.toLocaleLowerCase();
      const itemDescription = item.item_descp.toLocaleLowerCase();
      return itemNo.includes(normalizedSearchTerm) || itemDescription.includes(normalizedSearchTerm);
    });
  }, [items, normalizedSearchTerm]);

  useEffect(() => {
    function resetPopupState() {
      setSelectedItem(null);
    }

    window.addEventListener(MODAL_NAVIGATION_CLEANUP_EVENT, resetPopupState);
    return () => {
      window.removeEventListener(MODAL_NAVIGATION_CLEANUP_EVENT, resetPopupState);
    };
  }, []);

  const showReasonColumn = showReason;

  const totals = useMemo(
    () =>
      filteredItems.reduce(
        (currentTotals, item) => ({
          quantity: currentTotals.quantity + item.quantity,
          salesAmount: currentTotals.salesAmount + item.sales_amount,
        }),
        { quantity: 0, salesAmount: 0 },
      ),
    [filteredItems],
  );

  return (
    <>
      <div className="mb-3 space-y-1">
        <label htmlFor="invoice-item-search" className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
          Search Items
        </label>
        <input
          id="invoice-item-search"
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Filter by Item No or Item Description"
          className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm focus:border-zinc-500 dark:focus:border-zinc-500 focus:outline-none"
        />
      </div>

      <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900/40 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Item No</th>
              <th className="px-3 py-2 font-medium">Item Description</th>
              <th className="px-3 py-2 font-medium">Quantity</th>
              <th className="px-3 py-2 font-medium">Sales Amount</th>
              {showReasonColumn ? <th className="px-3 py-2 font-medium">Reason</th> : null}
            </tr>
          </thead>
          <tbody>
            {filteredItems.length > 0 ? (
              filteredItems.map((item, index) => (
                <tr
                  key={`${item.item_no}-${index}`}
                  role={allowItemSelection ? "button" : undefined}
                  tabIndex={allowItemSelection ? 0 : undefined}
                  onClick={allowItemSelection ? () => setSelectedItem(item) : undefined}
                  onKeyDown={
                    allowItemSelection
                      ? (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedItem(item);
                          }
                        }
                      : undefined
                  }
                  className={`border-t border-zinc-200 dark:border-zinc-800 ${
                    allowItemSelection ? "cursor-pointer transition-colors hover:bg-zinc-50 focus:bg-zinc-50 focus:outline-none dark:hover:bg-zinc-900/60 dark:focus:bg-zinc-900/60" : ""
                  }`}
                  aria-label={allowItemSelection ? `Open details for item ${item.item_no}` : undefined}
                >
                  <td className="px-3 py-2">
                    <span className={allowItemSelection ? "font-medium text-blue-700 underline-offset-2" : "font-medium text-zinc-900 dark:text-zinc-100"}>{item.item_no}</span>
                  </td>
                  <td className="px-3 py-2">{item.item_descp}</td>
                  <td className="px-3 py-2">{item.quantity}</td>
                  <td className="px-3 py-2">{formatUsdCurrency(item.sales_amount)}</td>
                  {showReasonColumn ? <td className="px-3 py-2">{formatFreeTxtReason(item.free_txt)}</td> : null}
                </tr>
              ))
            ) : (
              <tr className="border-t border-zinc-200 dark:border-zinc-800">
                <td colSpan={showReasonColumn ? 5 : 4} className="px-3 py-4 text-center text-zinc-500 dark:text-zinc-400">
                  No items match your search.
                </td>
              </tr>
            )}
          </tbody>
          {filteredItems.length > 0 ? (
            <tfoot className="border-t border-zinc-300 bg-zinc-50 font-semibold dark:border-zinc-700 dark:bg-zinc-900/60">
              <tr>
                <td colSpan={2} className="px-3 py-2 text-right">
                  Total:
                </td>
                <td className="px-3 py-2">{totals.quantity}</td>
                <td className="px-3 py-2">{formatUsdCurrency(totals.salesAmount)}</td>
                {showReasonColumn ? <td className="px-3 py-2" /> : null}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      {allowItemSelection && selectedItem ? (
        <ProductCreditRequestModal
          item={selectedItem}
          customerCode={customerCode}
          invoiceNo={invoiceNo}
          invoiceDate={invoiceDate}
          onClose={() => setSelectedItem(null)}
        />
      ) : null}
    </>
  );
}
