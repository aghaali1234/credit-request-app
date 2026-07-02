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

type UserSettingsResponse = {
  salespeople?: string[];
  error?: string;
};

type PasswordUpdateResponse = {
  ok?: boolean;
  error?: string;
};

type DuplicateRemoveResponse = {
  deletedRows?: number;
  error?: string;
};

export function AdminDashboard() {
  const [selectedFile, setSelectedFile] = useState<File>();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState(
    "Waiting for CSV file",
  );
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string>();
  const [isRemovingDuplicates, setIsRemovingDuplicates] = useState(false);
  const [duplicateRemoveMessage, setDuplicateRemoveMessage] = useState<string>();
  const [duplicateRemoveError, setDuplicateRemoveError] = useState<string>();
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  function clearSelectedFile() {
    if (isUploading) {
      return;
    }

    setSelectedFile(undefined);
    setUploadErrorMessage(undefined);
    setUploadProgressText("Waiting for CSV file");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function removeDuplicates() {
    if (isRemovingDuplicates) {
      return;
    }

    setIsRemovingDuplicates(true);
    setDuplicateRemoveMessage(undefined);
    setDuplicateRemoveError(undefined);

    const response = await fetch("/api/admin/credit-rows-duplicates", {
      method: "POST",
    });
    const payload = (await response.json()) as DuplicateRemoveResponse;

    if (!response.ok) {
      setDuplicateRemoveError(
        payload.error ?? "Duplicate remove operation failed.",
      );
      setIsRemovingDuplicates(false);
      return;
    }

    setDuplicateRemoveMessage(
      `Duplicate remove completed: ${(payload.deletedRows ?? 0).toLocaleString()} rows deleted.`,
    );
    setIsRemovingDuplicates(false);
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
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-6">
          <h3 className="text-xl font-bold tracking-tight text-slate-950 dark:text-white">
            CSV uploader
          </h3>

          <div className="relative mt-6">
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
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {uploadProgressText}
            </p>
            {uploadErrorMessage ? (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                {uploadErrorMessage}
              </p>
            ) : null}

            <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
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
              <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                Deletes duplicate credit rows that match by customer code,
                invoice no, item no, quantity, and piece price.
              </p>
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

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-6">
          <h3 className="text-xl font-bold tracking-tight text-slate-950 dark:text-white">
            User Settings
          </h3>

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
                      setSelectedSalesperson(
                        isSelected ? undefined : salesperson,
                      );
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
