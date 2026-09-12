import { Icon } from "./Icon";
import type { ReviewState } from "@/lib/types";

export function StatusBadge({ status }: { status: ReviewState }) {
  switch (status) {
    case "approved":
      return (
        <span className="px-space-sm py-space-2xs bg-surface-container-low text-tertiary font-label-sm text-label-sm rounded-full font-bold uppercase tracking-wider inline-flex items-center gap-space-2xs">
          <Icon name="verified" className="text-sm" />
          Approved
        </span>
      );
    case "needs_review":
      return (
        <span className="px-space-sm py-space-2xs bg-error-container text-on-error-container font-label-sm text-label-sm rounded-full flex items-center gap-space-2xs font-semibold">
          <span className="h-1.5 w-1.5 rounded-full bg-error animate-pulse" />
          Needs Review
        </span>
      );
    case "edited":
      return (
        <span className="px-space-sm py-space-2xs bg-secondary-fixed text-on-secondary-fixed-variant font-label-sm text-label-sm rounded-full flex items-center gap-space-2xs font-semibold">
          <Icon name="edit" className="text-xs" />
          Human Edited
        </span>
      );
    case "rejected":
      return (
        <span className="px-space-sm py-space-2xs bg-surface-container text-outline font-label-sm text-label-sm rounded-full flex items-center gap-space-2xs font-semibold line-through">
          Rejected
        </span>
      );
    case "extracted":
    default:
      return (
        <span className="px-space-sm py-space-2xs bg-surface-container text-tertiary-container font-label-sm text-label-sm rounded-full flex items-center gap-space-2xs">
          <span className="h-1.5 w-1.5 rounded-full bg-tertiary-fixed-dim" />
          Confirmed
        </span>
      );
  }
}

export function TypeBadge({ type }: { type: "action" | "decision" | "question" | "risk" }) {
  const meta = {
    action: { label: "Action", bg: "bg-primary-container", fg: "text-on-primary-container" },
    decision: { label: "Decision", bg: "bg-secondary-container", fg: "text-on-secondary-container" },
    question: { label: "Open Question", bg: "bg-surface-container-high", fg: "text-on-surface" },
    risk: { label: "Risk / Blocker", bg: "bg-error-container", fg: "text-on-error-container" },
  }[type];
  return (
    <span className={`px-space-sm py-space-2xs ${meta.bg} ${meta.fg} font-label-sm text-label-sm font-semibold rounded uppercase tracking-wider`}>
      {meta.label}
    </span>
  );
}
