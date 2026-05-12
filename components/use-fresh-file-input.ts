"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Keeps hidden file inputs safe across mobile back/forward-cache restores.
 *
 * Mobile browsers can restore a stale DOM node after swipe-back/browser-back
 * navigation. Always trigger the picker from the current user click with the
 * latest mounted input ref, and bump this key whenever modal interaction state
 * is reset so React replaces any restored file input node.
 */
export function useFreshFileInput() {
  const [fileInputKey, setFileInputKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const resetFileInput = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    fileInputRef.current = null;
    setFileInputKey((currentKey) => currentKey + 1);
  }, []);

  return { fileInputKey, fileInputRef, resetFileInput };
}
