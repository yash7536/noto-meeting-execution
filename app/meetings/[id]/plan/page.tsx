"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { useCopilotStore, itemCounts } from "@/lib/store";
import { formatLongDate } from "@/lib/format";

export default function ApprovedPlanPage() {
  const params = useParams<{ id: string }>();
  const meeting = useCopilotStore((s) => s.getMeeting(params.id));
  const allItems = useCopilotStore((s) => s.items);
  const items = useMemo(() => allItems.filter((i) => i.meetingId === params.id), [allItems, params.id]);
  const approveMeetingPlan = useCopilotStore((s) => s.approveMeetingPlan);
  const setMeetingStatus = useCopilotStore((s) => s.setMeetingStatus);

  const counts = useMemo(() => itemCounts(items), [items]);

  if (!meeting) {
    return (
      <AppShell>
        <div className="p-space-xl text-center">
          <Link href="/dashboard" className="text-primary underline">Back to Dashboard</Link>
        </div>
      </AppShell>
    );
  }

  const isLocked = meeting.status === "approved" || meeting.status === "reviewed_synced";
  const approved = items.filter((i) => i.status === "approved");
  const decisions = approved.filter((i) => i.type === "decision");
  const actions = approved.filter((i) => i.type === "action");
  const questions = approved.filter((i) => i.type === "question");
  const risks = approved.filter((i) => i.type === "risk");

  if (!isLocked) {
    return (
      <AppShell>
        <div className="w-full px-gutter-desktop py-space-xl max-w-3xl mx-auto flex flex-col items-center gap-space-lg text-center">
          <div className="w-16 h-16 rounded-xl bg-surface-container-lowest shadow-sm flex items-center justify-center text-outline">
            <Icon name="lock_open" className="text-3xl" />
          </div>
          <h1 className="font-display-lg text-display-lg text-on-surface font-bold">This plan isn&apos;t locked yet</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl">
            {counts.needsReview.length > 0
              ? `${counts.needsReview.length} item(s) still need human review before this meeting can become an authoritative record.`
              : `${approved.length} of ${items.length} items are approved. Approving the plan locks it as the authoritative record.`}
          </p>
          <div className="flex items-center gap-space-sm">
            <Link href={`/meetings/${meeting.id}/review`} className="px-space-lg py-space-sm bg-surface-container-lowest hover:bg-surface-container text-on-surface font-label-md text-label-md rounded-lg shadow-sm transition-colors">
              Open Review Workspace
            </Link>
            <button
              disabled={counts.needsReview.length > 0 || approved.length === 0}
              onClick={() => {
                approveMeetingPlan(meeting.id, "Yash");
                setMeetingStatus(meeting.id, "approved");
              }}
              className="px-space-lg py-space-sm bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md rounded-lg shadow-sm transition-colors disabled:opacity-40"
            >
              Approve &amp; Lock Plan
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  const jsonPreview = `{
  "plan_id": "${meeting.id.toUpperCase()}",
  "signer": "${meeting.approvedBy ?? "Yash"}",
  "timestamp_utc": "${meeting.approvedAt ?? new Date().toISOString()}",
  "audit_status": "VERIFIED_CONSENSUS"
}`;

  return (
    <AppShell>
      <div className="relative w-full overflow-hidden">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-tertiary-fixed-dim/15 rounded-full blur-3xl pointer-events-none -z-10" />
        <div className="absolute top-48 left-10 w-80 h-80 bg-primary-fixed-dim/20 rounded-full blur-3xl pointer-events-none -z-10" />
        <div className="max-w-7xl mx-auto px-gutter-desktop py-space-xl flex flex-col gap-space-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
            <nav aria-label="Breadcrumb" className="flex items-center gap-space-xs font-label-md text-label-md text-on-surface-variant flex-wrap">
              <Link href="/dashboard" className="hover:text-primary transition-colors">Dashboard</Link>
              <Icon name="chevron_right" className="text-sm text-outline" />
              <Link href="/meetings" className="hover:text-primary transition-colors">Meetings</Link>
              <Icon name="chevron_right" className="text-sm text-outline" />
              <Link href={`/meetings/${meeting.id}/review`} className="hover:text-primary transition-colors">{meeting.title}</Link>
              <Icon name="chevron_right" className="text-sm text-outline" />
              <span className="font-semibold text-on-surface">Final Approved Record</span>
            </nav>
            <div className="flex items-center gap-space-xs">
              <span className="inline-flex items-center gap-space-2xs px-space-sm py-space-2xs bg-surface-container-high rounded-full font-mono-metric text-mono-metric text-on-surface">
                <Icon name="verified" className="text-xs text-tertiary-container" filled />
                {meeting.id.toUpperCase()}
              </span>
              <span className="inline-flex items-center gap-space-2xs px-space-sm py-space-2xs bg-surface-container-high rounded-full font-mono-metric text-mono-metric text-on-surface-variant">v1.0.0-LOCKED</span>
            </div>
          </div>

          <div className="relative bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
            <div className="h-1 w-full bg-gradient-to-r from-tertiary via-on-tertiary-container to-secondary" />
            <div className="p-space-lg flex flex-col lg:flex-row lg:items-center justify-between gap-space-lg">
              <div className="flex items-start gap-space-md">
                <div className="w-12 h-12 rounded-xl bg-tertiary-fixed flex items-center justify-center text-tertiary-container shrink-0 shadow-sm">
                  <Icon name="task_alt" className="text-2xl" filled />
                </div>
                <div className="flex flex-col gap-space-2xs">
                  <div className="flex items-center flex-wrap gap-space-xs">
                    <h1 className="font-headline-md text-headline-md text-on-surface font-bold tracking-tight">
                      Authoritative Execution Plan · Human Approved &amp; Verified
                    </h1>
                    <span className="inline-flex items-center gap-1 px-space-sm py-space-2xs bg-surface-container-low text-tertiary-container rounded-full font-label-sm text-label-sm uppercase tracking-wider font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-on-tertiary-container" />
                      Immutable Record
                    </span>
                  </div>
                  <p className="font-body-md text-body-md text-on-surface-variant flex items-center gap-space-xs flex-wrap">
                    <Icon name="history_edu" className="text-base text-outline" />
                    <span>
                      Signed off on <strong>{meeting.approvedAt ? formatLongDate(meeting.approvedAt.slice(0, 10)) : "—"}</strong> by
                    </span>
                    <span className="inline-flex items-center gap-space-xs font-semibold text-on-surface">
                      <span className="w-5 h-5 rounded-full bg-primary-container text-on-primary text-[10px] flex items-center justify-center font-bold">
                        {(meeting.approvedBy ?? "Y").charAt(0)}
                      </span>
                      {meeting.approvedBy ?? "Yash"} (Product Lead)
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex items-center flex-wrap gap-space-xs shrink-0">
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(window.location.href);
                    alert("Read-only execution link copied to clipboard.");
                  }}
                  className="inline-flex items-center gap-space-xs px-space-md py-space-xs bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md rounded-lg transition-colors shadow-sm"
                >
                  <Icon name="link" className="text-base text-secondary" />
                  <span>Share Read-Only</span>
                </button>
                <button onClick={() => window.print()} className="inline-flex items-center gap-space-xs px-space-md py-space-xs bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md rounded-lg transition-colors shadow-sm">
                  <Icon name="picture_as_pdf" className="text-base text-secondary" />
                  <span>Print / PDF Export</span>
                </button>
                <Link href={`/meetings/${meeting.id}/export`} className="inline-flex items-center gap-space-xs px-space-md py-space-xs bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md rounded-lg transition-colors shadow-sm">
                  <Icon name="verified_user" className="text-base" />
                  <span>Open Exports</span>
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 bg-surface-container-low px-space-lg py-space-md gap-space-base">
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-outline uppercase font-semibold">Authoritative Scope</span>
                <span className="font-headline-sm text-headline-sm text-on-surface font-bold mt-0.5">{approved.length} Total Items</span>
              </div>
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-outline uppercase font-semibold">Acoustic Proof</span>
                <span className="font-headline-sm text-headline-sm text-tertiary font-bold mt-0.5">100% Grounded</span>
              </div>
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-outline uppercase font-semibold">Tension &amp; Ambiguity</span>
                <span className="font-headline-sm text-headline-sm text-on-surface font-bold mt-0.5">
                  {items.filter((i) => i.conflict && !i.conflict.resolved).length} Ambiguities Remaining
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-outline uppercase font-semibold">Downstream Sync</span>
                <span className="font-headline-sm text-headline-sm text-secondary font-bold mt-0.5">{actions.filter((a) => a.targetJira).length} Synced to Jira</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl items-start">
            <div className="lg:col-span-8 flex flex-col gap-space-xl">
              <PlanSection title="1. Decisions (Locked & Authoritative)" tag={`${decisions.length} ARCHITECTURAL COMMIT${decisions.length === 1 ? "" : "S"}`} dot="bg-primary">
                {decisions.length === 0 && <EmptySection label="No decisions were approved for this meeting." />}
                {decisions.map((d) => (
                  <div key={d.id} className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md hover:shadow-md transition-shadow">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
                      <div className="flex items-center gap-space-xs flex-wrap">
                        <span className="px-space-sm py-space-2xs bg-tertiary-fixed text-tertiary-container rounded font-label-sm text-label-sm uppercase font-semibold flex items-center gap-1">
                          <Icon name="lock" className="text-xs" />
                          Approved Consensus
                        </span>
                        {d.adrTag && <span className="px-space-sm py-space-2xs bg-surface-container-low text-secondary font-mono-code text-mono-code font-semibold rounded">{d.adrTag}</span>}
                      </div>
                      <span className="font-label-sm text-label-sm text-outline font-mono-code">{d.code}</span>
                    </div>
                    <div>
                      <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">{d.title}</h3>
                      {d.supersedes && (
                        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
                          Superseded earlier decision at <span className="font-mono-code text-mono-code text-secondary font-medium">[{d.supersedes.previousTimestamp}]</span>: {d.supersedes.previousTitle}.
                        </p>
                      )}
                    </div>
                    {d.evidence[0] && (
                      <div className="bg-surface-container-low/70 rounded-lg p-space-md flex flex-col gap-space-sm">
                        <div className="pl-space-md relative">
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-secondary rounded-full" />
                          <p className="font-body-sm text-body-sm text-on-surface italic">&ldquo;{d.evidence[0].quote}&rdquo;</p>
                          <div className="flex items-center gap-space-xs mt-space-2xs text-outline font-label-sm text-label-sm">
                            <span className="font-semibold text-on-surface-variant">{d.evidence[0].speaker}</span>
                            <span>·</span>
                            <span className="font-mono-code text-mono-code text-secondary font-semibold">[{d.evidence[0].timestamp}]</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </PlanSection>

              <PlanSection title="2. Action Items (Assigned & Scheduled)" tag={`${actions.length} RATIFIED`} dot="bg-secondary">
                {actions.length === 0 ? (
                  <EmptySection label="No action items were approved for this meeting." />
                ) : (
                  <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-surface-container-low text-outline font-label-sm text-label-sm uppercase tracking-wider">
                            <th className="py-space-md px-space-md font-semibold">Action Item</th>
                            <th className="py-space-md px-space-md font-semibold">Owner</th>
                            <th className="py-space-md px-space-md font-semibold">Deadline</th>
                            <th className="py-space-md px-space-md font-semibold">Grounding Evidence</th>
                            <th className="py-space-md px-space-md font-semibold text-right">Export Status</th>
                          </tr>
                        </thead>
                        <tbody className="text-on-surface font-body-md text-body-md">
                          {actions.map((a, idx) => (
                            <tr key={a.id} className={idx % 2 === 1 ? "bg-surface-container-low/20 hover:bg-surface-container-low/40 transition-colors" : "hover:bg-surface-container-low/40 transition-colors"}>
                              <td className="py-space-md px-space-md align-top">
                                <div className="flex flex-col">
                                  <span className="font-semibold text-on-surface">{a.title}</span>
                                  {a.description && <span className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{a.description}</span>}
                                </div>
                              </td>
                              <td className="py-space-md px-space-md align-top whitespace-nowrap">
                                <span className="font-label-md text-label-md font-medium text-on-surface">{a.owner ?? "Unassigned"}</span>
                              </td>
                              <td className="py-space-md px-space-md align-top whitespace-nowrap">
                                <span className="inline-flex items-center gap-1 font-mono-metric text-mono-metric font-semibold text-primary">
                                  <Icon name="event" className="text-sm" />
                                  {a.deadline ?? "—"}
                                </span>
                              </td>
                              <td className="py-space-md px-space-md align-top max-w-xs">
                                {a.evidence[0] && (
                                  <div className="bg-surface-container-low p-space-xs rounded font-body-sm text-body-sm italic text-on-surface-variant">
                                    &ldquo;{a.evidence[0].quote.slice(0, 60)}{a.evidence[0].quote.length > 60 ? "…" : ""}&rdquo;
                                    <span className="font-mono-code text-mono-code font-bold text-secondary ml-1">[{a.evidence[0].timestamp}]</span>
                                  </div>
                                )}
                              </td>
                              <td className="py-space-md px-space-md align-top text-right whitespace-nowrap">
                                <span className="inline-flex items-center gap-1 px-space-sm py-space-2xs bg-primary-fixed text-on-primary-fixed rounded font-label-sm text-label-sm font-semibold">
                                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                                  {a.targetJira ? a.jiraKey ?? "Queued for Jira" : "Not synced"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </PlanSection>

              <PlanSection title="3. Open Questions & Resolved Inquiries" tag="AMBIGUITY STATUS" dot="bg-tertiary">
                {questions.length === 0 ? (
                  <EmptySection label="No open questions were approved for this meeting." />
                ) : (
                  questions.map((q) => (
                    <div key={q.id} className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-xs">
                        <div className="flex items-center gap-space-xs">
                          <span className="px-space-sm py-space-2xs bg-tertiary-fixed text-tertiary-container rounded font-label-sm text-label-sm uppercase font-semibold flex items-center gap-1">
                            <Icon name="check_circle" className="text-xs" />
                            {q.conflict?.resolved ? "Resolved by Human Review" : "Acknowledged"}
                          </span>
                          <span className="font-label-sm text-label-sm text-outline">{q.code}</span>
                        </div>
                      </div>
                      <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">{q.title}</h3>
                      {q.conflict?.resolved && (
                        <div className="bg-surface-container-low p-space-md rounded-lg flex items-start gap-space-sm">
                          <Icon name="gavel" className="text-secondary text-xl shrink-0 mt-0.5" />
                          <div className="flex flex-col gap-space-2xs">
                            <span className="font-label-sm text-label-sm uppercase font-semibold text-secondary">Arbitration Outcome</span>
                            <p className="font-body-md text-body-md text-on-surface font-medium">
                              Resolved by {q.conflict.resolvedBy}: {q.conflict.resolutionLabel}
                            </p>
                          </div>
                        </div>
                      )}
                      {q.conflict && (
                        <div className="flex flex-col gap-space-xs pt-space-xs">
                          <span className="font-label-sm text-label-sm uppercase font-semibold text-outline">Documented Dialogue Contradiction:</span>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
                            {q.conflict.positions.map((p) => (
                              <div key={p.speaker} className="p-space-sm bg-surface-container-low/60 rounded-lg flex flex-col gap-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-label-md text-label-md font-semibold text-on-surface">{p.speaker}</span>
                                  <span className="font-mono-code text-mono-code text-outline text-xs">[{p.timestamp}]</span>
                                </div>
                                <p className="font-body-sm text-body-sm text-on-surface-variant italic">&ldquo;{p.quote}&rdquo;</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </PlanSection>

              <PlanSection title="4. Mitigated Risks & Blockers" tag="RISK LOGGED" dot="bg-secondary-container">
                {risks.length === 0 ? (
                  <EmptySection label="No risks were approved for this meeting." />
                ) : (
                  risks.map((r) => (
                    <div key={r.id} className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md">
                      <div className="flex items-center justify-between flex-wrap gap-space-xs">
                        <span className="px-space-sm py-space-2xs bg-secondary-fixed text-on-secondary-fixed-variant rounded font-label-sm text-label-sm uppercase font-semibold flex items-center gap-1">
                          <Icon name="verified" className="text-xs" />
                          Risk Logged{r.owner ? ` · Assigned to ${r.owner}` : ""}
                        </span>
                        <span className="font-mono-code text-mono-code text-outline text-xs">{r.code}</span>
                      </div>
                      <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">{r.title}</h3>
                      {r.description && (
                        <div className="bg-surface-container-low p-space-md rounded-lg flex items-start gap-space-sm">
                          <Icon name="security" className="text-tertiary-container text-xl shrink-0 mt-0.5" />
                          <div className="flex flex-col gap-space-2xs">
                            <span className="font-label-sm text-label-sm uppercase font-semibold text-tertiary-container">Review Mitigation Note</span>
                            <p className="font-body-md text-body-md text-on-surface">{r.description}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </PlanSection>
            </div>

            {/* Right rail */}
            <div className="lg:col-span-4 flex flex-col gap-space-lg">
              <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md">
                <div className="flex items-center justify-between">
                  <span className="font-label-sm text-label-sm uppercase font-semibold text-outline">Synthesis Pipeline</span>
                  <span className="inline-flex items-center gap-1 px-space-xs py-space-2xs bg-tertiary-fixed text-tertiary-container rounded font-mono-code text-mono-code font-bold">100% AUDITED</span>
                </div>
                <div className="py-space-sm flex flex-col gap-space-sm">
                  <div className="flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant">
                    <span>Verification Ratio</span>
                    <span className="font-mono-metric font-bold text-on-surface">
                      {approved.length} / {items.length}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden flex">
                    <div className="h-full bg-primary" style={{ width: `${(decisions.length / Math.max(1, approved.length)) * 100}%` }} />
                    <div className="h-full bg-secondary" style={{ width: `${(actions.length / Math.max(1, approved.length)) * 100}%` }} />
                    <div className="h-full bg-on-tertiary-container" style={{ width: `${((questions.length + risks.length) / Math.max(1, approved.length)) * 100}%` }} />
                  </div>
                  <div className="flex items-center justify-between font-mono-code text-mono-code text-xs text-outline pt-1">
                    <span>Decisions ({decisions.length})</span>
                    <span>Actions ({actions.length})</span>
                    <span>Other ({questions.length + risks.length})</span>
                  </div>
                </div>
                <div className="flex flex-col gap-space-sm mt-space-xs font-body-sm text-body-sm">
                  <PipelineStep n={1} title="Acoustic Diarization" body={`${meeting.durationMinutes}m of transcript ingested from ${meeting.participants.length} speakers.`} />
                  <PipelineStep n={2} title="Semantic Extraction" body={`${items.length} candidate commitments mapped.`} />
                  <PipelineStep n={3} title="Lead Sign-Off & Locking" body={`Ratified by ${meeting.approvedBy ?? "Yash"} with zero unreviewed diffs.`} />
                </div>
              </div>

              <div className="bg-[#0A0D12] text-slate-100 rounded-xl p-space-md shadow-sm flex flex-col gap-space-xs font-mono-code text-mono-code">
                <div className="flex items-center justify-between pb-space-xs border-b border-slate-800">
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Icon name="code" className="text-xs text-tertiary-fixed" />
                    plan-payload.json
                  </span>
                  <button
                    className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1"
                    onClick={() => {
                      navigator.clipboard?.writeText(jsonPreview);
                      alert("JSON payload copied.");
                    }}
                  >
                    <Icon name="content_copy" className="text-xs" />
                    Copy
                  </button>
                </div>
                <pre className="overflow-x-auto text-xs leading-relaxed text-slate-300 py-space-xs">{jsonPreview}</pre>
              </div>
            </div>
          </div>

          <footer className="mt-space-lg pt-space-xl flex flex-col gap-space-lg">
            <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col md:flex-row items-center justify-between gap-space-lg">
              <div className="flex items-center flex-wrap gap-space-sm md:gap-space-md">
                <TierBadge n={1} label="AI Extracted:" value={`${items.length} candidates`} />
                <Icon name="trending_flat" className="text-outline text-base hidden sm:inline" />
                <TierBadge n={2} label="Human Reviewed:" value={`${items.filter((i) => i.status === "edited" || i.status === "rejected").length} adjusted`} accent="text-secondary" />
                <Icon name="trending_flat" className="text-outline text-base hidden sm:inline" />
                <TierBadge n={3} label="Final Approved:" value={`${approved.length} authoritative items`} accent="text-tertiary" locked />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-space-md pb-space-2xl">
              <div className="flex items-center gap-space-xs font-body-sm text-body-sm text-on-surface-variant">
                <Icon name="check" className="text-sm text-tertiary" />
                <span>Record locked against modifications. Downstream changes require a new meeting delta.</span>
              </div>
              <div className="flex items-center gap-space-sm w-full sm:w-auto justify-end">
                <Link href={`/meetings/${meeting.id}/follow-up`} className="w-full sm:w-auto inline-flex items-center justify-center gap-space-xs px-space-lg py-space-sm bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md font-semibold rounded-lg shadow-sm transition-colors">
                  <Icon name="mail" className="text-base" />
                  <span>Follow-Up Email</span>
                </Link>
                <Link href="/dashboard" className="w-full sm:w-auto inline-flex items-center justify-center gap-space-xs px-space-lg py-space-sm bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md font-semibold rounded-lg shadow-sm transition-colors">
                  <Icon name="dashboard" className="text-base" />
                  <span>Return to Dashboard</span>
                </Link>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </AppShell>
  );
}

function PlanSection({ title, tag, dot, children }: { title: string; tag: string; dot: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-space-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-space-sm">
          <span className={`w-2.5 h-2.5 rounded-sm ${dot}`} />
          <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold tracking-tight">{title}</h2>
        </div>
        <span className="px-space-sm py-space-2xs bg-surface-container-high text-on-surface-variant rounded font-mono-code text-mono-code">{tag}</span>
      </div>
      <div className="flex flex-col gap-space-md">{children}</div>
    </section>
  );
}

function EmptySection({ label }: { label: string }) {
  return <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm text-on-surface-variant font-body-md text-body-md">{label}</div>;
}

function PipelineStep({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="flex items-start gap-space-sm">
      <div className="w-6 h-6 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-mono-code text-xs font-bold shrink-0">{n}</div>
      <div>
        <p className="font-semibold text-on-surface">{title}</p>
        <p className="text-on-surface-variant">{body}</p>
      </div>
    </div>
  );
}

function TierBadge({ n, label, value, accent, locked }: { n: number; label: string; value: string; accent?: string; locked?: boolean }) {
  return (
    <div className="flex items-center gap-space-xs">
      <span className={`w-6 h-6 rounded-full ${locked ? "bg-tertiary-fixed text-tertiary-container" : "bg-surface-container-high text-on-surface"} flex items-center justify-center font-mono-code text-xs font-bold`}>{n}</span>
      <span className="font-label-md text-label-md text-on-surface font-semibold">{label}</span>
      <span className={`font-mono-metric text-mono-metric ${accent ?? "text-on-surface-variant"} font-semibold`}>{value}</span>
    </div>
  );
}
