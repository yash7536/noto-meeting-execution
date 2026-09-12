import type { AmbiguityFlagType, ItemType, ReviewState } from "./types";

export function formatLongDate(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export function formatShortDate(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export const ITEM_TYPE_LABEL: Record<ItemType, string> = {
  action: "Action",
  decision: "Decision",
  question: "Open Question",
  risk: "Risk / Blocker",
};

export const ITEM_TYPE_ICON: Record<ItemType, string> = {
  action: "task_alt",
  decision: "gavel",
  question: "help",
  risk: "warning",
};

export const REVIEW_STATE_LABEL: Record<ReviewState, string> = {
  extracted: "Confirmed",
  needs_review: "Needs Review",
  edited: "Human Edited",
  approved: "Approved",
  rejected: "Rejected",
};

export const AMBIGUITY_LABEL: Record<AmbiguityFlagType, string> = {
  owner_unclear: "Owner unclear",
  deadline_unclear: "Deadline unclear",
  status_unconfirmed: "Status needs confirmation",
  conflicting_statements: "Conflicting statements",
  evidence_needs_review: "Evidence needs review",
  needs_clarification: "Needs clarification",
};

export function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

export function readTimeMinutes(text: string): number {
  return Math.max(1, Math.ceil(wordCount(text) / 140));
}
