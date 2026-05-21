"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { signOut } from "next-auth/react";

type Customer = {
  customer_code: string;
  customer_name: string;
};

type DashboardCustomersProps = {
  initialCustomers: Customer[];
};

function normalizeSearchValue(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .toLocaleLowerCase("en-US")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeSearchValue(value: string) {
  return normalizeSearchValue(value).split(" ").filter(Boolean);
}

export function DashboardCustomers({ initialCustomers }: DashboardCustomersProps) {
  const [customers] = useState<Customer[]>(initialCustomers);
  const [showPolicyChecklist, setShowPolicyChecklist] = useState(false);
  const [showFullPolicy, setShowFullPolicy] = useState(false);

  const uniqueCustomers = useMemo(() => {
    const seen = new Set<string>();

    return customers.filter((customer) => {
      const dedupeKey = `${customer.customer_code}::${customer.customer_name}`;

      if (seen.has(dedupeKey)) {
        return false;
      }

      seen.add(dedupeKey);
      return true;
    });
  }, [customers]);
  const [searchTerm, setSearchTerm] = useState("");

  const searchableCustomers = useMemo(
    () =>
      uniqueCustomers.map((customer) => {
        const customerCode = typeof customer.customer_code === "string" ? customer.customer_code : "";
        const customerName = typeof customer.customer_name === "string" ? customer.customer_name : "";

        return {
          customer,
          searchableValue: normalizeSearchValue(`${customerCode} ${customerName}`),
        };
      }),
    [uniqueCustomers],
  );

  const filteredCustomers = useMemo(() => {
    const normalizedSearchTerm = normalizeSearchValue(searchTerm);
    const searchTokens = tokenizeSearchValue(searchTerm);

    if (!normalizedSearchTerm) {
      return uniqueCustomers;
    }

    return searchableCustomers
      .filter(({ searchableValue }) => {
        if (!searchableValue) {
          return false;
        }

        if (searchableValue.includes(normalizedSearchTerm)) {
          return true;
        }

        return searchTokens.every((token) => searchableValue.includes(token));
      })
      .map(({ customer }) => customer);
  }, [searchTerm, searchableCustomers, uniqueCustomers]);

  const isSearchActive = searchTerm.trim().length > 0;

  useEffect(() => {
    if (!showPolicyChecklist && !showFullPolicy) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (showFullPolicy) {
          setShowFullPolicy(false);
          return;
        }

        setShowPolicyChecklist(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showPolicyChecklist, showFullPolicy]);

  function closeChecklist() {
    setShowFullPolicy(false);
    setShowPolicyChecklist(false);
  }

  return (
    <section className="mt-6 space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white/75 p-4 shadow-sm shadow-zinc-200/60 dark:border-zinc-800 dark:bg-zinc-950/70 dark:shadow-black/20 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">Customers</h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Browse invoices by customer.</p>
        </div>
        <div
          className="grid w-full grid-cols-2 gap-1 rounded-xl border border-zinc-200 bg-zinc-50/90 p-1 dark:border-zinc-800 dark:bg-zinc-900/70 sm:w-auto sm:min-w-60"
          aria-label="Dashboard actions"
        >
          <button
            type="button"
            onClick={() => setShowPolicyChecklist(true)}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-950 px-4 text-sm font-medium text-white transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-sky-300 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            Policy Checklist
          </button>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium text-zinc-500 transition hover:bg-white hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white dark:focus:ring-zinc-700/60"
          >
            Sign Out
          </button>
        </div>
      </div>

      <div>
        <label
          htmlFor="customer-search"
          className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-200"
        >
          Search customer
        </label>
        <div className="relative">
          <input
            id="customer-search"
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by customer code or name..."
            className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 pr-10 text-sm text-zinc-900 dark:text-zinc-100 outline-none transition focus:border-zinc-500 dark:focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:focus:ring-zinc-700/60"
          />
          {searchTerm ? (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute inset-y-0 right-2 my-auto h-7 rounded px-2 text-xs text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              aria-label="Clear customer search"
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      {isSearchActive ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          {filteredCustomers.length} matching customer(s) found.
        </p>
      ) : null}

      <ul className="space-y-2">
        {filteredCustomers.map((customer, index) => (
          <li
            key={`${customer.customer_code}-${customer.customer_name}-${index}`}
            className="rounded-md border border-zinc-200 dark:border-zinc-800 text-sm"
          >
            <Link
              href={`/dashboard/customers/${encodeURIComponent(customer.customer_code)}`}
              className="block px-3 py-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60 dark:bg-zinc-900/40"
            >
              <p className="font-medium">{customer.customer_code}</p>
              <p className="text-zinc-600 dark:text-zinc-300">{customer.customer_name}</p>
            </Link>
          </li>
        ))}
      </ul>

      {filteredCustomers.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          No customers found for this search.
        </p>
      ) : null}

      {showPolicyChecklist ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Policy Checklist"
          onClick={closeChecklist}
        >
          <div
            className="relative w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl dark:bg-zinc-950 sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeChecklist}
              className="absolute right-3 top-3 rounded-md px-2 py-1 text-xl leading-none text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 focus:outline-none focus:ring-2 focus:ring-sky-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              aria-label="Close policy checklist"
            >
              ×
            </button>

            <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Policy Checklist</h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              Quick checklist before submitting a credit request
            </p>

            <div className="mt-5 space-y-4 text-sm text-zinc-700 dark:text-zinc-200">
              <div>
                <p className="font-semibold">Step 1 — Timing</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  <li>Delivery was within the last 5 business days</li>
                  <li>Or the product went bad before the expiration date</li>
                </ul>
              </div>

              <div>
                <p className="font-semibold">Step 2 — Proof</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  <li>Provide clear photos</li>
                  <li>LOT number must be visible</li>
                </ul>
              </div>

              <div>
                <p className="font-semibold">Step 3 — Product Condition</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  <li>Product is in the original box</li>
                  <li>Box is not marked or written on</li>
                </ul>
              </div>

              <div>
                <p className="font-semibold">Important</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  <li>Issue must be reported to the salesperson</li>
                  <li>Do not dispose of the product before review</li>
                </ul>
              </div>

              <p className="font-medium">If all items are confirmed, proceed with the credit request.</p>
            </div>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowFullPolicy(true)}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                View Full Policy
              </button>
              <button
                type="button"
                onClick={closeChecklist}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-950 px-4 text-sm font-medium text-white transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-sky-300 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showPolicyChecklist && showFullPolicy ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-2 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Full policy document"
          onClick={() => setShowFullPolicy(false)}
        >
          <div
            className="flex h-full w-full flex-col rounded-2xl bg-white shadow-2xl dark:bg-zinc-950 sm:h-[90vh] sm:w-[90vw] sm:max-w-6xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-800 sm:px-4 sm:py-3">
              <h4 className="text-sm font-semibold sm:text-base">Full Policy</h4>
              <button
                type="button"
                onClick={() => setShowFullPolicy(false)}
                className="rounded-md px-3 py-1 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none focus:ring-2 focus:ring-sky-300 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                Back
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <iframe
                title="Policy PDF"
                src="/policy.pdf"
                className="h-full w-full rounded-b-2xl"
              />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
