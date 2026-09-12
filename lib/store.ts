"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  ExecutionItem,
  FollowUpConfig,
  Meeting,
  ReviewState,
} from "./types";
import { buildSeedData } from "./seed";

interface CopilotState {
  meetings: Meeting[];
  items: ExecutionItem[];
  hydrated: boolean;

  // meetings
  addMeeting: (meeting: Meeting, items: ExecutionItem[]) => void;
  getMeeting: (id: string) => Meeting | undefined;
  itemsForMeeting: (id: string) => ExecutionItem[];
  setMeetingStatus: (id: string, status: Meeting["status"]) => void;
  approveMeetingPlan: (id: string, approvedBy: string) => void;
  setFollowUp: (id: string, config: FollowUpConfig) => void;

  // items
  updateItem: (id: string, patch: Partial<ExecutionItem>) => void;
  setReviewState: (id: string, state: ReviewState) => void;
  approveItem: (id: string) => void;
  rejectItem: (id: string) => void;
  approveAllReady: (meetingId: string) => void;
  resolveConflict: (itemId: string, resolutionLabel: string, resolutionNote?: string, resolvedBy?: string) => void;
}

const initialSeed = buildSeedData();

export const useCopilotStore = create<CopilotState>()(
  persist(
    (set, get) => ({
      meetings: initialSeed.meetings,
      items: initialSeed.items,
      hydrated: false,

      addMeeting: (meeting, items) =>
        set((s) => ({
          meetings: [meeting, ...s.meetings],
          items: [...items, ...s.items],
        })),

      getMeeting: (id) => get().meetings.find((m) => m.id === id),

      itemsForMeeting: (id) => get().items.filter((it) => it.meetingId === id),

      setMeetingStatus: (id, status) =>
        set((s) => ({
          meetings: s.meetings.map((m) => (m.id === id ? { ...m, status } : m)),
        })),

      approveMeetingPlan: (id, approvedBy) =>
        set((s) => ({
          meetings: s.meetings.map((m) =>
            m.id === id
              ? { ...m, status: "approved", approvedAt: new Date().toISOString(), approvedBy }
              : m
          ),
        })),

      setFollowUp: (id, config) =>
        set((s) => ({
          meetings: s.meetings.map((m) => (m.id === id ? { ...m, followUp: config } : m)),
        })),

      updateItem: (id, patch) =>
        set((s) => ({
          items: s.items.map((it) =>
            it.id === id
              ? { ...it, ...patch, updatedAt: new Date().toISOString() }
              : it
          ),
        })),

      setReviewState: (id, state) =>
        set((s) => ({
          items: s.items.map((it) =>
            it.id === id ? { ...it, status: state, updatedAt: new Date().toISOString() } : it
          ),
        })),

      approveItem: (id) => get().setReviewState(id, "approved"),
      rejectItem: (id) => get().setReviewState(id, "rejected"),

      approveAllReady: (meetingId) =>
        set((s) => ({
          items: s.items.map((it) =>
            it.meetingId === meetingId &&
            it.status !== "needs_review" &&
            it.status !== "rejected"
              ? { ...it, status: "approved", updatedAt: new Date().toISOString() }
              : it
          ),
        })),

      resolveConflict: (itemId, resolutionLabel, resolutionNote, resolvedBy) =>
        set((s) => ({
          items: s.items.map((it) => {
            if (it.id !== itemId || !it.conflict) return it;
            return {
              ...it,
              conflict: {
                ...it.conflict,
                resolved: true,
                resolutionLabel,
                resolutionNote,
                resolvedBy: resolvedBy ?? "Yash",
                resolvedAt: new Date().toISOString(),
              },
              ambiguityFlags: it.ambiguityFlags.filter((f) => f.type !== "conflicting_statements"),
              status: "edited",
              updatedAt: new Date().toISOString(),
            };
          }),
        })),
    }),
    {
      name: "meeting-execution-copilot",
      version: 3,
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
      merge: (persisted, current) => {
        const merged = { ...current, ...(persisted as Partial<CopilotState>) };
        if (!merged.meetings || merged.meetings.length === 0) {
          merged.meetings = initialSeed.meetings;
          merged.items = initialSeed.items;
        }
        merged.hydrated = true;
        return merged;
      },
    }
  )
);

/** Call once on the client (see StoreHydration) to load any persisted
 * edits from localStorage on top of the deterministic seed data used for
 * the very first server/client render. */
export function hydrateStore() {
  void useCopilotStore.persist.rehydrate();
}

/* ------------------------------------------------------------------ */
/* Derived helpers                                                     */
/* ------------------------------------------------------------------ */

export function itemCounts(items: ExecutionItem[]) {
  const byType = {
    action: items.filter((i) => i.type === "action"),
    decision: items.filter((i) => i.type === "decision"),
    question: items.filter((i) => i.type === "question"),
    risk: items.filter((i) => i.type === "risk"),
  };
  const needsReview = items.filter((i) => i.status === "needs_review");
  const approved = items.filter((i) => i.status === "approved");
  const ready = items.filter((i) => i.status !== "needs_review" && i.status !== "rejected");
  return { byType, needsReview, approved, ready, total: items.length };
}
