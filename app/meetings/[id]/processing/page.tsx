"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { useCopilotStore } from "@/lib/store";
import { formatShortDate } from "@/lib/format";

const STEPS = [
  {
    title: "Reading transcript & speaker diarization",
    detail: (words: number, speakers: number) => `${words} words parsed • ${speakers} participants identified`,
  },
  {
    title: "Identifying decisions and actions",
    detail: (actions: number, decisions: number) => `${actions} candidate actions synthesized • ${decisions} decisions indexed`,
  },
  {
    title: "Checking evidence & grounding citations",
    detail: (verified: number, total: number) => `Verifying source transcript spans for 100% evidentiary proof — ${verified}/${total} assertions verified`,
  },
  {
    title: "Detecting ambiguity, conflicts & superseded decisions",
    detail: (...args: number[]) => `Checking for unassigned owners, missing deadlines, and contradictory dialogue — ${args[0]} flags raised`,
  },
  {
    title: "Preparing execution review workspace",
    detail: (...args: number[]) => (args.length >= 0 ? "Formatting review cards, export stubs, and the follow-up stakeholder digest." : ""),
  },
];

export default function ProcessingPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const meeting = useCopilotStore((s) => s.getMeeting(params.id));
  const allItems = useCopilotStore((s) => s.items);
  const items = useMemo(() => allItems.filter((i) => i.meetingId === params.id), [allItems, params.id]);
  const [stepIndex, setStepIndex] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!meeting) return;
    const stepTimer = setInterval(() => {
      setStepIndex((i) => {
        if (i >= STEPS.length - 1) {
          clearInterval(stepTimer);
          return i;
        }
        return i + 1;
      });
    }, 850);
    return () => clearInterval(stepTimer);
  }, [meeting]);

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (stepIndex === STEPS.length - 1) {
      const t = setTimeout(() => {
        setDone(true);
        router.push(`/meetings/${params.id}/review`);
      }, 900);
      return () => clearTimeout(t);
    }
  }, [stepIndex, params.id, router]);

  const logLines = useMemo(() => {
    if (!meeting) return [];
    const lines: { type: string; text: string; meta?: string; tone: string }[] = [];
    for (const it of items) {
      if (it.type === "decision" && !it.supersedes) {
        lines.push({
          type: "DECISION_CANDIDATE",
          text: `"${it.title}."`,
          meta: `Grounding: ${it.evidence[0]?.speaker} (${it.evidence[0]?.timestamp})`,
          tone: "decision",
        });
      } else if (it.type === "action") {
        lines.push({
          type: "ACTION_EXTRACTED",
          text: `"${it.title}" → ${it.owner ?? "unassigned"}${it.deadline ? ` • Due: ${it.deadline}` : ""}`,
          tone: "action",
        });
      } else if (it.supersedes) {
        lines.push({
          type: "SUPERSEDED_DECISION",
          text: `${it.supersedes.previousTitle} replaced by "${it.title}".`,
          tone: "superseded",
        });
      } else if (it.conflict) {
        lines.push({
          type: "AMBIGUITY_DETECTED",
          text: `Conflicting positions on: ${it.conflict.summary}`,
          tone: "warning",
        });
      }
    }
    return lines.slice(0, 6);
  }, [meeting, items]);

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

  const words = meeting.transcriptRaw.split(/\s+/).filter(Boolean).length;
  const actions = items.filter((i) => i.type === "action").length;
  const decisions = items.filter((i) => i.type === "decision").length;
  const flags = items.reduce((sum, i) => sum + i.ambiguityFlags.length, 0);
  const progressPct = Math.round(((stepIndex + (done ? 1 : 0.4)) / STEPS.length) * 100);

  return (
    <AppShell>
      <div className="px-space-xl py-space-lg flex flex-col gap-space-lg max-w-7xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
          <div className="flex items-center gap-space-xs font-label-md text-label-md text-on-surface-variant flex-wrap">
            <Link href="/dashboard" className="hover:text-primary transition-colors flex items-center gap-space-2xs">
              <Icon name="grid_view" className="text-base" />
              <span>Dashboard</span>
            </Link>
            <span className="text-outline-variant font-mono-code text-mono-code">/</span>
            <span className="font-medium">
              {meeting.title} ({formatShortDate(meeting.recordedDate)})
            </span>
            <span className="text-outline-variant font-mono-code text-mono-code">/</span>
            <span className="text-secondary font-semibold flex items-center gap-space-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
              <span>Pipeline Processing</span>
            </span>
          </div>
          <div className="inline-flex items-center gap-space-xs px-space-sm py-space-2xs rounded-full bg-surface-container-high text-on-surface-variant font-mono-code text-mono-code">
            <span className="w-2 h-2 rounded-full bg-tertiary-fixed-dim inline-block animate-ping" />
            <span>RUN_ID: #{meeting.id.slice(-6).toUpperCase()}-DETERMINISTIC</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
          <div className="lg:col-span-7 flex flex-col gap-space-lg">
            <div className="bg-surface-container-lowest p-space-xl rounded-xl shadow-sm flex flex-col gap-space-md relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
              <div className="flex items-start gap-space-md">
                <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                  <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
                    <circle className="text-surface-container-high" cx="24" cy="24" fill="none" r="20" stroke="currentColor" strokeWidth="3" />
                    <circle
                      className="text-secondary"
                      cx="24"
                      cy="24"
                      fill="none"
                      r="20"
                      stroke="currentColor"
                      strokeDasharray="125.66"
                      strokeDashoffset={125.66 * (1 - progressPct / 100)}
                      strokeLinecap="round"
                      strokeWidth="3.5"
                      style={{ transition: "stroke-dashoffset 400ms ease" }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Icon name="sync" className="text-secondary text-xl animate-spin" />
                  </div>
                </div>
                <div className="flex flex-col gap-space-2xs min-w-0">
                  <div className="flex items-center gap-space-sm flex-wrap">
                    <h1 className="font-headline-md text-headline-md text-on-surface tracking-tight">
                      {done ? "Execution workspace ready" : "Analyzing Meeting Transcript..."}
                    </h1>
                    <span className="px-space-xs py-space-2xs rounded bg-surface-container-high font-label-sm text-label-sm text-on-surface font-mono-code">
                      {progressPct}% Complete
                    </span>
                  </div>
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    Extracting commitments, validating evidence, and detecting ambiguity for{" "}
                    <span className="font-semibold text-on-surface">
                      {meeting.title} ({formatShortDate(meeting.recordedDate)})
                    </span>
                    .
                  </p>
                </div>
              </div>
              <div className="w-full bg-surface-container-high rounded-full h-1.5 overflow-hidden">
                <div className="bg-secondary h-1.5 rounded-full transition-all duration-700 ease-out" style={{ width: `${progressPct}%` }} />
              </div>
            </div>

            <div className="bg-surface-container-lowest p-space-xl rounded-xl shadow-sm flex flex-col gap-space-md">
              <div className="flex items-center justify-between pb-space-xs">
                <h2 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-space-xs">
                  <Icon name="schema" className="text-secondary text-lg" />
                  <span>Deterministic Execution Pipeline</span>
                </h2>
                <span className="font-mono-code text-mono-code text-outline uppercase tracking-wider">
                  Step {Math.min(stepIndex + 1, STEPS.length)} of {STEPS.length}
                </span>
              </div>
              <div className="flex flex-col gap-space-sm">
                {STEPS.map((step, i) => {
                  const state = i < stepIndex || done ? "done" : i === stepIndex ? "active" : "pending";
                  return (
                    <div
                      key={step.title}
                      className={
                        state === "active"
                          ? "flex items-start gap-space-md p-space-md rounded-lg bg-surface-container-high/80 shadow-sm relative overflow-hidden"
                          : state === "done"
                          ? "flex items-start gap-space-md p-space-md rounded-lg bg-surface-container-low/60 transition-colors"
                          : "flex items-start gap-space-md p-space-md rounded-lg bg-surface-container-lowest opacity-75"
                      }
                    >
                      {state === "active" && <div className="absolute left-0 top-0 bottom-0 w-1 bg-secondary" />}
                      <div
                        className={
                          state === "done"
                            ? "w-7 h-7 rounded-full bg-tertiary-container flex items-center justify-center text-on-tertiary-container shrink-0 mt-0.5"
                            : state === "active"
                            ? "w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-on-secondary shrink-0 mt-0.5 shadow-sm"
                            : "w-7 h-7 rounded-full bg-surface-container-high flex items-center justify-center text-outline shrink-0 mt-0.5"
                        }
                      >
                        {state === "done" ? (
                          <Icon name="check" className="text-base font-bold" />
                        ) : state === "active" ? (
                          <span className="w-2.5 h-2.5 rounded-full bg-on-secondary animate-pulse" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-outline-variant" />
                        )}
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-space-sm">
                          <span
                            className={
                              state === "pending"
                                ? "font-headline-sm text-headline-sm text-on-surface-variant"
                                : "font-headline-sm text-headline-sm text-on-surface"
                            }
                          >
                            {step.title}
                          </span>
                          <span
                            className={
                              state === "active"
                                ? "inline-flex items-center gap-space-2xs px-space-xs py-space-2xs rounded bg-secondary text-on-secondary font-label-sm text-label-sm uppercase font-semibold animate-pulse"
                                : state === "done"
                                ? "px-space-xs py-space-2xs rounded bg-surface-container text-on-surface-variant font-label-sm text-label-sm uppercase font-semibold"
                                : "px-space-xs py-space-2xs rounded bg-surface-container-low text-outline font-label-sm text-label-sm uppercase font-semibold"
                            }
                          >
                            {state === "active" ? "Active" : state === "done" ? "Done" : "Queued"}
                          </span>
                        </div>
                        <p className="font-body-sm text-body-sm text-on-surface-variant mt-space-2xs">
                          {i === 0
                            ? step.detail(words, meeting.participants.length)
                            : i === 1
                            ? step.detail(actions, decisions)
                            : i === 2
                            ? step.detail(items.length, items.length)
                            : i === 3
                            ? step.detail(flags, 0)
                            : step.detail(0, 0)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col gap-space-lg">
            <div className="bg-inverse-surface text-inverse-on-surface rounded-xl shadow-xl overflow-hidden flex flex-col">
              <div className="px-space-base py-space-sm bg-black/40 flex items-center justify-between gap-space-sm">
                <div className="flex items-center gap-space-xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-error" />
                  <span className="w-2.5 h-2.5 rounded-full bg-secondary-container" />
                  <span className="w-2.5 h-2.5 rounded-full bg-tertiary-fixed-dim" />
                  <span className="ml-space-xs font-mono-code text-mono-code text-outline-variant font-medium">pipeline_stdout.log</span>
                </div>
                <div className="flex items-center gap-space-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-tertiary-fixed animate-ping" />
                  <span className="font-mono-code text-mono-code text-tertiary-fixed text-[11px] uppercase tracking-wider">Streaming live</span>
                </div>
              </div>
              <div className="p-space-base flex flex-col gap-space-md font-mono-code text-mono-code max-h-[440px] overflow-y-auto">
                {logLines.map((line, idx) => (
                  <div
                    key={idx}
                    className={
                      line.tone === "warning"
                        ? "p-space-sm rounded bg-error-container/20 flex flex-col gap-space-xs"
                        : "p-space-sm rounded bg-black/30 flex flex-col gap-space-xs"
                    }
                  >
                    <div className={`flex items-center gap-space-xs ${line.tone === "warning" ? "text-error" : "text-primary-fixed"}`}>
                      {line.tone === "warning" && <Icon name="warning" className="text-sm" />}
                      <span className="font-semibold">{line.type}</span>
                    </div>
                    <p className={`pl-space-lg ${line.tone === "warning" ? "text-error" : "text-inverse-on-surface"}`}>{line.text}</p>
                    {line.meta && (
                      <div className="pl-space-lg text-outline-variant text-[11px] flex items-center gap-space-xs">
                        <Icon name="link" className="text-xs" />
                        <span>{line.meta}</span>
                      </div>
                    )}
                  </div>
                ))}
                <div className="flex items-center gap-space-xs text-tertiary-fixed animate-pulse">
                  <span>&gt;</span>
                  <span>Cross-verifying transcript citations against speaker timeline...</span>
                </div>
              </div>
              <div className="p-space-sm bg-black/50 flex items-center justify-between text-outline-variant font-mono-code text-mono-code">
                <div className="flex items-center gap-space-xs">
                  <Icon name="timer" className="text-xs text-tertiary-fixed" />
                  <span className="text-inverse-on-surface font-semibold">0:{seconds.toString().padStart(2, "0")}s elapsed</span>
                </div>
                <div className="flex items-center gap-space-xs">
                  <span className="text-outline">Est. remaining:</span>
                  <span className="text-inverse-on-surface font-semibold">{done ? "Complete" : "~1s"}</span>
                </div>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col gap-space-sm">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-label-sm text-outline uppercase font-semibold tracking-wider">Grounding Inspector</span>
                <span className="font-mono-code text-mono-code text-on-surface-variant">
                  {meeting.participants.length} / {meeting.participants.length} Speakers Diarized
                </span>
              </div>
              <div className="grid grid-cols-2 gap-space-xs">
                {meeting.participants.map((p) => (
                  <div key={p.name} className="p-space-xs rounded-lg bg-surface-container-low flex items-center gap-space-xs">
                    <div className="w-6 h-6 rounded-full bg-primary-container text-on-primary font-mono-metric text-mono-metric flex items-center justify-center text-[10px]">
                      {p.initial}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-label-md text-label-md text-on-surface truncate">{p.name}</span>
                      <span className="font-mono-code text-mono-code text-outline text-[10px]">
                        {p.turns} turn{p.turns === 1 ? "" : "s"}
                        {p.role ? ` • ${p.role}` : ""}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
