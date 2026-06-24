"use client";

import { useState } from "react";

type CreditRow = {
  salesperson: string | null;
  customer_code: string | null;
  customer_name: string | null;
  invoice_no: string | null;
  invoice_date: string | null;
  item_no: string | null;
  item_descp: string | null;
  quantity: number | string | null;
  sales_amount: number | string | null;
};

type RowsResponse = {
  rows?: CreditRow[];
  error?: string;
};

type AdminDashboardProps = {
  salespeople: string[];
};

function formatCell(value: CreditRow[keyof CreditRow]) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  return String(value);
}

export function AdminDashboard({ salespeople }: AdminDashboardProps) {
  const [selectedSalesperson, setSelectedSalesperson] = useState<string>();
  const [rows, setRows] = useState<CreditRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();

  async function loadSalespersonRows(salesperson: string) {
    setSelectedSalesperson(salesperson);
    setRows([]);
    setErrorMessage(undefined);
    setIsLoading(true);

    const response = await fetch(`/api/admin/salesperson-credit-rows?salesperson=${encodeURIComponent(salesperson)}`);
    const payload = (await response.json()) as RowsResponse;

    if (!response.ok) {
      setErrorMessage(payload.error ?? "Failed to load salesperson credit rows.");
      setIsLoading(false);
      return;
    }

    setRows(payload.rows ?? []);
    setIsLoading(false);
  }

  return (
    <section className="mt-6 space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white/75 p-4 shadow-sm shadow-zinc-200/60 dark:border-zinc-800 dark:bg-zinc-950/70 dark:shadow-black/20">
        <h2 className="text-lg font-semibold tracking-tight">Admin Dashboard</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
          Select a salesperson to load only that person&apos;s credit rows data.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {salespeople.map((salesperson) => {
            const isSelected = salesperson === selectedSalesperson;

            return (
              <button
                key={salesperson}
                type="button"
                onClick={() => loadSalespersonRows(salesperson)}
                disabled={isLoading && isSelected}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition disabled:cursor-wait disabled:opacity-70 ${
                  isSelected
                    ? "border-zinc-950 bg-zinc-950 text-white dark:border-white dark:bg-white dark:text-zinc-950"
                    : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-200 dark:hover:bg-zinc-800/60"
                }`}
              >
                {isLoading && isSelected ? "Loading..." : salesperson}
              </button>
            );
          })}
        </div>
        {salespeople.length === 0 ? <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">No salesperson data found.</p> : null}
      </div>

      {selectedSalesperson ? (
        <div className="rounded-2xl border border-zinc-200 bg-white/75 p-4 shadow-sm shadow-zinc-200/60 dark:border-zinc-800 dark:bg-zinc-950/70 dark:shadow-black/20">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold">{selectedSalesperson}</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">Showing up to 500 credit rows.</p>
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{isLoading ? "Loading..." : `${rows.length} row(s)`}</p>
          </div>

          {errorMessage ? <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p> : null}

          {!errorMessage && isLoading ? <p className="text-sm text-zinc-600 dark:text-zinc-300">Loading credit rows...</p> : null}

          {!errorMessage && !isLoading && rows.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="min-w-full divide-y divide-zinc-200 text-left text-sm dark:divide-zinc-800">
                <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/80 dark:text-zinc-400">
                  <tr>
                    {["Customer Code", "Customer", "Invoice", "Invoice Date", "Item No", "Item Description", "Qty", "Sales Amount"].map((header) => (
                      <th key={header} scope="col" className="whitespace-nowrap px-3 py-2 font-semibold">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                  {rows.map((row, index) => (
                    <tr key={`${row.invoice_no}-${row.item_no}-${index}`} className="dark:bg-zinc-950/30">
                      <td className="whitespace-nowrap px-3 py-2 font-medium">{formatCell(row.customer_code)}</td>
                      <td className="min-w-52 px-3 py-2">{formatCell(row.customer_name)}</td>
                      <td className="whitespace-nowrap px-3 py-2">{formatCell(row.invoice_no)}</td>
                      <td className="whitespace-nowrap px-3 py-2">{formatCell(row.invoice_date)}</td>
                      <td className="whitespace-nowrap px-3 py-2">{formatCell(row.item_no)}</td>
                      <td className="min-w-64 px-3 py-2">{formatCell(row.item_descp)}</td>
                      <td className="whitespace-nowrap px-3 py-2">{formatCell(row.quantity)}</td>
                      <td className="whitespace-nowrap px-3 py-2">{formatCell(row.sales_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {!errorMessage && !isLoading && rows.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-300">No rows found for this salesperson.</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
