"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";

type UploadResponse = {
  fileName?: string;
  rowsUploaded?: number;
  batches?: number;
  batchSize?: number;
  recognizedColumns?: string[];
  missingColumns?: string[];
  uploadedAt?: string;
  error?: string;
};

type UserSettingsUser = {
  id: string;
  username: string | null;
  salespersonName: string;
};

type UserSettingsResponse = {
  users?: UserSettingsUser[];
  salespeople?: string[];
  error?: string;
};


type DuplicateRemoveResponse = {
  deletedRows?: number;
  error?: string;
  supabase?: {
    message?: string;
    code?: string;
    details?: string;
    hint?: string;
  };
};

export function AdminDashboard() {
  const [selectedFile, setSelectedFile] = useState<File>();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState("");
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string>();
  const [isRemovingDuplicates, setIsRemovingDuplicates] = useState(false);
  const [duplicateRemoveMessage, setDuplicateRemoveMessage] =
    useState<string>();
  const [duplicateRemoveError, setDuplicateRemoveError] = useState<string>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [users, setUsers] = useState<UserSettingsUser[]>([]);
  const [isLoadingSalespeople, setIsLoadingSalespeople] = useState(true);
  const [userSettingsError, setUserSettingsError] = useState<string>();

  useEffect(() => {
    let isMounted = true;

    async function loadSalespeople() {
      setIsLoadingSalespeople(true);
      setUserSettingsError(undefined);

      const response = await fetch("/api/admin/user-settings");
      const payload = (await response.json()) as UserSettingsResponse;

      if (!isMounted) {
        return;
      }

      if (!response.ok) {
        setUserSettingsError(
          payload.error ?? "Salespeople could not be loaded.",
        );
        setUsers([]);
      } else {
        setUsers(
          payload.users ??
            (payload.salespeople ?? []).map((salesperson) => ({
              id: salesperson,
              username: salesperson,
              salespersonName: salesperson,
            })),
        );
      }

      setIsLoadingSalespeople(false);
    }

    loadSalespeople();

    return () => {
      isMounted = false;
    };
  }, []);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setSelectedFile(file);
    setUploadErrorMessage(undefined);
    setUploadProgressText(file ? `${file.name} selected` : "");
  }

  function clearSelectedFile() {
    if (isUploading) {
      return;
    }

    setSelectedFile(undefined);
    setUploadErrorMessage(undefined);
    setUploadProgressText("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function formatDuplicateRemoveError(payload: DuplicateRemoveResponse) {
    const parts = [payload.error ?? "Duplicate remove operation failed."];

    if (payload.supabase?.message) {
      parts.push(`Message: ${payload.supabase.message}`);
    }

    if (payload.supabase?.code) {
      parts.push(`Code: ${payload.supabase.code}`);
    }

    if (payload.supabase?.details) {
      parts.push(`Details: ${payload.supabase.details}`);
    }

    if (payload.supabase?.hint) {
      parts.push(`Hint: ${payload.supabase.hint}`);
    }

    return parts.join(" ");
  }

  async function removeDuplicates() {
    if (isRemovingDuplicates) {
      return;
    }

    setIsRemovingDuplicates(true);
    setDuplicateRemoveMessage(undefined);
    setDuplicateRemoveError(undefined);

    try {
      const response = await fetch("/api/admin/credit-rows-duplicates", {
        method: "POST",
      });
      const payload = (await response.json()) as DuplicateRemoveResponse;

      if (!response.ok) {
        console.error("Duplicate remove failed", payload);
        setDuplicateRemoveError(formatDuplicateRemoveError(payload));
        return;
      }

      setDuplicateRemoveMessage(
        `${(payload.deletedRows ?? 0).toLocaleString()} duplicate rows removed.`,
      );
    } catch (error) {
      console.error("Duplicate remove request failed", error);
      setDuplicateRemoveError(
        error instanceof Error
          ? `Duplicate remove request failed. Message: ${error.message}`
          : "Duplicate remove request failed.",
      );
    } finally {
      setIsRemovingDuplicates(false);
    }
  }

  async function uploadCsv() {
    if (!selectedFile || isUploading) {
      return;
    }

    setIsUploading(true);
    setUploadErrorMessage(undefined);
    setUploadProgressText("Reading and transforming CSV...");

    const formData = new FormData();
    formData.append("file", selectedFile);

    const response = await fetch("/api/admin/credit-rows-upload", {
      method: "POST",
      body: formData,
    });
    const payload = (await response.json()) as UploadResponse;

    if (!response.ok) {
      const error = payload.error ?? "Upload failed.";
      setUploadErrorMessage(error);
      setUploadProgressText("Upload failed");
      setIsUploading(false);
      return;
    }

    setUploadProgressText(
      `Completed: ${payload.rowsUploaded?.toLocaleString() ?? 0} rows uploaded`,
    );
    setSelectedFile(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setIsUploading(false);
  }

  return (
    <section className="mt-8 space-y-6">
      <div className="grid items-stretch gap-6 xl:grid-cols-2">
        <div className="flex h-full min-h-[430px] flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-6">
          <div className="relative">
            {selectedFile ? (
              <button
                type="button"
                onClick={clearSelectedFile}
                disabled={isUploading}
                aria-label="Remove selected CSV file"
                className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg font-bold text-slate-500 shadow-sm ring-1 ring-slate-200 transition hover:text-red-600 hover:ring-red-200 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-950 dark:text-slate-300 dark:ring-slate-700 dark:hover:text-red-400 dark:hover:ring-red-700"
              >
                ×
              </button>
            ) : null}
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center transition hover:border-blue-400 hover:bg-blue-50/60 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:border-blue-500 dark:hover:bg-blue-950/30">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={handleFileChange}
              />
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-3xl text-white">
                ↑
              </span>
              <span className="mt-4 text-base font-semibold text-slate-950 dark:text-white">
                {selectedFile?.name ?? "Choose CSV file"}
              </span>
            </label>
          </div>

          <button
            type="button"
            onClick={uploadCsv}
            disabled={!selectedFile || isUploading}
            className="mt-5 w-full rounded-2xl bg-blue-700 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-700/20 transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none dark:disabled:bg-slate-800"
          >
            {isUploading ? "Uploading to Supabase..." : "Upload to Supabase"}
          </button>

          <div className="mt-5 rounded-2xl bg-slate-50 p-4 dark:bg-slate-900/70">
            {uploadProgressText ? (
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {uploadProgressText}
              </p>
            ) : null}
            {uploadErrorMessage ? (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                {uploadErrorMessage}
              </p>
            ) : null}

            <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={removeDuplicates}
                disabled={isRemovingDuplicates}
                className="w-full rounded-2xl bg-amber-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-amber-600/20 transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none dark:disabled:bg-slate-800"
              >
                {isRemovingDuplicates
                  ? "Removing duplicates..."
                  : "Duplicate Remove"}
              </button>
              {duplicateRemoveMessage ? (
                <p className="mt-3 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  {duplicateRemoveMessage}
                </p>
              ) : null}
              {duplicateRemoveError ? (
                <p className="mt-3 text-sm text-red-600 dark:text-red-400">
                  {duplicateRemoveError}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex h-full min-h-[430px] flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-6">
          <h3 className="text-xl font-bold tracking-tight text-slate-950 dark:text-white">
            User Settings
          </h3>

          <div className="mt-6 flex-1 space-y-2 overflow-y-auto pr-1">
            {isLoadingSalespeople ? (
              <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                Loading users...
              </p>
            ) : null}
            {userSettingsError ? (
              <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-300">
                {userSettingsError}
              </p>
            ) : null}
            {!isLoadingSalespeople && users.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                No active salesperson user found in app_users.
              </p>
            ) : null}
            {users.map((user) => (
              <Link
                key={user.id}
                href={`/admin/users/${encodeURIComponent(user.id)}/dashboard`}
                className="block rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-slate-50 hover:text-blue-700 dark:border-slate-800 dark:text-slate-200 dark:hover:border-blue-700 dark:hover:bg-slate-900 dark:hover:text-blue-200"
              >
                {user.salespersonName}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
