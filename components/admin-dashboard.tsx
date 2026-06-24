"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";

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

type UploadHistoryEntry = UploadResponse & {
  status: "success" | "error";
};

type UserSettingsResponse = {
  salespeople?: string[];
  error?: string;
};

type PasswordUpdateResponse = {
  ok?: boolean;
  error?: string;
};

function formatDateTime(value?: string) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function AdminDashboard() {
  const [selectedFile, setSelectedFile] = useState<File>();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState(
    "Waiting for CSV file",
  );
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string>();
  const [uploadHistory, setUploadHistory] = useState<UploadHistoryEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastSuccessfulUpload = uploadHistory.find(
    (entry) => entry.status === "success",
  );

  const [salespeople, setSalespeople] = useState<string[]>([]);
  const [selectedSalesperson, setSelectedSalesperson] = useState<string>();
  const [isLoadingSalespeople, setIsLoadingSalespeople] = useState(true);
  const [userSettingsError, setUserSettingsError] = useState<string>();
  const [password, setPassword] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordSaveMessage, setPasswordSaveMessage] = useState<string>();

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
        setSalespeople([]);
      } else {
        setSalespeople(payload.salespeople ?? []);
      }

      setIsLoadingSalespeople(false);
    }

    loadSalespeople();

    return () => {
      isMounted = false;
    };
  }, []);

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedSalesperson || isSavingPassword) {
      return;
    }

    setIsSavingPassword(true);
    setUserSettingsError(undefined);
    setPasswordSaveMessage(undefined);

    const response = await fetch("/api/admin/user-settings", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ salesperson: selectedSalesperson, password }),
    });
    const payload = (await response.json()) as PasswordUpdateResponse;

    if (!response.ok) {
      setUserSettingsError(payload.error ?? "Password could not be updated.");
      setIsSavingPassword(false);
      return;
    }

    setPassword("");
    setPasswordSaveMessage(
      `${selectedSalesperson} password updated successfully.`,
    );
    setIsSavingPassword(false);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setSelectedFile(file);
    setUploadErrorMessage(undefined);
    setUploadProgressText(
      file ? `${file.name} selected` : "Waiting for CSV file",
    );
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
      setUploadHistory((history) => [
        {
          ...payload,
          fileName: selectedFile.name,
          status: "error",
          uploadedAt: new Date().toISOString(),
        },
        ...history,
      ]);
      setIsUploading(false);
      return;
    }

    setUploadProgressText(
      `Completed: ${payload.rowsUploaded?.toLocaleString() ?? 0} rows uploaded`,
    );
    setUploadHistory((history) => [
      { ...payload, status: "success" },
      ...history,
    ]);
    setSelectedFile(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setIsUploading(false);
  }

  return (
    <section className="mt-8 space-y-6">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-950 text-white shadow-2xl shadow-slate-300/60 dark:border-slate-800 dark:shadow-black/30">
        <div className="relative p-6 sm:p-8">
          <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-blue-500/30 blur-3xl" />
          <div className="absolute bottom-0 left-20 h-40 w-40 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100">
                Admin Control Center
              </span>
              <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
                Credit rows CSV upload
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Upload CSV files directly to Supabase credit_rows with the same
                column aliases, null-filling, quantity parsing, and batch insert
                flow from the desktop uploader.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 text-sm text-slate-200 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Last success
              </p>
              <p className="mt-2 font-semibold text-white">
                {lastSuccessfulUpload?.fileName ?? "No upload yet"}
              </p>
              <p className="mt-1 text-slate-300">
                {formatDateTime(lastSuccessfulUpload?.uploadedAt)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Last upload rows
          </p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
            {lastSuccessfulUpload?.rowsUploaded?.toLocaleString() ?? "—"}
          </p>
          <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
            {lastSuccessfulUpload?.fileName ?? "no upload in this session"}
          </p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Last upload batches
          </p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
            {lastSuccessfulUpload?.batches?.toLocaleString() ?? "—"}
          </p>
          <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
            Batch size:{" "}
            {lastSuccessfulUpload?.batchSize?.toLocaleString() ?? "500"}
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold tracking-tight text-slate-950 dark:text-white">
                CSV uploader
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Select a CSV file and send it to credit_rows in batches.
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${isUploading ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300"}`}
            >
              {isUploading ? "Uploading" : "Ready"}
            </span>
          </div>

          <label className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center transition hover:border-blue-400 hover:bg-blue-50/60 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:border-blue-500 dark:hover:bg-blue-950/30">
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
            <span className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
              Recognized headers are mapped automatically; missing allowed
              columns are sent as null. After upload, the result is inserted
              directly into Supabase.
            </span>
          </label>

          <button
            type="button"
            onClick={uploadCsv}
            disabled={!selectedFile || isUploading}
            className="mt-5 w-full rounded-2xl bg-blue-700 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-700/20 transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none dark:disabled:bg-slate-800"
          >
            {isUploading ? "Uploading to Supabase..." : "Upload to Supabase"}
          </button>

          <div className="mt-5 rounded-2xl bg-slate-50 p-4 dark:bg-slate-900/70">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              Activity
            </p>
            <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              {uploadProgressText}
            </p>
            {uploadErrorMessage ? (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                {uploadErrorMessage}
              </p>
            ) : null}
          </div>

          {uploadHistory.length > 0 ? (
            <div className="mt-5 space-y-3">
              <h4 className="text-sm font-bold text-slate-950 dark:text-white">
                Session upload history
              </h4>
              {uploadHistory.slice(0, 4).map((entry, index) => (
                <div
                  key={`${entry.fileName}-${entry.uploadedAt}-${index}`}
                  className="rounded-2xl border border-slate-200 p-3 text-sm dark:border-slate-800"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate font-semibold text-slate-800 dark:text-slate-100">
                      {entry.fileName}
                    </p>
                    <span
                      className={`rounded-full px-2 py-1 text-[11px] font-bold ${entry.status === "success" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}
                    >
                      {entry.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {entry.status === "success"
                      ? `${entry.rowsUploaded} rows • ${entry.batches} batches`
                      : entry.error}{" "}
                    • {formatDateTime(entry.uploadedAt)}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-6">
          <div>
            <h3 className="text-xl font-bold tracking-tight text-slate-950 dark:text-white">
              User Settings
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Select a user from app_users and set a new login password.
            </p>
          </div>

          <div className="mt-6 max-h-72 space-y-2 overflow-y-auto pr-1">
            {isLoadingSalespeople ? (
              <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                Loading users...
              </p>
            ) : null}
            {!isLoadingSalespeople && salespeople.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                No active salesperson user found in app_users.
              </p>
            ) : null}
            {salespeople.map((salesperson) => {
              const isSelected = selectedSalesperson === salesperson;

              return (
                <div key={salesperson} className="space-y-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSalesperson(salesperson);
                      setPassword("");
                      setPasswordSaveMessage(undefined);
                      setUserSettingsError(undefined);
                    }}
                    className={`w-full rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                      isSelected
                        ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-200"
                        : "border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:border-blue-700 dark:hover:bg-slate-900"
                    }`}
                  >
                    {salesperson}
                  </button>

                  {isSelected ? (
                    <form
                      onSubmit={savePassword}
                      className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-900/70"
                    >
                      <label
                        className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400"
                        htmlFor="salesperson-password"
                      >
                        New password for {selectedSalesperson}
                      </label>
                      <input
                        id="salesperson-password"
                        type="password"
                        minLength={6}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        disabled={isSavingPassword}
                        className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:disabled:bg-slate-800"
                        placeholder="Enter at least 6 characters"
                      />
                      <button
                        type="submit"
                        disabled={password.length < 6 || isSavingPassword}
                        className="mt-4 w-full rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-slate-950/10 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none dark:bg-blue-700 dark:hover:bg-blue-600 dark:disabled:bg-slate-800"
                      >
                        {isSavingPassword
                          ? "Saving password..."
                          : "Save new password"}
                      </button>
                      {passwordSaveMessage ? (
                        <p className="mt-3 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                          {passwordSaveMessage}
                        </p>
                      ) : null}
                      {userSettingsError ? (
                        <p className="mt-3 text-sm text-red-600 dark:text-red-400">
                          {userSettingsError}
                        </p>
                      ) : null}
                    </form>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
