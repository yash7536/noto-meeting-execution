"use client";

import { useCountUp } from "@/lib/useCountUp";

/** Renders an integer with a short count-up tween on mount and on change. */
export function CountUp({ value, durationMs = 700 }: { value: number; durationMs?: number }) {
  const display = useCountUp(value, durationMs);
  return <>{display}</>;
}

/** Same component, exported under the name used elsewhere for "a numeric
 * metric that animates in" — kept as an alias rather than a rename so
 * existing call sites don't need to churn. */
export { CountUp as AnimatedNumber };
