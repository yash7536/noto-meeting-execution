"use client";

import { Icon } from "./Icon";
import { useToastStore } from "@/lib/toast";

/** Global toast stack, mounted once in AppShell. Renders above everything
 * else (including the EditDrawer) so save/approve/reject/copy feedback is
 * always visible regardless of which panel triggered it. */
export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const beginDismiss = useToastStore((s) => s.beginDismiss);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[70] flex flex-col items-end gap-space-xs pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          onClick={() => beginDismiss(t.id)}
          className={`pointer-events-auto cursor-pointer flex items-center gap-space-sm px-space-base py-space-md rounded-lg shadow-xl ${
            t.leaving ? "animate-toast-out" : "animate-toast-in"
          } ${
            t.tone === "error"
              ? "bg-error text-on-error"
              : "bg-inverse-surface text-inverse-on-surface"
          }`}
        >
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
              t.tone === "error" ? "bg-on-error/20" : "bg-tertiary-fixed-dim/25"
            }`}
          >
            <Icon name={t.icon} className="text-sm" />
          </div>
          <span className="font-label-md text-label-md font-semibold">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
