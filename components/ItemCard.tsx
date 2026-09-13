"use client";

import { useState } from "react";
import { Icon } from "./Icon";
import { EvidenceBlock } from "./EvidenceBlock";
import { StatusBadge, TypeBadge } from "./StatusBadge";
import { AMBIGUITY_LABEL } from "@/lib/format";
import { useCopilotStore } from "@/lib/store";
import { showToast } from "@/lib/toast";
import type { ExecutionItem } from "@/lib/types";

export function ItemCard({
  item,
  onEdit,
  onViewEvidence,
}: {
  item: ExecutionItem;
  onEdit: () => void;
  onViewEvidence: (turnId: string) => void;
}) {
  const approveItem = useCopilotStore((s) => s.approveItem);
  const rejectItem = useCopilotStore((s) => s.rejectItem);
  const updateItem = useCopilotStore((s) => s.updateItem);
  const resolveConflict = useCopilotStore((s) => s.resolveConflict);
  const [chosenResolution, setChosenResolution] = useState<string>("defer");

  const hasBanner = item.status === "needs_review" && !item.conflict;
  const rejected = item.status === "rejected";

  function confirmOwner(name: string) {
    updateItem(item.id, {
      owner: name,
      ownerCandidates: undefined,
      status: "edited",
      ambiguityFlags: item.ambiguityFlags.filter((f) => f.type !== "owner_unclear"),
    });
    showToast(`Owner confirmed: ${name}`, { icon: "person_check" });
  }

  function handleApprove() {
    approveItem(item.id);
    showToast("Item approved", { icon: "check_circle" });
  }

  function handleReject() {
    rejectItem(item.id);
    showToast("Item rejected", { icon: "close", tone: "error" });
  }

  function handleResolveConflict() {
    resolveConflict(item.id, chosenResolution === "defer" ? "Deferred to a follow-up sync" : `Set as ${chosenResolution}`, undefined);
    showToast("Conflict resolved", { icon: "gavel" });
  }

  return (
    <div
      className={`bg-surface-container-lowest rounded-xl p-space-lg shadow-sm hover:shadow-md border border-transparent hover:border-outline-variant/30 transition-all duration-300 relative overflow-hidden ${
        rejected ? "opacity-50" : ""
      } ${item.conflict && !item.conflict.resolved ? "shadow-md" : ""}`}
    >
      {(hasBanner || (item.conflict && !item.conflict.resolved)) && (
        <div className={`absolute top-0 inset-x-0 h-1 ${item.type === "question" ? "bg-secondary-container" : "bg-error"}`} />
      )}

      {hasBanner && item.ambiguityFlags.length > 0 && (
        <div className="animate-badge-in bg-error-container text-on-error-container px-space-md py-space-xs rounded-lg flex items-center justify-between mb-space-md flex-wrap gap-space-xs">
          <div className="flex items-center gap-space-xs">
            <Icon name="warning" className="text-error text-base" />
            <span className="font-label-md text-label-md font-semibold">
              {item.ambiguityFlags.map((f) => f.message || AMBIGUITY_LABEL[f.type]).join(" · ")}
            </span>
          </div>
        </div>
      )}

      {item.conflict && !item.conflict.resolved && (
        <div className="animate-badge-in bg-surface-container text-on-surface px-space-md py-space-xs rounded-lg flex items-center justify-between mb-space-md flex-wrap gap-space-xs">
          <div className="flex items-center gap-space-xs">
            <Icon name="forum" className="text-secondary-container text-base" />
            <span className="font-label-md text-label-md font-semibold">Stakeholder conflict detected · needs a single resolved answer</span>
          </div>
          <span className="font-mono-metric text-mono-metric text-xs uppercase text-outline">Unresolved</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-space-sm mb-space-sm flex-wrap">
        <div className="flex items-center gap-space-xs flex-wrap">
          <TypeBadge type={item.type} />
          <span key={item.status} className="animate-pop-in inline-flex">
            <StatusBadge status={item.status} />
          </span>
          {item.supersedes && (
            <span className="px-space-sm py-space-2xs bg-secondary-fixed text-on-secondary-fixed-variant font-label-sm text-label-sm rounded-full flex items-center gap-space-2xs">
              <Icon name="history" className="text-xs" />
              Superseded in Meeting
            </span>
          )}
          {item.supersededBy && (
            <span className="px-space-sm py-space-2xs bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm rounded-full flex items-center gap-space-2xs">
              <Icon name="history" className="text-xs" />
              Superseded — see final decision
            </span>
          )}
        </div>
        <span className="font-mono-metric text-mono-metric text-outline">{item.code}</span>
      </div>

      <h2 className={`font-headline-md text-headline-md text-on-surface mb-space-sm ${rejected ? "line-through" : ""}`}>{item.title}</h2>
      {item.description && <p className="font-body-sm text-body-sm text-on-surface-variant -mt-space-xs mb-space-sm">{item.description}</p>}

      {/* Meta row (owner / deadline / priority) — actions & risks */}
      {(item.type === "action" || item.type === "risk") && !item.ownerCandidates && (
        <div className="flex flex-wrap items-center gap-x-space-lg gap-y-space-xs text-body-sm font-body-sm text-on-surface-variant bg-surface-container-low p-space-sm rounded-lg mb-space-md">
          {item.owner && (
            <div className="flex items-center gap-space-xs">
              <Icon name="person" className="text-base text-outline" />
              <span className="font-label-sm text-label-sm text-outline">Owner:</span>
              <span className="font-label-md text-label-md text-on-surface font-semibold">{item.owner}</span>
            </div>
          )}
          {item.deadline && (
            <div className="flex items-center gap-space-xs">
              <Icon name="event" className="text-base text-outline" />
              <span className="font-label-sm text-label-sm text-outline">Deadline:</span>
              <span className="font-mono-metric text-mono-metric text-on-surface">{item.deadline}</span>
            </div>
          )}
          {item.priority && (
            <div className="flex items-center gap-space-xs">
              <Icon name="flag" className={`text-base ${item.priority === "High" || item.priority === "Urgent" ? "text-error" : "text-outline"}`} />
              <span className="font-label-sm text-label-sm text-outline">Priority:</span>
              <span className={`font-label-md text-label-md font-semibold ${item.priority === "High" || item.priority === "Urgent" ? "text-error" : "text-on-surface"}`}>
                {item.priority}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Ambiguous owner meta row */}
      {item.type === "action" && item.ownerCandidates && item.ownerCandidates.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-space-lg gap-y-space-xs text-body-sm font-body-sm text-on-surface-variant bg-surface-container-low p-space-sm rounded-lg mb-space-md">
          <div className="flex items-center gap-space-xs">
            <span className="font-label-sm text-label-sm text-outline">Detected Owner:</span>
            <span className="px-space-sm py-space-2xs bg-error-container text-on-error-container rounded-lg font-label-md text-label-md font-semibold">
              {item.ownerCandidates.join(" or ")}?
            </span>
          </div>
          {item.deadline && (
            <div className="flex items-center gap-space-xs">
              <Icon name="event" className="text-base text-outline" />
              <span className="font-label-sm text-label-sm text-outline">Deadline:</span>
              <span className="font-mono-metric text-mono-metric text-on-surface">{item.deadline}</span>
            </div>
          )}
        </div>
      )}

      {/* Decision supersede diff — the three rows reveal in sequence (rather
          than all at once) so the "this replaced that" relationship reads
          clearly instead of landing as a single flat block. */}
      {item.supersedes && (
        <div className="bg-surface-container-low rounded-xl p-space-md mb-space-md flex flex-col gap-space-sm">
          <div className="animate-badge-in flex items-center justify-between text-body-sm font-body-sm text-on-surface-variant line-through opacity-70 bg-surface-container-lowest p-space-sm rounded-lg flex-wrap gap-space-xs">
            <div className="flex items-center gap-space-xs">
              <Icon name="cancel" className="text-outline text-base" />
              <span>Original Plan: {item.supersedes.previousTitle}</span>
            </div>
            <span className="font-mono-code text-mono-code text-outline">[{item.supersedes.previousTimestamp}]</span>
          </div>
          <div className="animate-badge-in stagger-1 flex items-center justify-center -my-space-2xs">
            <div className="flex items-center gap-space-xs px-space-sm py-space-2xs bg-surface-container text-secondary font-label-sm text-label-sm rounded-full">
              <Icon name="south" className="text-xs" />
              <span>Superseded during discussion at [{item.supersedes.supersededAtTimestamp}]</span>
            </div>
          </div>
          <div className="animate-badge-in stagger-2 flex items-center justify-between text-body-sm font-body-sm text-on-surface bg-surface-container-lowest p-space-sm rounded-lg shadow-sm flex-wrap gap-space-xs">
            <div className="flex items-center gap-space-xs">
              <Icon name="check_circle" className="text-secondary text-base" />
              <span className="font-semibold">Final Consensus: {item.title}</span>
            </div>
          </div>
        </div>
      )}

      {/* Superseded-by note (reverse of the supersede diff above — shown on
          the OLDER decision so it stays self-descriptive on its own card) */}
      {item.supersededBy && !item.supersedes && (
        <div className="animate-badge-in bg-surface-container-low rounded-xl p-space-md mb-space-md flex items-center gap-space-sm">
          <Icon name="history" className="text-outline text-base shrink-0" />
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Superseded by <span className="font-semibold text-on-surface">{item.supersededBy.title}</span> at [{item.supersededBy.timestamp}]
          </p>
        </div>
      )}

      {/* Evidence */}
      {item.type !== "question" &&
        item.evidence.map((e, idx) => (
          <EvidenceBlock
            key={idx}
            evidence={e}
            accent={item.type === "risk" ? "error" : item.type === "decision" ? "secondary" : "primary"}
            onViewInTranscript={onViewEvidence}
          />
        ))}

      {/* Question with conflict: split evidence */}
      {item.type === "question" && item.conflict && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-space-sm mb-space-md">
          {item.conflict.positions.map((p, idx) => (
            <div
              key={p.speaker}
              className="animate-card-in bg-surface-container-low p-space-md rounded-lg flex flex-col justify-between"
              style={{ animationDelay: `${idx * 60}ms` }}
            >
              <div>
                <div className="flex items-center justify-between mb-space-2xs">
                  <span className="font-label-sm text-label-sm font-semibold text-on-surface">Position · {p.speaker}</span>
                  <span className="font-mono-code text-mono-code text-outline">[{p.timestamp}]</span>
                </div>
                <p className="font-body-md text-body-md text-on-surface italic mt-space-2xs">&ldquo;{p.quote}&rdquo;</p>
              </div>
              <div className="mt-space-sm pt-space-xs flex items-center justify-between">
                <span className="px-space-xs py-space-2xs bg-surface-container-highest text-on-surface rounded font-label-sm text-label-sm">
                  Argues: {p.stance}
                </span>
                <button
                  type="button"
                  onClick={() => onViewEvidence(item.evidence[0]?.turnIds[0] ?? "")}
                  className="text-secondary text-xs hover:underline font-label-sm text-label-sm"
                >
                  Inspect
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {item.type === "question" && !item.conflict && item.evidence[0] && (
        <EvidenceBlock evidence={item.evidence[0]} accent="secondary" onViewInTranscript={onViewEvidence} />
      )}

      {/* Resolved conflict summary */}
      {item.conflict?.resolved && (
        <div className="bg-surface-container-low p-space-md rounded-lg mb-space-md flex items-start gap-space-sm animate-fade-in">
          <Icon name="gavel" className="text-secondary text-xl shrink-0 mt-0.5" />
          <div className="flex flex-col gap-space-2xs">
            <span className="font-label-sm text-label-sm uppercase font-semibold text-secondary">Arbitration Outcome</span>
            <p className="font-body-md text-body-md text-on-surface font-medium">
              Resolved by {item.conflict.resolvedBy}: {item.conflict.resolutionLabel}
              {item.conflict.resolutionNote ? ` — ${item.conflict.resolutionNote}` : ""}
            </p>
          </div>
        </div>
      )}

      {/* Human resolution selector for unresolved conflicts */}
      {item.conflict && !item.conflict.resolved && (
        <div className="animate-badge-in bg-surface-container-low p-space-md rounded-lg mb-space-md">
          <span className="font-label-sm text-label-sm text-outline uppercase font-semibold block mb-space-xs">Choose Single Truth Resolution:</span>
          <div className="space-y-space-xs">
            {item.conflict.positions.map((p) => (
              <label
                key={p.stance}
                className={`flex items-center gap-space-sm p-space-xs rounded-lg cursor-pointer border transition-all duration-200 ${
                  chosenResolution === p.stance
                    ? "bg-surface-container-lowest border-primary/30 shadow-sm"
                    : "border-transparent hover:bg-surface-container-lowest"
                }`}
              >
                <input
                  type="radio"
                  className="accent-primary"
                  name={`resolution-${item.id}`}
                  checked={chosenResolution === p.stance}
                  onChange={() => setChosenResolution(p.stance)}
                />
                <span className="font-body-md text-body-md text-on-surface">
                  Set as <strong>{p.stance}</strong> ({p.speaker}&apos;s proposal)
                </span>
              </label>
            ))}
            <label
              className={`flex items-center gap-space-sm p-space-xs rounded-lg cursor-pointer border transition-all duration-200 ${
                chosenResolution === "defer"
                  ? "bg-surface-container-lowest border-primary/30 shadow-sm"
                  : "border-transparent hover:bg-surface-container-lowest"
              }`}
            >
              <input
                type="radio"
                className="accent-primary"
                name={`resolution-${item.id}`}
                checked={chosenResolution === "defer"}
                onChange={() => setChosenResolution("defer")}
              />
              <span className="font-body-md text-body-md text-on-surface">Defer &amp; schedule a follow-up sync to decide</span>
            </label>
          </div>
        </div>
      )}

      {/* Footer actions */}
      <div className="flex flex-wrap items-center justify-between gap-space-sm pt-space-xs">
        {item.type === "action" && item.ownerCandidates && item.ownerCandidates.length > 0 ? (
          <div className="flex flex-wrap items-center gap-space-xs">
            {item.ownerCandidates.map((name, idx) => (
              <button
                key={name}
                onClick={() => confirmOwner(name)}
                className={
                  idx === 0
                    ? "px-space-md py-space-xs rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container active:scale-[0.96] transition-all flex items-center gap-space-2xs"
                    : "px-space-md py-space-xs rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high font-label-md text-label-md active:scale-[0.96] transition-all flex items-center gap-space-2xs"
                }
              >
                <Icon name={idx === 0 ? "person_check" : "assignment_ind"} className="text-sm" />
                <span>
                  {idx === 0 ? "Confirm" : "Assign to"} {name} {idx === 0 ? "as Owner" : ""}
                </span>
              </button>
            ))}
          </div>
        ) : item.conflict && !item.conflict.resolved ? (
          <div className="flex items-center justify-end gap-space-xs w-full">
            <button
              onClick={handleResolveConflict}
              className="px-space-md py-space-xs rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container active:scale-[0.96] transition-all flex items-center gap-space-2xs"
            >
              <Icon name="done_all" className="text-sm" />
              <span>Resolve Question</span>
            </button>
          </div>
        ) : item.type === "decision" ? (
          <div className="flex items-center gap-space-xs w-full justify-between">
            <div className="flex items-center gap-space-xs">
              <span className="font-label-sm text-label-sm text-outline">ADR Tag:</span>
              <span className="px-space-xs py-space-2xs bg-surface-container rounded font-mono-code text-mono-code text-on-surface">{item.adrTag ?? "—"}</span>
            </div>
            <div className="flex items-center gap-space-xs">
              {rejected ? null : item.status !== "approved" && (
                <button onClick={handleReject} className="px-space-sm py-space-xs rounded-lg text-outline hover:text-on-surface hover:bg-surface-container active:scale-[0.96] transition-all font-label-md text-label-md">
                  Reject
                </button>
              )}
              <button onClick={onEdit} className="px-space-sm py-space-xs rounded-lg text-outline hover:text-on-surface hover:bg-surface-container active:scale-[0.96] transition-all font-label-md text-label-md">
                Edit
              </button>
              {item.status !== "approved" && (
                <button
                  onClick={handleApprove}
                  className="px-space-md py-space-xs rounded-lg bg-secondary text-on-secondary font-label-md text-label-md hover:bg-secondary-container active:scale-[0.96] transition-all flex items-center gap-space-2xs"
                >
                  <Icon name="task_alt" className="text-sm" />
                  <span>Approve Decision</span>
                </button>
              )}
            </div>
          </div>
        ) : item.type === "risk" ? (
          <div className="flex items-center justify-end gap-space-xs w-full">
            {item.status !== "approved" && (
              <button
                onClick={() => {
                  updateItem(item.id, { status: "edited" });
                  showToast("Risk acknowledged", { icon: "check" });
                }}
                className="px-space-md py-space-xs rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high active:scale-[0.96] transition-all font-label-md text-label-md"
              >
                Acknowledge Risk
              </button>
            )}
            {item.status !== "approved" && (
              <button
                onClick={() => {
                  approveItem(item.id);
                  showToast("Converted to priority blocker issue", { icon: "add_task" });
                }}
                className="px-space-md py-space-xs rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container active:scale-[0.96] transition-all flex items-center gap-space-2xs"
              >
                <Icon name="add_task" className="text-sm" />
                <span>Convert to Priority Blocker Issue</span>
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between w-full flex-wrap gap-space-xs">
            <div className="flex items-center gap-space-xs">
              <span className="font-label-sm text-label-sm text-outline">Target Destination:</span>
              <span className="px-space-xs py-space-2xs bg-surface-container rounded font-mono-code text-mono-code text-on-surface-variant">
                {item.targetJira ? item.jiraKey ?? "Jira / ENG-Core" : "Not synced"}
              </span>
            </div>
            <div className="flex items-center gap-space-xs">
              {item.status !== "approved" && (
                <button onClick={handleReject} className="px-space-sm py-space-xs rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-low active:scale-[0.96] transition-all flex items-center gap-space-2xs font-label-md text-label-md">
                  <Icon name="close" className="text-sm" />
                  <span>Reject</span>
                </button>
              )}
              <button onClick={onEdit} className="px-space-sm py-space-xs rounded-lg text-on-surface bg-surface-container hover:bg-surface-container-high active:scale-[0.96] transition-all flex items-center gap-space-2xs font-label-md text-label-md">
                <Icon name="edit" className="text-sm" />
                <span>Edit</span>
              </button>
              {item.status !== "approved" && (
                <button
                  onClick={handleApprove}
                  className="px-space-md py-space-xs rounded-lg bg-tertiary-container text-on-tertiary font-label-md text-label-md hover:opacity-90 active:scale-[0.96] transition-all flex items-center gap-space-2xs"
                >
                  <Icon name="check" className="text-sm" />
                  <span>Approve</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
