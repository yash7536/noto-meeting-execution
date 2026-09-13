"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { CountUp } from "@/components/CountUp";
import { useCopilotStore, itemCounts } from "@/lib/store";
import { useSlidingIndicator } from "@/lib/useSlidingIndicator";
import { formatShortDate } from "@/lib/format";
import type { ExecutionItem, Meeting } from "@/lib/types";

const STATUS_META: Record<
  Meeting["status"],
  { label: string; dot: string; icon: string; iconWrap: string; iconColor: string }
> = {
  processing: { label: "Processing", dot: "bg-secondary", icon: "sync", iconWrap: "bg-surface-container", iconColor: "text-secondary" },
  needs_review: { label: "Needs Review", dot: "bg-error", icon: "forum", iconWrap: "bg-primary/5", iconColor: "text-primary" },
  reviewed_synced: { label: "Reviewed & Synced", dot: "bg-tertiary", icon: "account_tree", iconWrap: "bg-surface-container", iconColor: "text-secondary" },
  approved: { label: "Approved", dot: "bg-tertiary", icon: "support_agent", iconWrap: "bg-surface-container-low", iconColor: "text-primary" },
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "needs_review", label: "Needs Review" },
  { key: "approved", label: "Approved" },
  { key: "processing", label: "In Progress" },
] as const;

export default function DashboardPage() {
  const meetings = useCopilotStore((s) => s.meetings);
  const items = useCopilotStore((s) => s.items);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [query, setQuery] = useState("");
  const { containerRef: filterTabsRef, style: filterIndicator } = useSlidingIndicator(filter);

  const counts = itemCounts(items);
  const approvedExported = items.filter((i) => i.status === "approved").length;

  const filteredMeetings = useMemo(() => {
    let list = meetings;
    if (filter === "needs_review") list = list.filter((m) => m.status === "needs_review");
    else if (filter === "approved") list = list.filter((m) => m.status === "approved" || m.status === "reviewed_synced");
    else if (filter === "processing") list = list.filter((m) => m.status === "processing");
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((m) => m.title.toLowerCase().includes(q) || m.team.toLowerCase().includes(q));
    }
    return list;
  }, [meetings, filter, query]);

  const needsReviewCount = meetings.filter((m) => m.status === "needs_review").length;
  const approvedCount = meetings.filter((m) => m.status === "approved" || m.status === "reviewed_synced").length;

  return (
    <AppShell>
      <div className="flex flex-col w-full">
        <div className="w-full px-gutter-desktop py-space-xl flex flex-col gap-space-2xl">
          {/* Top Heroic Context Strip */}
          <div className="animate-section-in flex flex-col md:flex-row md:items-end justify-between gap-space-lg bg-surface-container-lowest p-space-xl rounded-xl shadow-sm relative overflow-hidden">
            <div className="absolute -right-16 -top-16 w-80 h-80 rounded-full bg-primary-container/5 pointer-events-none blur-3xl" />
            <div className="flex flex-col gap-space-xs max-w-3xl z-10">
              <div className="flex items-center gap-space-sm mb-space-2xs">
                <span className="inline-flex items-center gap-space-2xs px-space-sm py-space-2xs bg-surface-container-high rounded-full font-mono-metric text-mono-metric text-primary font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                  PIPELINE V2.4 ACTIVATED
                </span>
                <span className="font-mono-metric text-mono-metric text-outline">WORKSPACE // ACME-CORE</span>
              </div>
              <h1 className="font-display-lg text-display-lg text-on-surface font-extrabold tracking-tight">
                Noto
              </h1>
              <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl leading-relaxed">
                Turn meetings into action. Turn unstructured conversations into verified, evidence-backed commitments.
              </p>
            </div>
            <div className="flex items-center gap-space-md z-10">
              <Link
                href="/execution-plans"
                className="inline-flex items-center gap-space-xs px-space-md py-space-sm bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md rounded-lg transition-colors"
              >
                <Icon name="history" className="text-lg" />
                <span>Audit Log</span>
              </Link>
              <Link
                href="/new-meeting"
                className="inline-flex items-center gap-space-xs px-space-lg py-space-sm bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md rounded-lg shadow-sm hover:shadow transition-all group"
              >
                <Icon name="add" className="text-lg group-hover:rotate-90 transition-transform" />
                <span className="font-semibold">New Meeting</span>
              </Link>
            </div>
          </div>

          {/* Metric Overview Cards — purely informational (no click action),
              so they get a settle-in entrance but no hover/press affordance
              that would falsely suggest they're interactive. */}
          <div className="animate-section-in stagger-1 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-base">
            <div className="flex flex-col justify-between bg-surface-container-lowest p-space-lg rounded-xl shadow-sm relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider font-semibold">Meetings Processed</span>
                <div className="p-space-2xs bg-surface-container rounded text-primary">
                  <Icon name="mic" className="text-lg" />
                </div>
              </div>
              <div className="my-space-md flex items-baseline gap-space-sm">
                <span className="font-display-lg text-display-lg font-bold text-on-surface tracking-tight"><CountUp value={meetings.length} /></span>
                <span className="inline-flex items-center gap-space-2xs font-mono-metric text-mono-metric px-space-xs py-space-2xs bg-surface-container-low text-primary rounded">
                  <Icon name="trending_up" className="text-sm" />
                  {needsReviewCount} awaiting review
                </span>
              </div>
              <div className="flex items-center gap-space-xs">
                <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
                  <div className="bg-primary h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${Math.min(100, (approvedCount / Math.max(1, meetings.length)) * 100)}%` }} />
                </div>
                <span className="font-mono-code text-mono-code text-outline shrink-0">{approvedCount}/{meetings.length} closed</span>
              </div>
            </div>

            <div className="flex flex-col justify-between bg-surface-container-lowest p-space-lg rounded-xl shadow-sm relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider font-semibold">Execution Items Extracted</span>
                <div className="p-space-2xs bg-surface-container rounded text-secondary">
                  <Icon name="checklist_rtl" className="text-lg" />
                </div>
              </div>
              <div className="my-space-md flex items-baseline gap-space-sm">
                <span className="font-display-lg text-display-lg font-bold text-on-surface tracking-tight"><CountUp value={items.length} /></span>
                <span className="inline-flex items-center gap-space-2xs font-mono-metric text-mono-metric px-space-xs py-space-2xs bg-surface-container-low text-secondary font-medium rounded">
                  {Math.round((counts.ready.length / Math.max(1, items.length)) * 100)}% verified rate
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-space-2xs">
                <Icon name="verified" className="text-sm text-tertiary-container" />
                Anchored with transcript citations
              </p>
            </div>

            <div className="flex flex-col justify-between bg-surface-container-lowest p-space-lg rounded-xl shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider font-semibold">Needs Review</span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-error animate-pop-in" />
              </div>
              <div className="my-space-md flex items-baseline gap-space-sm">
                <span className="font-display-lg text-display-lg font-bold text-on-surface tracking-tight"><CountUp value={counts.needsReview.length} /></span>
                <span className="inline-flex items-center gap-space-2xs px-space-xs py-space-2xs bg-error-container text-on-error-container font-label-sm text-label-sm rounded font-bold uppercase">
                  Human Sign-Off
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-1">
                Ambiguities, missing owners, conflicting statements
              </p>
            </div>

            <div className="flex flex-col justify-between bg-surface-container-lowest p-space-lg rounded-xl shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider font-semibold">Approved &amp; Exported</span>
                <div className="p-space-2xs bg-surface-container-low rounded text-tertiary">
                  <Icon name="sync_saved_locally" className="text-lg" />
                </div>
              </div>
              <div className="my-space-md flex items-baseline gap-space-sm">
                <span className="font-display-lg text-display-lg font-bold text-on-surface tracking-tight"><CountUp value={approvedExported} /></span>
                <span className="inline-flex items-center gap-space-2xs px-space-xs py-space-2xs bg-surface-container-low text-tertiary font-label-sm text-label-sm rounded font-semibold">
                  <Icon name="done_all" className="text-sm text-tertiary" />
                  Synced
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-1">
                Synced to Jira, Notion, &amp; executive debriefs
              </p>
            </div>
          </div>

          {/* Meetings Synthesis Registry Section */}
          <div className="animate-section-in stagger-2 flex flex-col gap-space-base">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-base pb-space-sm">
              <div className="flex items-center gap-space-md">
                <h2 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">
                  Recent Meetings &amp; Execution Status
                </h2>
                <span className="px-space-xs py-space-2xs bg-surface-container text-primary font-mono-metric text-mono-metric rounded font-semibold">
                  {meetings.length} Total
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-space-md">
                <div ref={filterTabsRef} className="relative inline-flex p-1 bg-surface-container rounded-lg gap-1">
                  <div
                    className="absolute rounded shadow-sm bg-surface-container-lowest transition-all duration-300 ease-out"
                    style={{ left: filterIndicator.left, width: filterIndicator.width, top: 4, bottom: 4, opacity: filterIndicator.ready ? 1 : 0 }}
                  />
                  {FILTERS.map((f) => (
                    <button
                      key={f.key}
                      data-tab-key={f.key}
                      onClick={() => setFilter(f.key)}
                      className={
                        filter === f.key
                          ? "relative z-10 px-space-md py-space-xs text-on-surface font-label-md text-label-md rounded font-semibold active:scale-[0.97] transition-transform"
                          : "relative z-10 px-space-md py-space-xs text-on-surface-variant hover:text-on-surface font-label-md text-label-md rounded active:scale-[0.97] transition-all flex items-center gap-1"
                      }
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <div className="relative w-64">
                  <Icon name="search" className="absolute left-space-sm top-1/2 -translate-y-1/2 text-outline text-lg" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full pl-9 pr-space-md py-1.5 bg-surface-container-lowest rounded-lg font-body-sm text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-low shadow-sm transition-all"
                    placeholder="Filter decisions, tags..."
                    type="text"
                  />
                </div>
              </div>
            </div>

            <div key={filter} className="flex flex-col gap-space-sm">
              {filteredMeetings.length === 0 && (
                <div className="animate-fade-in bg-surface-container-lowest p-space-xl rounded-xl shadow-sm text-center text-on-surface-variant font-body-md text-body-md">
                  No meetings match this filter yet.
                </div>
              )}
              {filteredMeetings.map((m, idx) => (
                <div key={m.id} className="animate-card-in" style={{ animationDelay: `${Math.min(idx, 8) * 40}ms` }}>
                  <MeetingRow meeting={m} allItems={items.filter((i) => i.meetingId === m.id)} />
                </div>
              ))}
            </div>
          </div>

          {/* Quick-Start Enterprise Pipeline Explainer Banner */}
          <div className="bg-surface-container-low rounded-xl p-space-xl flex flex-col gap-space-lg relative overflow-hidden">
            <div className="flex items-center gap-space-sm">
              <div className="w-2 h-2 rounded-full bg-secondary" />
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">Deterministic Pipeline: How it Works</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-space-base relative">
              {[
                { step: "STEP 01", icon: "upload_file", color: "text-primary", title: "Ingest Dialogue", body: "Paste or upload any messy transcript or live audio stream directly into the pipeline buffer." },
                { step: "STEP 02", icon: "psychology", color: "text-secondary", title: "Extract & Ground", body: "Deterministic models extract decisions, actions, conflicts, and link exact timestamped quotes." },
                { step: "STEP 03", icon: "rule", color: "text-error", title: "Resolve Ambiguities", body: "Human-in-the-loop review checks missing owners, flags disagreements, and solidifies deadlines." },
                { step: "STEP 04", icon: "rocket_launch", color: "text-tertiary", title: "Execute & Sync", body: "Copy instant post-meeting briefs, auto-file Jira/Linear tickets, or sync cleanly to Notion workspaces." },
              ].map((s) => (
                <div key={s.step} className="bg-surface-container-lowest p-space-md rounded-lg flex flex-col gap-space-xs relative shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-mono-metric text-mono-metric px-space-xs py-space-2xs bg-surface-container text-primary rounded font-bold">{s.step}</span>
                    <Icon name={s.icon} className={`${s.color} text-lg`} />
                  </div>
                  <h4 className="font-headline-sm text-headline-sm text-on-surface font-semibold mt-space-2xs">{s.title}</h4>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export function MeetingRow({ meeting, allItems }: { meeting: Meeting; allItems: ExecutionItem[] }) {
  const router = useRouter();
  const counts = itemCounts(allItems);
  const meta = STATUS_META[meeting.status];
  const conflicts = allItems.filter((i) => i.conflict && !i.conflict.resolved).length;
  const unclearOwner = allItems.filter((i) => i.ambiguityFlags.some((f) => f.type === "owner_unclear")).length;
  const superseded = allItems.filter((i) => i.supersedes).length;

  const primaryHref =
    meeting.status === "needs_review"
      ? `/meetings/${meeting.id}/review`
      : meeting.status === "processing"
      ? `/meetings/${meeting.id}/processing`
      : `/meetings/${meeting.id}/plan`;

  function goToMeeting() {
    router.push(primaryHref);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={goToMeeting}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goToMeeting();
        }
      }}
      className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm hover:shadow-md border border-transparent hover:border-outline-variant/30 active:scale-[0.995] transition-all flex flex-col xl:flex-row xl:items-center justify-between gap-space-base group cursor-pointer"
    >
      <div className="flex items-start gap-space-base max-w-xl">
        <div className={`p-space-sm ${meta.iconWrap} rounded-lg ${meta.iconColor} mt-1 shrink-0`}>
          <Icon name={meta.icon} className="text-2xl" />
        </div>
        <div className="flex flex-col gap-space-xs min-w-0">
          <div className="flex flex-wrap items-center gap-space-xs">
            <span className="font-headline-sm text-headline-sm text-on-surface font-bold">{meeting.title}</span>
            <span className="px-space-xs py-space-2xs bg-surface-container text-primary font-label-sm text-label-sm rounded uppercase font-semibold">
              {meeting.team}
            </span>
            <span className="font-mono-code text-mono-code text-outline">
              {formatShortDate(meeting.recordedDate)} · {meeting.durationMinutes} mins
            </span>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant flex items-center gap-space-xs flex-wrap">
            <span className="font-semibold text-on-surface">{allItems.length} items found</span>
            <span className="text-outline-variant">/</span>
            <span>{counts.byType.action.length} Actions</span>
            <span className="text-outline-variant">·</span>
            <span>{counts.byType.decision.length} Decisions</span>
            <span className="text-outline-variant">·</span>
            <span>{counts.byType.question.length} Questions</span>
            {counts.byType.risk.length > 0 && (
              <>
                <span className="text-outline-variant">·</span>
                <span className="text-error font-medium">{counts.byType.risk.length} Risk</span>
              </>
            )}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between xl:justify-end gap-space-lg">
        <div className="flex flex-col gap-space-2xs">
          {meeting.status === "needs_review" ? (
            <>
              <div className="flex items-center gap-space-xs">
                <span className="inline-flex items-center gap-space-2xs px-space-sm py-space-2xs bg-error-container text-on-error-container font-label-sm text-label-sm rounded font-bold">
                  <Icon name={unclearOwner > 0 || conflicts > 0 ? "warning" : "flag"} className="text-sm" />
                  {unclearOwner > 0 || conflicts > 0
                    ? `${unclearOwner} Unclear Owner · ${conflicts} Conflict`
                    : `${superseded} Superseded decision flagged`}
                </span>
              </div>
              <span className="font-mono-code text-mono-code text-outline">{counts.needsReview.length} items pending human review</span>
            </>
          ) : (
            <>
              <div className="flex items-center gap-space-xs">
                <span className="inline-flex items-center gap-space-2xs font-body-sm text-body-sm text-on-surface font-medium">
                  <Icon name="check_circle" className="text-base text-tertiary-container" />
                  {meeting.status === "approved" ? "Reviewed · Follow-up sent to attendees" : "All items resolved · 100% human approved"}
                </span>
              </div>
              <span className="font-mono-code text-mono-code text-outline">
                {meeting.status === "approved" ? "Executive summary ready to share" : "Ready to sync to Jira & Notion"}
              </span>
            </>
          )}
        </div>
        <div className="shrink-0">
          <span className="inline-flex items-center gap-space-2xs px-space-md py-space-xs bg-surface-container-highest text-on-surface font-label-sm text-label-sm rounded-full font-bold uppercase tracking-wider">
            <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
            {meta.label}
          </span>
        </div>
        <div className="flex items-center gap-space-xs shrink-0" onClick={(e) => e.stopPropagation()}>
          {meeting.status === "needs_review" ? (
            <Link
              href={`/meetings/${meeting.id}/review`}
              className="inline-flex items-center gap-space-xs px-space-md py-space-xs bg-primary text-on-primary font-label-md text-label-md rounded-lg hover:bg-primary-container active:scale-[0.97] transition-all"
            >
              <span>Open Review Workspace</span>
              <Icon name="arrow_forward" className="text-sm" />
            </Link>
          ) : (
            <>
              <Link
                href={`/meetings/${meeting.id}/plan`}
                className="inline-flex items-center gap-space-xs px-space-md py-space-xs bg-surface-container text-on-surface font-label-md text-label-md rounded-lg hover:bg-surface-container-high active:scale-[0.97] transition-all"
              >
                <Icon name="visibility" className="text-sm" />
                <span>View Plan</span>
              </Link>
              <Link
                href={`/meetings/${meeting.id}/export`}
                className="inline-flex items-center gap-space-2xs px-space-sm py-space-xs bg-surface-container-low text-on-surface font-label-md text-label-md rounded-lg hover:bg-surface-container active:scale-[0.97] transition-all"
              >
                <Icon name="ios_share" className="text-sm" />
                <span>Export</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
