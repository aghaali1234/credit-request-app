"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CustomerInvoicesView, type InvoiceSummary } from "@/components/customer-invoices-view";
import { DashboardCustomers, type Customer } from "@/components/dashboard-customers";
import { InvoiceItemsTable } from "@/components/invoice-items-table";
import type { InvoiceItem } from "@/components/product-credit-request-modal";

type InspectUser = { id: string; username: string | null; email: string | null; salespersonName: string };
type ViewState = { customer?: Customer; customerName?: string | null; invoiceNo?: string; invoiceDate?: string | null; isCreditInvoice?: boolean };

type UserDashboardProps = {
  subjectUserId?: string;
  frameTitle?: string;
  selectedUserLabel?: string;
  selectedUserEmail?: string | null;
  onClose?: () => void;
  inspectMode?: boolean;
};

type CustomersPayload = { user?: InspectUser; customers?: Customer[]; error?: string };
type InvoicesPayload = { customerName?: string | null; invoices?: InvoiceSummary[]; error?: string };
type ItemsPayload = { customerName?: string | null; invoiceDate?: string | null; items?: (InvoiceItem & { free_txt?: string | null })[]; error?: string };

export function UserDashboard({ subjectUserId, frameTitle = "Dashboard", selectedUserLabel, selectedUserEmail, onClose, inspectMode = false }: UserDashboardProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [resolvedUser, setResolvedUser] = useState<InspectUser | null>(null);
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [items, setItems] = useState<(InvoiceItem & { free_txt?: string | null })[]>([]);
  const [view, setView] = useState<ViewState>({});
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedUserRef = useRef<string | undefined>(undefined);

  const baseApi = inspectMode && subjectUserId ? `/api/admin/user-dashboard/${encodeURIComponent(subjectUserId)}` : "";
  const enabled = !inspectMode || Boolean(subjectUserId);

  const loadCustomers = useCallback(async (force = false) => {
    if (!enabled || !baseApi) return;
    if (!force && loadedUserRef.current === subjectUserId) return;
    loadedUserRef.current = undefined;
    setCustomers([]); setInvoices([]); setItems([]); setView({}); setError(null); setIsLoadingCustomers(true);
    try {
      const response = await fetch(`${baseApi}/customers`);
      const payload = (await response.json()) as CustomersPayload;
      if (!response.ok) throw new Error(payload.error ?? "Customers could not be loaded.");
      setCustomers(payload.customers ?? []);
      setResolvedUser(payload.user ?? null);
      loadedUserRef.current = subjectUserId;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Customers could not be loaded.");
    } finally {
      setIsLoadingCustomers(false);
    }
  }, [baseApi, enabled, subjectUserId]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadCustomers(false);
    });
  }, [loadCustomers]);

  async function openCustomer(customer: Customer) {
    setView({ customer }); setInvoices([]); setItems([]); setError(null); setIsLoadingInvoices(true);
    const response = await fetch(`${baseApi}/customers/${encodeURIComponent(customer.customer_code)}/invoices`);
    const payload = (await response.json()) as InvoicesPayload;
    if (!response.ok) setError(payload.error ?? "Invoices could not be loaded.");
    else { setInvoices(payload.invoices ?? []); setView({ customer, customerName: payload.customerName }); }
    setIsLoadingInvoices(false);
  }

  async function openInvoice(invoiceNo: string) {
    if (!view.customer) return;
    setItems([]); setError(null); setIsLoadingItems(true);
    const response = await fetch(`${baseApi}/customers/${encodeURIComponent(view.customer.customer_code)}/invoices/${encodeURIComponent(invoiceNo)}/items`);
    const payload = (await response.json()) as ItemsPayload;
    if (!response.ok) setError(payload.error ?? "Invoice items could not be loaded.");
    else { setItems(payload.items ?? []); setView((current) => ({ ...current, invoiceNo, invoiceDate: payload.invoiceDate, customerName: payload.customerName ?? current.customerName, isCreditInvoice: invoiceNo.startsWith("CM-") })); }
    setIsLoadingItems(false);
  }

  const titleName = selectedUserLabel ?? resolvedUser?.salespersonName ?? resolvedUser?.username ?? "Selected user";
  const titleEmail = selectedUserEmail ?? resolvedUser?.email;
  const searchEndpoint = useMemo(() => view.customer ? `${baseApi}/customers/${encodeURIComponent(view.customer.customer_code)}/invoice-item-search` : undefined, [baseApi, view.customer]);

  if (!enabled) return null;

  return (
    <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 border-b border-slate-200 pb-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-700 dark:text-blue-400">{frameTitle}</p><h2 className="mt-1 truncate text-xl font-bold text-slate-950 dark:text-white">{titleName}</h2>{titleEmail ? <p className="text-sm text-slate-500 dark:text-slate-400">{titleEmail}</p> : null}</div>
        <div className="flex gap-2"><button type="button" onClick={() => void loadCustomers(true)} disabled={isLoadingCustomers} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900">{isLoadingCustomers ? "Refreshing..." : "Refresh"}</button>{onClose ? <button type="button" onClick={onClose} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950">Close</button> : null}</div>
      </div>
      {error ? <p className="mb-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p> : null}
      {isLoadingCustomers ? <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-900 dark:text-slate-400">Loading selected user dashboard...</p> : null}
      {!isLoadingCustomers && !view.customer ? <DashboardCustomers initialCustomers={customers} variant="embedded" onSelectCustomer={openCustomer} /> : null}
      {view.customer && !view.invoiceNo ? <><div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-sm text-zinc-600 dark:text-zinc-300">Customer</p><h3 className="text-xl font-semibold">{view.customerName ?? view.customer.customer_name}</h3><p className="text-sm text-zinc-600 dark:text-zinc-300">Code: {view.customer.customer_code}</p></div><button type="button" onClick={() => { setView({}); setInvoices([]); }} className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/60">Back</button></div>{isLoadingInvoices ? <p className="text-sm text-zinc-500">Loading invoices...</p> : <CustomerInvoicesView customerCode={view.customer.customer_code} invoices={invoices} embedded searchEndpoint={searchEndpoint} onOpenInvoice={openInvoice} />}</> : null}
      {view.customer && view.invoiceNo ? <><div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-sm text-zinc-600 dark:text-zinc-300">Customer</p><h3 className="text-xl font-semibold">{view.customerName ?? view.customer.customer_name}</h3><p className="text-sm text-zinc-600 dark:text-zinc-300">Code: {view.customer.customer_code}</p><p className="text-sm text-zinc-600 dark:text-zinc-300">{view.isCreditInvoice ? "Credit No" : "Invoice No"}: {view.invoiceNo}</p><p className="text-sm text-zinc-600 dark:text-zinc-300">{view.isCreditInvoice ? "Credit Date" : "Invoice Date"}: {view.invoiceDate ?? "-"}</p></div><button type="button" onClick={() => { setView((current) => ({ customer: current.customer, customerName: current.customerName })); setItems([]); }} className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/60">Back</button></div>{isLoadingItems ? <p className="text-sm text-zinc-500">Loading items...</p> : <InvoiceItemsTable items={items} customerCode={view.customer.customer_code} invoiceNo={view.invoiceNo} invoiceDate={view.invoiceDate} allowItemSelection={!inspectMode && !view.isCreditInvoice} showReason={view.isCreditInvoice} />}</> : null}
    </section>
  );
}
