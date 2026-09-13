"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animates a displayed integer from its previous value to `value` using a
 * short ease-out tween (rAF-driven, transform/opacity-free — just a number).
 * On first mount this animates up from 0 (the "dashboard numbers count up on
 * load" effect); on later updates it animates from the last displayed value
 * to the new one, so a live count change eases rather than jumping.
 *
 * Respects prefers-reduced-motion by skipping straight to the final value.
 */
export function useCountUp(value: number, durationMs = 700): number {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    if (from === to) return;

    const reduceMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
      // Still hop through a rAF callback (rather than calling setState
      // synchronously in the effect body) — same next-frame timing as the
      // animated path below, just without the tween in between.
      frameRef.current = requestAnimationFrame(() => {
        prevRef.current = to;
        setDisplay(to);
      });
      return () => {
        if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
      };
    }

    const start = performance.now();
    function tick(now: number) {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        prevRef.current = to;
      }
    }
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
    };
  }, [value, durationMs]);

  return display;
}
