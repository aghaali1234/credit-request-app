"use client";

import { useEffect } from "react";
import { flushSync } from "react-dom";
import { usePathname } from "next/navigation";

export const MODAL_NAVIGATION_CLEANUP_EVENT = "credit-request:modal-navigation-cleanup";

function resetElementInteractionState(element: HTMLElement) {
  element.inert = false;
  element.removeAttribute("inert");
  element.removeAttribute("aria-hidden");
  element.style.overflow = "";
  element.style.pointerEvents = "";
  element.style.position = "";
}

export function cleanupDocumentInteractionState() {
  resetElementInteractionState(document.documentElement);
  resetElementInteractionState(document.body);
  document.body.classList.remove("modal-open", "overflow-hidden");

  const rootElement = document.getElementById("__next") ?? document.body.firstElementChild;
  if (rootElement instanceof HTMLElement) {
    resetElementInteractionState(rootElement);
  }
}

function requestModalStateReset({ sync = false }: { sync?: boolean } = {}) {
  if (sync) {
    flushSync(() => {
      window.dispatchEvent(new Event(MODAL_NAVIGATION_CLEANUP_EVENT));
    });
  } else {
    window.dispatchEvent(new Event(MODAL_NAVIGATION_CLEANUP_EVENT));
  }

  cleanupDocumentInteractionState();
}

export function NavigationModalCleanup() {
  const pathname = usePathname();

  useEffect(() => {
    requestModalStateReset();
  }, [pathname]);

  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      // Mobile browsers can restore a stale DOM from bfcache. Always clean up,
      // with event.persisted covering the back-forward cache case explicitly.
      if (event.persisted) {
        requestModalStateReset();
        return;
      }

      requestModalStateReset();
    }

    function handlePageHide() {
      // On mobile swipe/back navigations the outgoing page can be frozen into
      // bfcache before a later pageshow cleanup has a chance to run. Close any
      // React-owned modal state synchronously so the cached snapshot is clean.
      requestModalStateReset({ sync: true });
    }

    function handlePopState() {
      requestModalStateReset();
    }

    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("popstate", handlePopState);
      cleanupDocumentInteractionState();
    };
  }, []);

  return null;
}
