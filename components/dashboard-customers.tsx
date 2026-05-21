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
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-3 backdrop-blur-[2px] sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-label="Policy Checklist"
          onClick={closeChecklist}
        >
          <div
            className="relative w-full max-w-[740px] overflow-hidden rounded-[22px] border border-zinc-200/80 bg-white shadow-[0_20px_55px_-22px_rgba(0,0,0,0.4)] dark:border-zinc-800 dark:bg-zinc-950"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeChecklist}
              className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-base font-medium leading-none text-zinc-500 transition hover:border-zinc-300 hover:text-zinc-900 focus:outline-none focus:ring-2 focus:ring-sky-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:text-zinc-100"
              aria-label="Close policy checklist"
            >
              ×
            </button>

            <div className="space-y-4 px-5 pb-5 pt-14 text-sm sm:px-8 sm:pb-6 sm:pt-16">
              {[
                {
                  step: "1",
                  title: "Timing",
                  items: [
                    "Delivery was within the last 5 business days",
                    "Or the product went bad before the expiration date",
                  ],
                },
                {
                  step: "2",
                  title: "Proof",
                  items: ["Provide clear photos", "LOT number must be visible"],
                },
                {
                  step: "3",
                  title: "Product Condition",
                  items: ["Product is in the original box", "Box is not marked or written on"],
                },
              ].map((section) => (
                <section
                  key={section.step}
                  className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60"
                >
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white dark:bg-white dark:text-zinc-900">
                      {section.step}
                    </span>
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{section.title}</h4>
                      <ul className="mt-2 space-y-1.5 text-zinc-700 dark:text-zinc-200">
                        {section.items.map((item) => (
                          <li key={item} className="flex items-start gap-2">
                            <span className="mt-0.5 text-zinc-400 dark:text-zinc-500">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </section>
              ))}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-zinc-200/80 px-5 py-4 dark:border-zinc-800 sm:flex-row sm:justify-end sm:px-8">
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowFullPolicy(true)}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                >
                  View Full Policy
                </button>
                <button
                  type="button"
                  onClick={closeChecklist}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-zinc-950 px-4 text-sm font-medium text-white transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-sky-300 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showPolicyChecklist && showFullPolicy ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950/60 p-2 backdrop-blur-[2px] sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Full policy document"
          onClick={() => setShowFullPolicy(false)}
        >
          <div
            className="flex h-full w-full flex-col overflow-hidden rounded-[22px] border border-zinc-200 bg-white shadow-[0_20px_55px_-22px_rgba(0,0,0,0.4)] dark:border-zinc-800 dark:bg-zinc-950 sm:h-[90vh] sm:w-[90vw] sm:max-w-6xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-800 sm:px-5 sm:py-3">
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 sm:text-base">Full Policy</h4>
              <button
                type="button"
                onClick={() => setShowFullPolicy(false)}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none focus:ring-2 focus:ring-sky-300 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
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
