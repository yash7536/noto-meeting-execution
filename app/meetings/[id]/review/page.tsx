"use client";

import { useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { ItemCard } from "@/components/ItemCard";
import { EditDrawer } from "@/components/EditDrawer";
import { useCopilotStore, itemCounts } from "@/lib/store";
import { showToast } from "@/lib/toast";
import { formatShortDate } from "@/lib/format";
import type { ExecutionItem, ItemType } from "@/lib/types";

type Filter = "all" | "needs_review" | ItemType | "approved";

export default function ReviewWorkspacePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const meeting = useCopilotStore((s) => s.getMeeting(params.id));
  const allItems = useCopilotStore((s) => s.items);
  const items = useMemo(() => allItems.filter((i) => i.meetingId === params.id), [allItems, params.id]);
  const approveAllReady = useCopilotStore((s) => s.approveAllReady);

  const [filter, setFilter] = useState<Filter>("needs_review");
  const [splitView, setSplitView] = useState(true);
  const [transcriptQuery, setTranscriptQuery] = useState("");
  const [editingItem, setEditingItem] = useState<ExecutionItem | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  const counts = useMemo(() => itemCounts(items), [items]);

  const filteredItems = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "needs_review") return items.filter((i) => i.status === "needs_review");
    if (filter === "approved") return items.filter((i) => i.status === "approved");
    return items.filter((i) => i.type === filter);
  }, [items, filter]);

  function handleViewEvidence(turnId: string) {
    if (!turnId) return;
    if (!splitView) setSplitView(true);
    setHighlightId(turnId);
    requestAnimationFrame(() => {
      const el = document.getElementById(turnId);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    setTimeout(() => setHighlightId(null), 1800);
  }

  if (!meeting) {
    return (
      <AppShell>
        <div className="p-space-xl flex flex-col items-center gap-space-md text-center">
          <p className="font-headline-sm text-headline-sm text-on-surface">Meeting not found.</p>
          <Link href="/dashboard" className="text-primary underline">
            Back to Dashboard
          </Link>
        </div>
      </AppShell>
    );
  }

  const readyCount = counts.ready.length;
  const allReviewed = counts.needsReview.length === 0;

  const filteredTurns = meeting.transcriptTurns.filter((t) =>
    transcriptQuery ? t.text.toLowerCase().includes(transcriptQuery.toLowerCase()) || t.speaker.toLowerCase().includes(transcriptQuery.toLowerCase()) : true
  );

  const TABS: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "All Items", count: items.length },
    { key: "needs_review", label: "Needs Review", count: counts.needsReview.length },
    { key: "action", label: "Actions", count: counts.byType.action.length },
    { key: "decision", label: "Decisions", count: counts.byType.decision.length },
    { key: "question", label: "Open Questions", count: counts.byType.question.length },
    { key: "risk", label: "Risks", count: counts.byType.risk.length },
    { key: "approved", label: "Approved", count: counts.approved.length },
  ];

  return (
    <AppShell>
      <div className="w-full px-gutter-desktop py-space-base flex flex-col gap-space-lg">
        {/* Header Meta & Global Actions Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md pb-space-sm">
          <div className="flex flex-col gap-space-2xs">
            <div className="flex items-center gap-space-xs flex-wrap">
              <Link href="/dashboard" className="font-label-sm text-label-sm text-outline uppercase tracking-wider hover:text-primary transition-colors">
                Dashboard
              </Link>
              <Icon name="chevron_right" className="text-outline text-xs" />
              <Link href="/meetings" className="font-label-sm text-label-sm text-outline uppercase tracking-wider hover:text-primary transition-colors">
                Meetings
              </Link>
              <Icon name="chevron_right" className="text-outline text-xs" />
              <span className="font-label-sm text-label-sm text-secondary font-semibold uppercase tracking-wider">
                {meeting.title} ({formatShortDate(meeting.recordedDate)})
              </span>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-space-md gap-y-space-2xs mt-space-2xs">
              <h1 className="font-display-lg text-display-lg text-on-surface tracking-tight">{meeting.title}</h1>
              <span className="font-mono-metric text-mono-metric text-on-surface-variant px-space-sm py-space-2xs bg-surface-container rounded">
                {formatShortDate(meeting.recordedDate)} · {meeting.durationMinutes} mins
              </span>
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant flex items-center gap-space-xs flex-wrap">
              <span className="h-2 w-2 rounded-full bg-secondary" />
              <span>{items.length} execution items synthesized</span>
              {counts.needsReview.length > 0 && (
                <>
                  <span className="text-outline">·</span>
                  <span className="text-error font-medium">{counts.needsReview.length} require human review before export</span>
                </>
              )}
            </p>
          </div>
          <div className="flex items-center flex-wrap gap-space-sm">
            <button
              onClick={() => setSplitView((v) => !v)}
              className="flex items-center gap-space-xs px-space-md py-space-xs bg-surface-container-lowest text-on-surface hover:bg-surface-container-low active:scale-[0.97] transition-all rounded-lg font-label-md text-label-md shadow-sm"
            >
              <Icon name="splitscreen" className="text-base text-secondary" />
              <span>Transcript Split View</span>
            </button>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(window.location.href);
                } catch {
                  /* clipboard may be unavailable — still confirm the link is generated */
                }
                showToast("Read-only review link copied to clipboard.", { icon: "link" });
              }}
              className="flex items-center gap-space-xs px-space-md py-space-xs bg-surface-container-lowest text-on-surface hover:bg-surface-container-low active:scale-[0.97] transition-all rounded-lg font-label-md text-label-md shadow-sm"
            >
              <Icon name="share" className="text-base text-outline" />
              <span>Share Review Link</span>
            </button>
            <button
              disabled={readyCount === 0}
              onClick={() => {
                approveAllReady(meeting.id);
                showToast(`${readyCount} item${readyCount === 1 ? "" : "s"} approved`, { icon: "task_alt" });
                router.push(`/meetings/${meeting.id}/export`);
              }}
              className="flex items-center gap-space-sm px-space-lg py-space-xs bg-primary text-on-primary hover:bg-primary-container active:scale-[0.97] transition-all rounded-lg font-label-md text-label-md shadow-md disabled:opacity-50"
            >
              <span className="font-semibold">Approve All &amp; Export</span>
              <span className="px-space-xs py-space-2xs bg-primary-fixed-dim text-on-primary-fixed font-mono-metric text-mono-metric rounded">{readyCount} ready</span>
              <Icon name="arrow_forward" className="text-base" />
            </button>
          </div>
        </div>

        {allReviewed && items.length > 0 && (
          <div className="bg-surface-container-low rounded-xl p-space-md flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
            <div className="flex items-center gap-space-sm">
              <Icon name="task_alt" className="text-tertiary text-xl" />
              <span className="font-label-md text-label-md text-on-surface font-semibold">
                All items reviewed — ready for follow-up email, export, and final sign-off.
              </span>
            </div>
            <div className="flex items-center gap-space-xs">
              <Link href={`/meetings/${meeting.id}/follow-up`} className="px-space-md py-space-xs bg-surface-container-lowest hover:bg-surface-container text-on-surface font-label-md text-label-md rounded-lg shadow-sm transition-colors">
                Follow-Up Email
              </Link>
              <Link href={`/meetings/${meeting.id}/export`} className="px-space-md py-space-xs bg-surface-container-lowest hover:bg-surface-container text-on-surface font-label-md text-label-md rounded-lg shadow-sm transition-colors">
                Export
              </Link>
              <Link href={`/meetings/${meeting.id}/plan`} className="px-space-md py-space-xs bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md rounded-lg shadow-sm transition-colors">
                Approve Final Plan
              </Link>
            </div>
          </div>
        )}

        {/* Telemetry Metric Summary Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-space-sm">
          <TelemetryCard label="Total Synthesized" value={items.length} unit="items" onClick={() => setFilter("all")} active={filter === "all"} />
          <TelemetryCard
            label="Actions"
            labelColor="text-primary"
            value={counts.byType.action.length}
            unit="assigned"
            badge={counts.byType.action.filter((i) => i.status === "needs_review").length}
            badgeLabel="review"
            onClick={() => setFilter("action")}
            active={filter === "action"}
          />
          <TelemetryCard
            label="Decisions"
            labelColor="text-secondary"
            value={counts.byType.decision.length}
            unit="locked"
            badge={counts.byType.decision.filter((i) => i.supersedes).length}
            badgeLabel="supersede"
            onClick={() => setFilter("decision")}
            active={filter === "decision"}
          />
          <TelemetryCard
            label="Open Questions"
            labelColor="text-on-surface-variant"
            value={counts.byType.question.length}
            unit="unresolved"
            badge={counts.byType.question.filter((i) => i.conflict && !i.conflict.resolved).length}
            badgeLabel="conflict"
            onClick={() => setFilter("question")}
            active={filter === "question"}
          />
          <TelemetryCard
            label="Risks & Blockers"
            labelColor="text-error"
            value={counts.byType.risk.length}
            unit="unmitigated"
            danger
            onClick={() => setFilter("risk")}
            active={filter === "risk"}
          />
        </div>

        {/* Segmented Navigation Filters */}
        <div className="flex items-center justify-between gap-space-sm overflow-x-auto pb-space-xs">
          <div className="inline-flex p-space-2xs bg-surface-container-high rounded-xl gap-space-2xs">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={
                  filter === tab.key
                    ? "px-space-md py-space-xs rounded-lg bg-surface-container-lowest text-on-surface font-label-md text-label-md shadow-sm font-semibold flex items-center gap-space-xs whitespace-nowrap active:scale-[0.97] transition-all"
                    : "px-space-md py-space-xs rounded-lg font-label-md text-label-md text-on-surface-variant hover:text-on-surface active:scale-[0.97] transition-all whitespace-nowrap"
                }
              >
                <span>
                  {tab.label} ({tab.count})
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Core Review Workspace: Two-Column Split */}
        <div className={`grid grid-cols-1 ${splitView ? "lg:grid-cols-12" : ""} gap-space-lg items-start`}>
          <div key={filter} className={splitView ? "lg:col-span-7 flex flex-col gap-space-base animate-fade-in" : "flex flex-col gap-space-base animate-fade-in"}>
            {filteredItems.length === 0 && (
              <div className="bg-surface-container-lowest rounded-xl p-space-xl text-center text-on-surface-variant font-body-md text-body-md shadow-sm">
                Nothing in this filter right now.
              </div>
            )}
            {filteredItems.map((item) => (
              <ItemCard key={item.id} item={item} onEdit={() => setEditingItem(item)} onViewEvidence={handleViewEvidence} />
            ))}
          </div>

          {splitView && (
            <div className="lg:col-span-5 sticky top-20 flex flex-col gap-space-base">
              <div className="bg-surface-container-lowest rounded-xl shadow-md p-space-lg flex flex-col h-[calc(100vh-6.5rem)]">
                <div className="flex items-center justify-between pb-space-sm">
                  <div className="flex items-center gap-space-xs">
                    <Icon name="verified" className="text-secondary text-lg" />
                    <h3 className="font-headline-sm text-headline-sm text-on-surface">Source Transcript · Ground Truth</h3>
                  </div>
                  <span className="px-space-xs py-space-2xs bg-surface-container text-outline font-mono-code text-mono-code rounded">LIVE SYNC</span>
                </div>
                <div className="relative my-space-sm">
                  <Icon name="search" className="absolute left-space-sm top-1/2 -translate-y-1/2 text-outline text-base" />
                  <input
                    value={transcriptQuery}
                    onChange={(e) => setTranscriptQuery(e.target.value)}
                    className="w-full pl-space-xl pr-space-md py-space-xs bg-surface-container-low text-on-surface rounded-lg font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Find verified quote or speaker..."
                    type="text"
                  />
                </div>
                <div ref={transcriptRef} className="flex-1 overflow-y-auto space-y-space-md pr-space-xs">
                  {filteredTurns.map((t) => (
                    <div
                      key={t.id}
                      id={t.id}
                      className={`p-space-sm rounded-lg transition-colors ${
                        highlightId === t.id
                          ? "bg-primary-fixed"
                          : t.tag === "ambiguous"
                          ? "bg-surface-container-low"
                          : t.tag === "pivot"
                          ? "bg-surface-container"
                          : ""
                      }`}
                    >
                      <div className="flex items-center justify-between mb-space-2xs flex-wrap gap-space-xs">
                        <div className="flex items-center gap-space-2xs">
                          <span className={`font-label-md text-label-md font-semibold ${t.tag === "ambiguous" || t.tag === "blocker" ? "text-error" : t.tag === "pivot" ? "text-secondary" : "text-on-surface"}`}>
                            {t.speaker}
                            {t.speakerRole ? ` (${t.speakerRole})` : ""}
                          </span>
                          {t.tag === "ambiguous" && <span className="px-space-2xs py-space-2xs bg-error-container text-on-error-container font-label-sm text-label-sm rounded uppercase">Ambiguous</span>}
                          {t.tag === "superseded" && <span className="px-space-2xs py-space-2xs bg-surface-container text-outline font-label-sm text-label-sm rounded uppercase">Superseded</span>}
                          {t.tag === "pivot" && <span className="px-space-2xs py-space-2xs bg-secondary text-on-secondary font-label-sm text-label-sm rounded uppercase">Pivot</span>}
                        </div>
                        <span className="font-mono-code text-mono-code text-outline">[{t.timestamp}]</span>
                      </div>
                      <p className={`font-body-sm text-body-sm leading-relaxed ${t.tag === "superseded" ? "text-on-surface-variant line-through opacity-75" : "text-on-surface-variant"}`}>
                        {t.text}
                      </p>
                    </div>
                  ))}
                  {filteredTurns.length === 0 && <p className="font-body-sm text-body-sm text-on-surface-variant">No matching transcript lines.</p>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {editingItem && (
        <EditDrawer
          key={editingItem.id}
          item={editingItem}
          participantNames={meeting.participants.map((p) => p.name)}
          onClose={() => setEditingItem(null)}
        />
      )}
    </AppShell>
  );
}

function TelemetryCard({
  label,
  labelColor = "text-outline",
  value,
  unit,
  badge,
  badgeLabel,
  danger,
  onClick,
  active,
}: {
  label: string;
  labelColor?: string;
  value: number;
  unit: string;
  badge?: number;
  badgeLabel?: string;
  danger?: boolean;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between active:scale-[0.98] transition-all group ${
        active ? "ring-2 ring-primary/40" : "hover:bg-surface-container-low"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className={`font-label-sm text-label-sm uppercase font-semibold ${labelColor}`}>{label}</span>
        {danger ? (
          <Icon name="warning" className="text-error text-base" />
        ) : badge !== undefined && badge > 0 ? (
          <span className="px-space-xs py-space-2xs bg-error-container text-on-error-container font-label-sm text-label-sm rounded-full">
            {badge} {badgeLabel}
          </span>
        ) : (
          <Icon name="filter_alt" className="text-outline group-hover:text-primary transition-colors text-sm" />
        )}
      </div>
      <div className="mt-space-sm flex items-baseline gap-space-xs">
        <span className={`font-display-lg text-headline-lg ${danger ? "text-error" : "text-on-surface"}`}>{value}</span>
        <span className="font-mono-metric text-mono-metric text-outline">{unit}</span>
      </div>
      <div className="w-full bg-surface-container h-1 rounded-full mt-space-sm overflow-hidden">
        <div className={`h-full ${danger ? "bg-error" : "bg-primary"}`} style={{ width: "100%" }} />
      </div>
    </button>
  );
}
