"use client";

import Link, { useLinkStatus } from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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

function ProfileLinkStatus() {
  const { pending } = useLinkStatus();

  return (
    <span
      aria-live="polite"
      className={`absolute right-2 inline-flex h-3 w-3 items-center justify-center transition-opacity ${pending ? "opacity-100" : "opacity-0"}`}
    >
      <span
        aria-hidden="true"
        className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white dark:border-zinc-950/30 dark:border-t-zinc-950"
      />
      <span className="sr-only">{pending ? "Loading profile" : ""}</span>
    </span>
  );
}

export function DashboardCustomers({ initialCustomers }: DashboardCustomersProps) {
  const [customers] = useState<Customer[]>(initialCustomers);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

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
    if (!isTutorialOpen) {
      return;
    }

    const video = videoRef.current;
    if (!video) {
      return;
    }

    video.currentTime = 0;
    const playPromise = video.play();

    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Some browsers may still block autoplay; controls remain available.
      });
    }
  }, [isTutorialOpen]);

  useEffect(() => {
    if (!isTutorialOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeTutorial();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isTutorialOpen]);

  function closeTutorial() {
    const video = videoRef.current;

    if (video) {
      video.pause();
      video.currentTime = 0;
    }

    setIsTutorialOpen(false);
  }

  return (
    <section className="mt-6 space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white/75 p-4 shadow-sm shadow-zinc-200/60 dark:border-zinc-800 dark:bg-zinc-950/70 dark:shadow-black/20 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">Customers</h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Browse invoices by customer.</p>
        </div>
        <div
          className="grid w-full grid-cols-3 gap-1 rounded-xl border border-zinc-200 bg-zinc-50/90 p-1 dark:border-zinc-800 dark:bg-zinc-900/70 sm:w-auto sm:min-w-[360px]"
          aria-label="Dashboard actions"
        >
          <Link
            href="/profile"
            prefetch={false}
            className="relative inline-flex h-10 items-center justify-center rounded-lg bg-zinc-950 px-3 text-sm font-medium text-white transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-sky-300 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            <span>Profile</span>
            <ProfileLinkStatus />
          </Link>
          <button
            type="button"
            onClick={() => setIsTutorialOpen(true)}
            className="inline-flex h-10 items-center justify-center rounded-lg px-3 text-sm font-medium text-zinc-700 transition hover:bg-white hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-sky-300 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:text-white"
          >
            Tutorial
          </button>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="inline-flex h-10 items-center justify-center rounded-lg px-3 text-sm font-medium text-zinc-500 transition hover:bg-white hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white dark:focus:ring-zinc-700/60"
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

      {isTutorialOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3"
          role="dialog"
          aria-modal="true"
          aria-label="Tutorial video"
          onClick={closeTutorial}
        >
          <div
            className="relative w-full max-w-[390px] rounded-xl bg-white p-3 shadow-2xl dark:bg-zinc-950"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeTutorial}
              className="absolute -right-2 -top-2 rounded-full bg-white px-2.5 py-1 text-lg font-semibold leading-none text-zinc-700 shadow-md transition hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-sky-300 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              aria-label="Close tutorial video"
            >
              ×
            </button>
            <video
              ref={videoRef}
              autoPlay
              controls
              playsInline
              preload="auto"
              className="aspect-[9/16] max-h-[82vh] w-full rounded-lg bg-black object-contain"
            >
              <source src="/api/tutorial-video" type="video/mp4" />
            </video>
          </div>
        </div>
      ) : null}
    </section>
  );
}
