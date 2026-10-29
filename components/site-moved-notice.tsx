"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const NEW_SITE_URL = "https://credits.turkanafood.com";
const REDIRECT_SECONDS = 15;

export function SiteMovedNotice() {
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) {
      window.location.href = NEW_SITE_URL;
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-notice-overlay/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="site-moved-title"
      aria-describedby="site-moved-description"
    >
      <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-xl border border-notice-border bg-notice-surface px-8 py-10 text-center text-notice-text shadow-2xl">
        <Image
          src="/turkana-logo.png"
          alt="Turkana Food"
          width={140}
          height={56}
          className="h-14 w-auto object-contain"
          priority
        />

        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-notice-primary">
            We have moved
          </p>
          <h1
            id="site-moved-title"
            className="text-balance font-sans text-2xl font-semibold leading-tight"
          >
            This website is no longer in use
          </h1>
          <p
            id="site-moved-description"
            className="text-pretty text-sm leading-relaxed text-notice-muted"
          >
            The Turkana Credit Request App has moved to a new home. Please log
            in at our new website to continue submitting and managing credit
            requests.
          </p>
        </div>

        <a
          href={NEW_SITE_URL}
          className="flex w-full items-center justify-center rounded-lg bg-notice-primary px-6 py-3 text-sm font-semibold text-notice-surface transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-notice-primary"
        >
          Go to credits.turkanafood.com
        </a>

        <p className="text-xs leading-relaxed text-notice-muted" aria-live="polite">
          {secondsLeft > 0
            ? `You will be redirected automatically in ${secondsLeft} second${secondsLeft === 1 ? "" : "s"}.`
            : "Redirecting…"}
        </p>
      </div>
    </div>
  );
}
