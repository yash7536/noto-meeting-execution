"use client";

import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { useCopilotStore, itemCounts } from "@/lib/store";
import { formatLongDate, formatShortDate } from "@/lib/format";

export default function ExecutionPlansPage() {
  const meetings = useCopilotStore((s) => s.meetings);
  const items = useCopilotStore((s) => s.items);

  const locked = meetings.filter((m) => m.status === "approved" || m.status === "reviewed_synced");
  const inProgress = meetings.filter((m) => m.status === "needs_review" || m.status === "processing");

  return (
    <AppShell>
      <div className="w-full px-gutter-desktop py-space-xl max-w-7xl mx-auto flex flex-col gap-space-xl">
        <div className="animate-section-in flex flex-col gap-space-2xs">
          <h1 className="font-display-lg text-display-lg text-on-surface font-bold tracking-tight">Execution Plans</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Authoritative, human-approved records. Once locked, a plan captures the final decisions, action owners, deadlines, open questions and risks — sourced only from approved items.
          </p>
        </div>

        <div className="animate-section-in stagger-1 flex flex-col gap-space-base">
          <h2 className="font-headline-lg text-headline-lg text-on-surface font-bold">Locked &amp; Approved</h2>
          {locked.length === 0 && (
            <div className="animate-fade-in bg-surface-container-lowest p-space-xl rounded-xl shadow-sm text-center text-on-surface-variant font-body-md text-body-md">
              No plans have been locked yet. Approve items in a meeting&apos;s Review Workspace, then approve the final plan.
            </div>
          )}
          {locked.map((m, idx) => {
            const meetingItems = items.filter((i) => i.meetingId === m.id);
            const counts = itemCounts(meetingItems);
            const approved = meetingItems.filter((i) => i.status === "approved");
            return (
              <Link
                key={m.id}
                href={`/meetings/${m.id}/plan`}
                className="animate-card-in bg-surface-container-lowest p-space-lg rounded-xl shadow-sm hover:shadow-md border border-transparent hover:border-outline-variant/30 active:scale-[0.995] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-space-base group"
                style={{ animationDelay: `${Math.min(idx, 8) * 40}ms` }}
              >
                <div className="flex items-start gap-space-base">
                  <div className="w-11 h-11 rounded-lg bg-tertiary-fixed flex items-center justify-center text-tertiary-container shrink-0">
                    <Icon name="task_alt" className="text-xl" filled />
                  </div>
                  <div className="flex flex-col gap-space-2xs">
                    <div className="flex items-center gap-space-xs flex-wrap">
                      <span className="font-headline-sm text-headline-sm text-on-surface font-bold">{m.title}</span>
                      <span className="px-space-xs py-space-2xs bg-surface-container text-primary font-label-sm text-label-sm rounded uppercase font-semibold">{m.team}</span>
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      {approved.length} authoritative items · Signed off {m.approvedAt ? formatLongDate(m.approvedAt.slice(0, 10)) : formatShortDate(m.recordedDate)}
                      {m.approvedBy ? ` by ${m.approvedBy}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-space-md shrink-0">
                  <div className="flex items-center gap-space-xs font-mono-code text-mono-code text-outline">
                    <span>{counts.byType.decision.length} Dec</span>
                    <span>·</span>
                    <span>{counts.byType.action.length} Act</span>
                    <span>·</span>
                    <span>{counts.byType.question.length} Que</span>
                  </div>
                  <span className="inline-flex items-center gap-space-2xs text-primary font-label-md text-label-md font-semibold group-hover:translate-x-0.5 transition-transform">
                    View Plan
                    <Icon name="arrow_forward" className="text-sm" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        {inProgress.length > 0 && (
          <div className="animate-section-in stagger-2 flex flex-col gap-space-base">
            <h2 className="font-headline-lg text-headline-lg text-on-surface font-bold">Awaiting Sign-Off</h2>
            {inProgress.map((m, idx) => {
              const meetingItems = items.filter((i) => i.meetingId === m.id);
              const counts = itemCounts(meetingItems);
              return (
                <Link
                  key={m.id}
                  href={`/meetings/${m.id}/review`}
                  className="animate-card-in bg-surface-container-lowest p-space-lg rounded-xl shadow-sm hover:shadow-md border border-transparent hover:border-outline-variant/30 active:scale-[0.995] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-space-base group"
                  style={{ animationDelay: `${Math.min(idx, 8) * 40}ms` }}
                >
                  <div className="flex items-start gap-space-base">
                    <div className="w-11 h-11 rounded-lg bg-error-container flex items-center justify-center text-on-error-container shrink-0">
                      <Icon name="pending_actions" className="text-xl" />
                    </div>
                    <div className="flex flex-col gap-space-2xs">
                      <span className="font-headline-sm text-headline-sm text-on-surface font-bold">{m.title}</span>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">{counts.needsReview.length} item(s) still need human review before this plan can be locked.</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-space-2xs text-primary font-label-md text-label-md font-semibold group-hover:translate-x-0.5 transition-transform">
                    Review Now
                    <Icon name="arrow_forward" className="text-sm" />
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
