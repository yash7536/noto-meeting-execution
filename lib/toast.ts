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
}

interface ToastState {
  toasts: ToastItem[];
  dismiss: (id: string) => void;
}

const DURATION_MS = 3000;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
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
    useToastStore.getState().dismiss(id);
  }, DURATION_MS);
}
