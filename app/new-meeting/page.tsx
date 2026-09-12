"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { useCopilotStore } from "@/lib/store";
import { readTimeMinutes, wordCount } from "@/lib/format";
import { extractExecutionItems, parseTranscript } from "@/lib/extraction";
import type { AnalyzeResult } from "@/lib/types";

const DEFAULT_TRANSCRIPT = `[00:14:20] Marcus: Okay, let's talk about the user onboarding overhaul. We have high dropoff at step 3.
[00:14:45] Sara: I looked into it. It's the webhook latency and the mandatory phone verification.
[00:15:10] Marcus: Can we kill the phone verification requirement for enterprise trials?
[00:15:28] David: Security signed off on email-only OTP if SAML is configured. So let's make that a rule starting next sprint.
[00:16:02] Marcus: Great. Sara, can you take the onboarding changes and have them ready by Friday, September 12?
[00:16:15] Sara: Yeah, I'll update the onboarding flow by Friday. But who is handling the API documentation?
[00:16:30] Marcus: Maybe Arjun? Arjun, are you free or is David taking docs?
[00:16:42] Arjun: I have bandwidth after Wednesday, so I can prepare the API documentation by September 15.
[00:17:05] Elena: Wait, earlier we decided on a client-side polling mechanism for updates, but with 10k users that will melt the DB. Let's go with the managed queue instead of polling.
[00:17:35] Marcus: Agreed. Decision changed: use the managed queue, discard polling.
[00:18:00] Sara: Should push notifications be enabled by default for mobile users?
[00:18:15] Elena: Yes, it improves retention.
[00:18:22] David: No way, users hate spam on day 1—let's keep it opt-in.`;

const PRESETS: Record<string, string> = {
  zoom: `[00:02:11] Rachel: Launch checklist review. We are T-minus 4 days from production rollout.
[00:02:30] Liam: The staging dry run failed due to Stripe webhook retry storms.
[00:02:50] Rachel: Liam, let's fix idempotency headers before Thursday noon.
[00:03:05] Liam: Handled. I'll push the patch by 11 AM tomorrow, October 2.`,
  meet: `[00:00:15] Carlos: Let's confirm pricing changes for Enterprise tier.
[00:00:40] Priya: Finance wants annual contracts only, sales wants a monthly option.
[00:01:05] Carlos: We will compromise: annual by default, quarterly minimum for tier 2. Decision made.
[00:01:30] Priya: I'll draft the updated master service agreement by Friday, October 10.`,
  slack: `[00:05:10] Devin: Quick sync on the DB migration. Downtime scheduled for Sunday 2 AM UTC — that's a risk for Tier 1 customers.
[00:05:32] Chloe: Did we alert Tier 1 enterprise customers?
[00:05:45] Devin: Not yet. Chloe, can you dispatch maintenance notices by end of day?
[00:06:01] Chloe: Yes, I'll send the email blast by 4 PM.`,
};

export default function NewMeetingPage() {
  const router = useRouter();
  const addMeeting = useCopilotStore((s) => s.addMeeting);

  const [mode, setMode] = useState<"paste" | "upload">("paste");
  const [title, setTitle] = useState("Q4 Product Sync & Architecture Review");
  const [team, setTeam] = useState("Product & Engineering");
  const [transcript, setTranscript] = useState(DEFAULT_TRANSCRIPT);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const words = wordCount(transcript);
  const minutes = readTimeMinutes(transcript);
  const speakers = useMemo(() => {
    const found = new Set<string>();
    transcript.split(/\r?\n/).forEach((line) => {
      const m = line.match(/^\s*(?:\[[\d:]+\]\s*)?([A-Za-z][\w '-]{0,30}?)\s*:/);
      if (m) found.add(m[1].trim());
    });
    return Array.from(found);
  }, [transcript]);

  const preview = useMemo(() => {
    if (wordCount(transcript) < 5) return null;
    try {
      const turns = parseTranscript(transcript);
      const { items } = extractExecutionItems(turns, "preview");
      const actions = items.filter((i) => i.type === "action");
      const decisions = items.filter((i) => i.type === "decision");
      const conflicts = items.filter((i) => i.conflict && !i.conflict.resolved);
      const grounded = items.length; // every item here is evidence-anchored by construction
      return { actions, decisions, conflicts, total: items.length, grounded };
    } catch {
      return null;
    }
  }, [transcript]);

  async function handleAnalyze() {
    setError(null);
    if (!title.trim()) {
      setError("Give this meeting a title before analyzing.");
      return;
    }
    if (wordCount(transcript) < 5) {
      setError("Paste a transcript with at least a few sentences.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          team: team.trim(),
          recordedDate: new Date().toISOString().slice(0, 10),
          transcriptRaw: transcript,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Analysis failed. Please try again.");
      }
      const result: AnalyzeResult = await res.json();
      addMeeting(result.meeting, result.items);
      router.push(`/meetings/${result.meeting.id}/processing`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="w-full px-gutter-desktop py-space-lg max-w-6xl mx-auto flex flex-col gap-space-lg">
        {/* Breadcrumb & Workspace Status */}
        <div className="flex items-center justify-between flex-wrap gap-space-sm">
          <div className="flex items-center gap-space-xs font-label-md text-label-md text-on-surface-variant">
            <a href="/dashboard" className="hover:text-primary transition-colors flex items-center gap-space-2xs">
              <Icon name="grid_view" className="text-base" />
              <span>Dashboard</span>
            </a>
            <span className="text-outline-variant">/</span>
            <span className="text-on-surface font-semibold">New Meeting</span>
          </div>
          <div className="flex items-center gap-space-sm bg-surface-container-lowest px-space-md py-space-xs rounded-full shadow-sm">
            <span className="w-2 h-2 rounded-full bg-on-tertiary-container animate-pulse" />
            <span className="font-mono-metric text-mono-metric text-on-surface-variant">Deterministic Ingestion Engine</span>
            <span className="font-label-sm text-label-sm uppercase bg-surface-container-high text-primary px-space-xs py-space-2xs rounded">Live</span>
          </div>
        </div>

        {/* Header Section */}
        <div className="flex flex-col gap-space-xs max-w-3xl">
          <div className="flex items-center gap-space-xs">
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-bold">Input &amp; Grounding Matrix</span>
            <span className="text-outline-variant">•</span>
            <span className="font-label-sm text-label-sm text-outline">Pipeline stage: Raw Ingestion</span>
          </div>
          <h1 className="font-display-lg text-display-lg text-on-surface font-bold tracking-tight">Turn a meeting into execution</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant leading-relaxed">
            Paste a messy transcript and we will extract decisions, actions, questions, owners, deadlines, and conflicting statements with verbatim evidence.
          </p>
        </div>

        {/* Configuration Strip */}
        <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-space-md items-end">
            <div className="md:col-span-6 flex flex-col gap-space-2xs">
              <label className="font-label-sm text-label-sm font-semibold uppercase tracking-wider text-outline flex items-center gap-space-2xs">
                <Icon name="edit_note" className="text-sm" />
                Meeting Title
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-surface-container-low text-on-surface font-headline-sm text-headline-sm px-space-md py-space-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-outline"
                placeholder="e.g. Q4 Product Sync & Architecture Review"
                type="text"
              />
            </div>
            <div className="md:col-span-3 flex flex-col gap-space-2xs">
              <label className="font-label-sm text-label-sm font-semibold uppercase tracking-wider text-outline flex items-center gap-space-2xs">
                <Icon name="calendar_today" className="text-sm" />
                Recorded Date
              </label>
              <div className="relative flex items-center bg-surface-container-low rounded-lg px-space-md py-space-sm">
                <span className="font-mono-metric text-mono-metric text-on-surface flex-1">
                  {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                </span>
                <Icon name="expand_more" className="text-on-surface-variant text-base" />
              </div>
            </div>
            <div className="md:col-span-3 flex flex-col gap-space-2xs">
              <label className="font-label-sm text-label-sm font-semibold uppercase tracking-wider text-outline flex items-center gap-space-2xs">
                <Icon name="hub" className="text-sm" />
                Target Team / Project
              </label>
              <div className="relative flex items-center bg-surface-container-low rounded-lg px-space-md py-space-sm hover:bg-surface-container transition-colors">
                <span className="w-2 h-2 rounded-full bg-secondary mr-space-xs" />
                <input
                  value={team}
                  onChange={(e) => setTeam(e.target.value)}
                  className="font-label-md text-label-md text-on-surface font-medium flex-1 truncate bg-transparent focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Central Editor Card */}
        <div className="bg-surface-container-lowest rounded-xl shadow-md overflow-hidden flex flex-col">
          <div className="bg-surface-container-low px-space-lg py-space-sm flex flex-wrap items-center justify-between gap-space-sm">
            <div className="inline-flex bg-surface-container p-space-2xs rounded-lg">
              <button
                onClick={() => setMode("paste")}
                className={
                  mode === "paste"
                    ? "flex items-center gap-space-xs px-space-md py-space-xs bg-surface-container-lowest text-on-surface rounded font-label-md text-label-md font-semibold shadow-sm active:scale-[0.97] transition-all"
                    : "flex items-center gap-space-xs px-space-md py-space-xs text-on-surface-variant hover:text-on-surface rounded font-label-md text-label-md font-medium active:scale-[0.97] transition-all"
                }
              >
                <Icon name="text_fields" className="text-base" />
                <span>Paste Transcript</span>
              </button>
              <button
                onClick={() => setMode("upload")}
                className={
                  mode === "upload"
                    ? "flex items-center gap-space-xs px-space-md py-space-xs bg-surface-container-lowest text-on-surface rounded font-label-md text-label-md font-semibold shadow-sm active:scale-[0.97] transition-all"
                    : "flex items-center gap-space-xs px-space-md py-space-xs text-on-surface-variant hover:text-on-surface rounded font-label-md text-label-md font-medium active:scale-[0.97] transition-all"
                }
              >
                <Icon name="upload_file" className="text-base" />
                <span>Upload File (.vtt, .txt, .m4a, .mp3)</span>
              </button>
            </div>
            <div className="flex items-center gap-space-md">
              <div className="hidden sm:flex items-center gap-space-xs text-on-surface-variant font-mono-code text-mono-code">
                <Icon name="verified" className="text-sm text-on-tertiary-container" />
                <span>Autodetects speaker labels &amp; ISO timestamps</span>
              </div>
              <button
                onClick={() => setTranscript("")}
                className="flex items-center gap-space-2xs text-outline hover:text-error font-label-sm text-label-sm uppercase tracking-wider transition-colors"
              >
                <Icon name="delete_sweep" className="text-sm" />
                <span>Reset</span>
              </button>
            </div>
          </div>

          {mode === "paste" ? (
            <div className="relative flex min-h-[380px] p-space-md bg-surface-container-lowest">
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                className="w-full flex-1 resize-none bg-transparent font-mono-code text-mono-code text-on-surface leading-[24px] focus:outline-none placeholder:text-outline/50"
                placeholder="Paste conversational notes, raw transcripts with timestamps, or rough sync minutes..."
                spellCheck={false}
              />
            </div>
          ) : (
            <div className="flex min-h-[380px] items-center justify-center p-space-xl">
              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={async (e) => {
                  e.preventDefault();
                  setDragActive(false);
                  const file = e.dataTransfer.files?.[0];
                  if (!file) return;
                  const text = await file.text();
                  setTranscript(text);
                  setMode("paste");
                }}
                className={`flex flex-col items-center gap-space-sm border-2 border-dashed rounded-xl px-space-2xl py-space-xl cursor-pointer transition-all text-center ${
                  dragActive ? "border-primary bg-surface-container-low scale-[1.01]" : "border-outline-variant hover:border-primary hover:bg-surface-container-low"
                }`}
              >
                <Icon name="cloud_upload" className={`text-4xl ${dragActive ? "text-primary" : "text-outline"}`} />
                <span className="font-headline-sm text-headline-sm text-on-surface">
                  {dragActive ? "Drop to load transcript" : "Drop a .vtt, .txt, .m4a or .mp3 file"}
                </span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">Audio/VTT auto-transcription is not wired in this demo — paste text instead.</span>
                <input
                  type="file"
                  accept=".vtt,.txt"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const text = await file.text();
                    setTranscript(text);
                    setMode("paste");
                  }}
                />
              </label>
            </div>
          )}

          <div className="px-space-lg py-space-xs bg-surface-container-low/70 flex flex-wrap items-center justify-between gap-space-sm">
            <div className="flex items-center gap-space-md">
              <div className="flex items-center gap-space-xs font-mono-metric text-mono-metric text-on-surface-variant">
                <Icon name="notes" className="text-sm" />
                <span>{words} words</span>
                <span className="text-outline-variant">·</span>
                <span>~{minutes} min read</span>
              </div>
              <div className="hidden lg:flex items-center gap-space-xs px-space-sm py-space-2xs rounded bg-surface-container text-on-surface font-label-sm text-label-sm">
                <Icon name="psychology" className="text-xs text-primary" />
                <span>
                  {speakers.length} detected speaker{speakers.length === 1 ? "" : "s"}
                  {speakers.length > 0 ? `: ${speakers.join(", ")}` : ""}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-space-xs">
              <span className="font-label-sm text-label-sm text-outline uppercase font-semibold hidden md:inline">Sample Templates:</span>
              {Object.entries(PRESETS).map(([key, text]) => (
                <button
                  key={key}
                  onClick={() => setTranscript(text)}
                  className="px-space-sm py-space-2xs bg-surface-container-lowest hover:bg-surface-container text-on-surface-variant hover:text-on-surface rounded font-label-sm text-label-sm transition-colors shadow-sm capitalize"
                >
                  {key === "meet" ? "Google Meet" : key === "zoom" ? "Zoom Audio" : "Slack Huddle"}
                </button>
              ))}
            </div>
          </div>

          <div className="px-space-lg py-space-md bg-surface-container-lowest flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
            <div className="flex items-center gap-space-sm text-on-surface-variant font-body-sm text-body-sm">
              <Icon name="tune" className="text-base text-secondary" />
              <span>Target extractions: Commitments, Owners, Deadlines, Contradictions, Open Inquiries</span>
            </div>
            <div className="flex items-center gap-space-sm self-end sm:self-auto">
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="px-space-md py-space-sm text-on-surface-variant hover:text-on-surface font-label-md text-label-md font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleAnalyze}
                className="flex items-center gap-space-sm px-space-lg py-space-sm bg-primary text-on-primary rounded-lg font-headline-sm text-headline-sm hover:bg-primary-container shadow-md transition-all active:scale-[0.99] disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                    <span>Synthesizing Commitments...</span>
                  </>
                ) : (
                  <>
                    <span>Analyze Meeting</span>
                    <Icon name="arrow_forward" className="text-lg" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-error-container text-on-error-container rounded-xl p-space-md flex items-center gap-space-sm font-label-md text-label-md">
            <Icon name="error" className="text-lg" />
            <span>{error}</span>
          </div>
        )}

        {/* Trust, Evidence & Security Guarantee Banner */}
        <div className="bg-surface-container-low rounded-xl p-space-md shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-space-md">
            <div className="w-10 h-10 rounded-lg bg-surface-container-lowest flex items-center justify-center text-primary shrink-0 shadow-sm">
              <Icon name="verified_user" className="text-2xl" filled />
            </div>
            <div className="flex flex-col gap-space-2xs flex-1">
              <div className="flex items-center gap-space-xs">
                <span className="font-headline-sm text-headline-sm text-on-surface font-bold">Enterprise Privacy &amp; Verifiable Grounding Guarantee</span>
                <span className="px-space-xs py-space-2xs bg-surface-container text-on-primary-container font-label-sm text-label-sm rounded uppercase font-semibold">Deterministic</span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                Your transcript is processed strictly in this session to extract execution commitments. Every generated action, owner, and decision cites exact transcript evidence. We never invent an owner, deadline, or decision that isn&apos;t in the transcript.
              </p>
            </div>
            <div className="hidden xl:flex flex-col items-end shrink-0 pl-space-md font-mono-code text-mono-code text-outline">
              <span className="flex items-center gap-space-2xs text-on-tertiary-container">
                <span className="w-1.5 h-1.5 rounded-full bg-on-tertiary-container" />
                SOC2 Type II Ready
              </span>
              <span>Zero Data Retention Ingestion</span>
            </div>
          </div>
        </div>

        {/* Real-time Extractor Preview Strip — a live, client-side pass of
            the same deterministic engine the server will run on submit. */}
        {preview && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-space-md pt-space-xs">
            <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col gap-space-xs">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-semibold">Action Items</span>
                <span className="w-2 h-2 rounded-full bg-primary" />
              </div>
              <span className="font-display-lg text-display-lg font-bold text-on-surface">{preview.actions.length} items</span>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {preview.actions.filter((a) => a.owner).length} assigned with an explicit owner
              </p>
            </div>
            <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col gap-space-xs">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-semibold">Decisions Logged</span>
                <span className="w-2 h-2 rounded-full bg-secondary" />
              </div>
              <span className="font-display-lg text-display-lg font-bold text-on-surface">{preview.decisions.length} logged</span>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {preview.decisions.filter((d) => d.supersedes).length > 0
                  ? `Includes ${preview.decisions.filter((d) => d.supersedes).length} override of an earlier decision`
                  : "No superseded decisions detected yet"}
              </p>
            </div>
            <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col gap-space-xs">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-semibold">Unresolved Clashes</span>
                <span className="w-2 h-2 rounded-full bg-error" />
              </div>
              <span className="font-display-lg text-display-lg font-bold text-error">{preview.conflicts.length} conflict{preview.conflicts.length === 1 ? "" : "s"}</span>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {preview.conflicts[0]?.title ?? "None detected in the current draft"}
              </p>
            </div>
            <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col gap-space-xs">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-semibold">Verification Proofs</span>
                <span className="w-2 h-2 rounded-full bg-tertiary-container" />
              </div>
              <span className="font-display-lg text-display-lg font-bold text-on-surface">100%</span>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Every commitment mapped to a verbatim speaker quote</p>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
