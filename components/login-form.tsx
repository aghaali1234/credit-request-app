"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";

type LoginFormProps = {
  initialError?: string | null;
};

export function LoginForm({ initialError = null }: LoginFormProps) {
  const [error, setError] = useState<string | null>(initialError);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsPending(true);

    const formData = new FormData(event.currentTarget);
    const username = formData.get("username")?.toString() ?? "";
    const password = formData.get("password")?.toString() ?? "";

    const response = await signIn("credentials", {
      username,
      password,
      callbackUrl: "/dashboard",
      redirect: true,
    });

    if (response?.error) {
      setError("Invalid username or password.");
      setIsPending(false);
    }
  }

  return (
    <form className="w-full space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-1.5">
        <label
          className="block text-sm font-medium tracking-tight text-zinc-700 dark:text-zinc-200"
          htmlFor="username"
        >
          Username
        </label>
        <input
          id="username"
          name="username"
          type="text"
          required
          className="w-full rounded-xl border border-zinc-300/80 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none ring-zinc-900/5 transition placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-zinc-100/10 dark:focus:border-zinc-500"
          autoComplete="username"
          placeholder="Enter your username"
        />
      </div>

      <div className="space-y-1.5">
        <label
          className="block text-sm font-medium tracking-tight text-zinc-700 dark:text-zinc-200"
          htmlFor="password"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          className="w-full rounded-xl border border-zinc-300/80 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none ring-zinc-900/5 transition placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-zinc-100/10 dark:focus:border-zinc-500"
          autoComplete="current-password"
          placeholder="Enter your password"
        />
      </div>

      {error ? <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p> : null}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-xl bg-zinc-900 px-3.5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isPending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
