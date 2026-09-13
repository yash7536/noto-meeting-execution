"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "noto-sidebar-collapsed";

function readStored(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Sidebar collapsed/expanded state, persisted to localStorage.
 *
 * AppShell (and therefore the sidebar) fully remounts on every route change —
 * it isn't a persistent Next layout — so this always starts from the same
 * default (`false`, expanded) on every render, exactly matching what the
 * server renders. That avoids a hydration mismatch (the same reason the
 * main store uses `skipHydration` + a post-mount rehydrate). The persisted
 * value is then applied across two animation frames — first the collapsed
 * state itself (rendered once with transitions still suppressed), then
 * transitions are re-enabled on the frame after — so a returning user sees
 * the sidebar snap straight to their saved width instead of visibly
 * re-collapsing on every navigation.
 */
export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(false);
  const [suppressTransition, setSuppressTransition] = useState(true);

  useEffect(() => {
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      if (readStored()) setCollapsed(true);
      secondFrame = requestAnimationFrame(() => setSuppressTransition(false));
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame) cancelAnimationFrame(secondFrame);
    };
  }, []);

  function toggle() {
    setSuppressTransition(false);
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* localStorage may be unavailable (e.g. private browsing) — state still updates in-memory */
      }
      return next;
    });
  }

  return { collapsed, toggle, suppressTransition };
}
