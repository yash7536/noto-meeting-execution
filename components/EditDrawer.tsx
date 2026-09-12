"use client";

import { useState } from "react";
import { Icon } from "./Icon";
import { useCopilotStore } from "@/lib/store";
import type { ExecutionItem, ItemType, Priority } from "@/lib/types";

const TYPES: { key: ItemType; label: string }[] = [
  { key: "action", label: "Action" },
  { key: "decision", label: "Decision" },
  { key: "question", label: "Question" },
  { key: "risk", label: "Risk" },
];

const PRIORITIES: Priority[] = ["Low", "Medium", "High", "Urgent"];

export function EditDrawer({
  item,
  participantNames,
  onClose,
}: {
  item: ExecutionItem;
  participantNames: string[];
  onClose: () => void;
}) {
  const updateItem = useCopilotStore((s) => s.updateItem);
  const rejectItem = useCopilotStore((s) => s.rejectItem);

  const [type, setType] = useState<ItemType>(item.type);
  const [title, setTitle] = useState(item.title);
  const [owner, setOwner] = useState(item.owner ?? "");
  const [deadline, setDeadline] = useState(item.deadline ?? "");
  const [deadlineConfirmed, setDeadlineConfirmed] = useState(item.deadlineConfirmed ?? false);
  const [priority, setPriority] = useState<Priority>(item.priority ?? "Medium");
  const [targetJira, setTargetJira] = useState(item.targetJira ?? false);
  const [targetEmail, setTargetEmail] = useState(item.targetEmail ?? true);
  const [targetNotion, setTargetNotion] = useState(item.targetNotion ?? false);

  const ownerOptions = Array.from(new Set([...(item.ownerCandidates ?? []), ...participantNames]));
  const stillAmbiguousOwner = !owner;
  const stillAmbiguousDeadline = !deadline;

  function handleSave() {
    const ambiguityFlags = item.ambiguityFlags.filter((f) => {
      if (f.type === "owner_unclear") return stillAmbiguousOwner;
      if (f.type === "deadline_unclear") return stillAmbiguousDeadline;
      return true;
    });
    updateItem(item.id, {
      type,
      title: title.trim() || item.title,
      owner: owner || undefined,
      ownerCandidates: owner ? undefined : item.ownerCandidates,
      deadline: deadline || undefined,
      deadlineConfirmed,
      priority,
      targetJira,
      targetEmail,
      targetNotion,
      ambiguityFlags,
      status: "edited",
    });
    onClose();
  }

  function handleDelete() {
    rejectItem(item.id);
    onClose();
  }

  return (
    <div className="fixed inset-0 top-16 left-0 lg:left-64 bg-on-surface/40 backdrop-blur-sm z-50 flex items-stretch justify-end animate-fade-in" onClick={onClose}>
      <div
        className="h-full w-full max-w-2xl bg-surface-container-lowest shadow-2xl flex flex-col justify-between overflow-hidden animate-drawer-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-space-xl pt-space-lg pb-space-md bg-surface-container-lowest flex flex-col gap-space-xs shadow-[0_1px_4px_rgba(0,0,0,0.03)] z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-space-xs text-outline font-label-sm text-label-sm tracking-wider uppercase">
              <span className="font-mono-metric text-mono-metric text-secondary font-semibold">Item {item.code}</span>
              <span>/</span>
              <span className="text-on-surface-variant font-semibold">Edit &amp; Clarify</span>
            </div>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface flex items-center justify-center transition-colors"
              title="Close Drawer"
              type="button"
            >
              <Icon name="close" className="text-lg" />
            </button>
          </div>
          <div className="flex flex-col gap-space-2xs mt-space-2xs">
            <h2 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">Edit Execution Item</h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Modify extracted parameters, resolve ambiguous owners, or change classification. The human decision overrides the copilot extraction.
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-space-xl py-space-lg flex flex-col gap-space-xl">
          {/* Type selector */}
          <div className="flex flex-col gap-space-xs">
            <label className="font-label-sm text-label-sm text-outline uppercase tracking-wider font-semibold">Classification Type</label>
            <div className="grid grid-cols-4 p-space-2xs bg-surface-container-low rounded-xl gap-space-2xs" role="tablist">
              {TYPES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setType(t.key)}
                  className={
                    type === t.key
                      ? "py-space-xs px-space-sm bg-surface-container-lowest text-on-surface font-label-md text-label-md font-semibold rounded-lg shadow-sm flex items-center justify-center gap-space-2xs transition-all"
                      : "py-space-xs px-space-sm text-on-surface-variant hover:text-on-surface font-label-md text-label-md rounded-lg flex items-center justify-center gap-space-2xs transition-all"
                  }
                >
                  <span className={`h-2 w-2 rounded-full ${type === t.key ? "bg-secondary" : "bg-outline-variant"}`} />
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="flex flex-col gap-space-xs">
            <div className="flex items-center justify-between">
              <label className="font-label-sm text-label-sm text-outline uppercase tracking-wider font-semibold">Title</label>
              <span className="font-mono-code text-mono-code text-outline">Transcript-anchored</span>
            </div>
            <div className="relative rounded-xl bg-surface-container-low focus-within:bg-surface-container-lowest transition-colors shadow-sm">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-transparent px-space-md py-space-sm font-body-md text-body-md text-on-surface font-medium focus:outline-none"
              />
            </div>
          </div>

          {/* Owner */}
          {(type === "action" || type === "risk") && (
            <div className="flex flex-col gap-space-xs">
              <div className="flex items-center justify-between">
                <label className="font-label-sm text-label-sm text-outline uppercase tracking-wider font-semibold">Assigned Owner</label>
                {stillAmbiguousOwner && (
                  <span className="font-label-sm text-label-sm text-error font-semibold flex items-center gap-space-2xs">
                    <Icon name="flag" className="text-sm" /> Action Required
                  </span>
                )}
              </div>
              {item.ownerCandidates && item.ownerCandidates.length > 0 && (
                <div className="flex items-start gap-space-sm p-space-sm bg-error-container/40 rounded-xl">
                  <Icon name="warning" className="text-error text-lg mt-0.5" />
                  <div className="flex flex-col">
                    <span className="font-label-md text-label-md text-on-error-container font-semibold">
                      AI Flagged Ambiguity: {item.ownerCandidates.length} candidate names mentioned in transcript
                    </span>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-space-2xs">
                      Candidates: {item.ownerCandidates.join(", ")}. Select the definitive assignee.
                    </p>
                  </div>
                </div>
              )}
              <div className="relative mt-space-2xs">
                <select
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  className="w-full appearance-none bg-surface-container-low hover:bg-surface-container rounded-xl px-space-md py-space-sm pr-space-xl font-body-md text-body-md text-on-surface font-medium focus:outline-none shadow-sm cursor-pointer transition-colors"
                >
                  <option value="">— Needs Clarification / Unassigned —</option>
                  {ownerOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-space-md text-on-surface-variant">
                  <Icon name="unfold_more" className="text-lg" />
                </div>
              </div>
            </div>
          )}

          {/* Due date & priority */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-lg">
            <div className="flex flex-col gap-space-xs">
              <label className="font-label-sm text-label-sm text-outline uppercase tracking-wider font-semibold">Due Date / Deadline</label>
              <div className="relative flex items-center bg-surface-container-low rounded-xl px-space-md py-space-xs shadow-sm">
                <Icon name="calendar_today" className="text-secondary text-lg mr-space-xs" />
                <input
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  placeholder="e.g. Friday, September 12, 2026"
                  className="w-full bg-transparent py-space-2xs font-mono-metric text-mono-metric text-on-surface font-semibold focus:outline-none"
                />
              </div>
              <label className="flex items-center gap-space-xs mt-space-2xs cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={deadlineConfirmed}
                  onChange={(e) => setDeadlineConfirmed(e.target.checked)}
                  className="rounded-md accent-primary h-4 w-4"
                />
                <span className="font-body-sm text-body-sm text-on-surface-variant">Exact date confirmed in transcript</span>
              </label>
            </div>
            <div className="flex flex-col gap-space-xs">
              <label className="font-label-sm text-label-sm text-outline uppercase tracking-wider font-semibold">Priority / Impact</label>
              <div className="grid grid-cols-4 p-space-2xs bg-surface-container-low rounded-xl gap-space-2xs">
                {PRIORITIES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={
                      priority === p
                        ? "py-space-xs bg-primary-container text-on-primary-container font-label-sm text-label-sm font-bold rounded-lg text-center shadow-sm transition-all"
                        : "py-space-xs text-on-surface-variant hover:text-on-surface font-label-sm text-label-sm rounded-lg text-center transition-colors"
                    }
                  >
                    {p === "Medium" ? "Med" : p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Evidence (read-only) */}
          <div className="flex flex-col gap-space-xs">
            <div className="flex items-center justify-between">
              <label className="font-label-sm text-label-sm text-outline uppercase tracking-wider font-semibold">Anchored Evidence Quote</label>
              {item.evidence[0] && (
                <span className="flex items-center gap-space-2xs font-mono-metric text-mono-metric text-secondary font-semibold bg-surface-container-low px-space-xs py-space-2xs rounded">
                  <Icon name="timer" className="text-xs" /> {item.evidence[0].timestamp}
                </span>
              )}
            </div>
            <div className="relative bg-surface-container-low rounded-xl p-space-md shadow-inner flex flex-col gap-space-sm">
              <div className="flex items-center gap-space-xs">
                <span className="h-2 w-2 rounded-full bg-secondary" />
                <span className="font-mono-code text-mono-code text-secondary font-semibold uppercase tracking-wider">Verified transcript slice</span>
              </div>
              <blockquote className="font-mono-code text-mono-code text-on-surface pl-space-sm border-l-2 border-secondary space-y-space-xs">
                {item.evidence.map((e, i) => (
                  <p key={i}>
                    <span className="text-outline font-semibold">
                      [{e.timestamp}] {e.speaker}:
                    </span>{" "}
                    {e.quote}
                  </p>
                ))}
              </blockquote>
            </div>
          </div>

          {/* Targets */}
          <div className="flex flex-col gap-space-xs">
            <label className="font-label-sm text-label-sm text-outline uppercase tracking-wider font-semibold">Target Integration Pipeline</label>
            <div className="flex flex-col gap-space-xs bg-surface-container-low p-space-md rounded-xl">
              <label className="flex items-start gap-space-sm cursor-pointer select-none p-space-xs hover:bg-surface-container rounded-lg transition-colors">
                <input type="checkbox" checked={targetJira} onChange={(e) => setTargetJira(e.target.checked)} className="mt-1 rounded-md accent-primary h-4 w-4" />
                <div className="flex flex-col">
                  <span className="font-body-md text-body-md text-on-surface font-semibold">Queue for Jira issue creation</span>
                  <span className="font-body-sm text-body-sm text-outline">Will sync as an issue once the plan is approved.</span>
                </div>
              </label>
              <label className="flex items-start gap-space-sm cursor-pointer select-none p-space-xs hover:bg-surface-container rounded-lg transition-colors">
                <input type="checkbox" checked={targetEmail} onChange={(e) => setTargetEmail(e.target.checked)} className="mt-1 rounded-md accent-primary h-4 w-4" />
                <div className="flex flex-col">
                  <span className="font-body-md text-body-md text-on-surface font-semibold">Include in stakeholder follow-up email</span>
                  <span className="font-body-sm text-body-sm text-outline">Appends to the executive digest for attendees.</span>
                </div>
              </label>
              <label className="flex items-start gap-space-sm cursor-pointer select-none p-space-xs hover:bg-surface-container rounded-lg transition-colors">
                <input type="checkbox" checked={targetNotion} onChange={(e) => setTargetNotion(e.target.checked)} className="mt-1 rounded-md accent-primary h-4 w-4" />
                <div className="flex flex-col">
                  <span className="font-body-md text-body-md text-on-surface font-semibold">Sync to Notion Execution Matrix</span>
                  <span className="font-body-sm text-body-sm text-outline">Database: Q3 Deliverables Hub / Roadmap</span>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="px-space-xl py-space-md bg-surface-container-lowest flex items-center justify-between shadow-[0_-1px_4px_rgba(0,0,0,0.03)] z-10">
          <button
            onClick={handleDelete}
            type="button"
            className="inline-flex items-center gap-space-2xs text-error hover:text-on-error-container hover:bg-error-container/20 px-space-sm py-space-xs rounded-lg font-label-md text-label-md font-semibold transition-colors"
          >
            <Icon name="delete" className="text-base" />
            <span>Delete Item</span>
          </button>
          <div className="flex items-center gap-space-sm">
            <button
              onClick={onClose}
              type="button"
              className="px-space-md py-space-xs bg-surface-container-low hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-semibold rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              type="button"
              className="inline-flex items-center gap-space-xs px-space-lg py-space-xs bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md font-semibold rounded-lg shadow-sm transition-all"
            >
              <Icon name="check" className="text-base" />
              <span>Save &amp; Mark Confirmed</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
