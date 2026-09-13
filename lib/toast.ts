"use client";

// Lightweight global toast notification store. Kept intentionally tiny —
// no queueing config, no dedupe — because Noto only ever needs a single
// transient confirmation surface shared across deeply-nested components
// (ItemCard, EditDrawer) that don't otherwise share page-level state.
import { create } from "zustand";

export interface ToastItem {
  id: string;
  message: string;
  icon: string;
  tone: "success" | "error" | "info";
  /** True while the toast is playing its exit animation, just before removal. */
  leaving?: boolean;
}

interface ToastState {
  toasts: ToastItem[];
  /** Remove a toast immediately (no exit animation) — used internally once the exit finishes. */
  dismiss: (id: string) => void;
  /** Mark a toast as leaving so it plays its exit animation, then remove it. */
  beginDismiss: (id: string) => void;
}

const DURATION_MS = 3000;
const EXIT_MS = 180; // keep in sync with .animate-toast-out in globals.css

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  beginDismiss: (id) => {
    set((s) => ({ toasts: s.toasts.map((t) => (t.id === id ? { ...t, leaving: true } : t)) }));
    setTimeout(() => get().dismiss(id), EXIT_MS);
  },
}));

/** Fire a transient toast from anywhere in the client tree. */
export function showToast(message: string, opts?: { icon?: string; tone?: ToastItem["tone"] }) {
  const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const toast: ToastItem = {
    id,
    message,
    icon: opts?.icon ?? "check",
    tone: opts?.tone ?? "success",
  };
  useToastStore.setState((s) => ({ toasts: [...s.toasts, toast] }));
  setTimeout(() => {
    useToastStore.getState().beginDismiss(id);
  }, DURATION_MS);
}
