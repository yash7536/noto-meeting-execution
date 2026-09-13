"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Measures the currently-active tab button (matched by a `data-tab-key`
 * attribute inside the returned containerRef) and returns a position/size
 * for an absolutely-positioned indicator element, so the active pill can
 * slide between tabs instead of appearing instantly on the new one.
 */
export function useSlidingIndicator(activeKey: string) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<{ left: number; width: number; ready: boolean }>({
    left: 0,
    width: 0,
    ready: false,
  });

  useIsomorphicLayoutEffect(() => {
    function measure() {
      const container = containerRef.current;
      if (!container) return;
      const el = container.querySelector<HTMLElement>(`[data-tab-key="${activeKey}"]`);
      if (!el) return;
      const containerRect = container.getBoundingClientRect();
      const rect = el.getBoundingClientRect();
      setStyle({ left: rect.left - containerRect.left, width: rect.width, ready: true });
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [activeKey]);

  return { containerRef, style };
}
