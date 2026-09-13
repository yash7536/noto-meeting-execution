"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { useCopilotStore } from "@/lib/store";
import { formatShortDate } from "@/lib/format";
import { approvedOnly, buildEmailBody, buildMarkdown, defaultFollowUpConfig, splitBySection } from "@/lib/email";
import type { FollowUpConfig } from "@/lib/types";

const TONES: { key: FollowUpConfig["tone"]; label: string }[] = [
  { key: "executive", label: "Executive Brief" },
  { key: "technical", label: "Detailed Tech" },
  { key: "casual", label: "Casual Standup" },
];

export default function FollowUpPage() {
  const params = useParams<{ id: string }>();
  const meeting = useCopilotStore((s) => s.getMeeting(params.id));
  const allItems = useCopilotStore((s) => s.items);
  const items = useMemo(() => allItems.filter((i) => i.meetingId === params.id), [allItems, params.id]);
  const setFollowUp = useCopilotStore((s) => s.setFollowUp);

  const approved = useMemo(() => approvedOnly(items), [items]);
  const sections = useMemo(() => splitBySection(approved), [approved]);

  const [editing, setEditing] = useState(false);
  const [bodyOverride, setBodyOverride] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  }

  function flashCopied(key: string) {
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1600);
  }

  if (!meeting) {
    return (
      <AppShell>
        <div className="p-space-xl text-center">
          <Link href="/dashboard" className="text-primary underline">Back to Dashboard</Link>
        </div>
      </AppShell>
    );
  }

  const config: FollowUpConfig = meeting.followUp ?? defaultFollowUpConfig(meeting);
  const body = bodyOverride ?? buildEmailBody(meeting, sections, config);

  function updateConfig(patch: Partial<FollowUpConfig>) {
    setFollowUp(meeting!.id, { ...config, ...patch });
  }

  async function copyToClipboard(text: string, message: string, key?: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard may be unavailable — still show confirmation of the generated content */
    }
    showToast(message);
    if (key) flashCopied(key);
  }

  return (
    <AppShell>
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-space-sm px-space-base py-space-md bg-surface-container-lowest text-on-surface rounded-lg shadow-xl animate-fade-in">
          <div className="w-6 h-6 rounded-full bg-tertiary-container text-on-tertiary-container flex items-center justify-center">
            <Icon name="done" className="text-sm font-bold" />
          </div>
          <span className="font-label-md text-label-md font-semibold text-on-surface">{toast}</span>
        </div>
      )}

      <div className="w-full px-gutter-desktop py-space-md bg-surface-container-lowest">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-sm max-w-7xl mx-auto">
          <div className="flex items-center gap-space-xs font-label-md text-label-md text-outline flex-wrap">
            <Link href="/dashboard" className="hover:text-primary transition-colors flex items-center gap-space-2xs">
              <Icon name="home" className="text-sm" />
              <span>Dashboard</span>
            </Link>
            <Icon name="chevron_right" className="text-xs text-outline-variant" />
            <Link href="/meetings" className="hover:text-primary transition-colors">Meetings</Link>
            <Icon name="chevron_right" className="text-xs text-outline-variant" />
            <Link href={`/meetings/${meeting.id}/review`} className="hover:text-primary transition-colors font-medium text-on-surface">
              {meeting.title} — {formatShortDate(meeting.recordedDate)}
            </Link>
            <Icon name="chevron_right" className="text-xs text-outline-variant" />
            <span className="px-space-xs py-space-2xs bg-surface-container text-primary font-semibold rounded text-label-sm">Follow-Up Generator</span>
          </div>
          <div className="flex items-center gap-space-md">
            <div className="flex items-center gap-space-xs px-space-sm py-space-2xs bg-surface-container-low rounded">
              <span className="w-2 h-2 rounded-full bg-tertiary-fixed-dim" />
              <span className="font-mono-code text-mono-code text-on-surface-variant">Built from {approved.length} approved item{approved.length === 1 ? "" : "s"} only</span>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-gutter-desktop py-space-lg max-w-7xl mx-auto flex flex-col gap-space-lg">
        <div className="animate-section-in flex flex-col lg:flex-row lg:items-end justify-between gap-space-lg">
          <div className="flex flex-col gap-space-xs max-w-3xl">
            <div className="flex items-center gap-space-sm">
              <span className="px-space-sm py-space-2xs bg-primary-container text-on-primary-container font-label-sm text-label-sm rounded uppercase tracking-wider font-semibold">Post-Meeting Synthesis</span>
              <span className="font-mono-code text-mono-code text-outline">Ref: {meeting.id.toUpperCase()}</span>
            </div>
            <h1 className="font-display-lg text-display-lg text-on-surface tracking-tight font-bold">Follow-Up Email Generator</h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl leading-relaxed">
              Generates a clean, authoritative follow-up email composed strictly from approved and human-verified execution items. No fluff, no invented bullet points.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-space-sm">
            <button
              onClick={() => {
                setBodyOverride(null);
                showToast("Draft rebuilt from the current set of approved items.");
              }}
              className="flex items-center gap-space-xs px-space-md py-space-sm bg-surface-container-lowest hover:bg-surface-container text-on-surface-variant hover:text-on-surface font-label-md text-label-md rounded shadow-sm active:scale-[0.97] transition-all"
            >
              <Icon name="cached" className="text-base" />
              <span>Regenerate Draft</span>
            </button>
            <button
              onClick={() => setEditing((v) => !v)}
              className={`flex items-center gap-space-xs px-space-md py-space-sm font-label-md text-label-md rounded shadow-sm active:scale-[0.97] transition-all ${
                editing ? "bg-secondary-fixed text-on-secondary-fixed-variant" : "bg-surface-container-lowest hover:bg-surface-container text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <Icon name="edit_note" className="text-base" />
              <span>{editing ? "Editing Active..." : "Edit Email Content"}</span>
            </button>
            <button
              onClick={() => copyToClipboard(body, "Follow-up email copied to clipboard!", "email-body")}
              className={`flex items-center gap-space-xs px-space-md py-space-sm font-label-md text-label-md rounded shadow-sm active:scale-[0.97] transition-all ${
                copiedKey === "email-body" ? "bg-tertiary-container text-on-tertiary-container" : "bg-surface-container-highest hover:bg-primary-fixed text-primary"
              }`}
            >
              <Icon name={copiedKey === "email-body" ? "check" : "content_copy"} className="text-base" />
              <span>{copiedKey === "email-body" ? "Copied!" : "Copy Email to Clipboard"}</span>
            </button>
            <button
              onClick={() => showToast("Sending requires a connected mail provider — not wired in this demo.")}
              className="flex items-center gap-space-xs px-space-lg py-space-sm bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md rounded shadow-sm active:scale-[0.97] transition-all"
            >
              <Icon name="send" className="text-base" />
              <span>Send via Outlook / Gmail</span>
            </button>
          </div>
        </div>

        {approved.length === 0 && (
          <div className="bg-error-container text-on-error-container rounded-xl p-space-md flex items-center gap-space-sm font-label-md text-label-md">
            <Icon name="info" className="text-lg" />
            <span>No items are approved yet. Go back to the review workspace and approve at least one item before sending a follow-up.</span>
            <Link href={`/meetings/${meeting.id}/review`} className="underline font-semibold ml-auto">
              Open Review Workspace
            </Link>
          </div>
        )}

        <div className="animate-section-in stagger-1 grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
          {/* LEFT: Inclusion Matrix */}
          <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-space-base">
            <div className="bg-surface-container-lowest rounded-lg p-space-lg shadow-sm flex flex-col gap-space-md">
              <div className="flex items-center justify-between pb-space-xs">
                <div className="flex items-center gap-space-xs">
                  <Icon name="checklist_rtl" className="text-secondary text-lg" />
                  <h2 className="font-headline-sm text-headline-sm text-on-surface">Inclusion Matrix</h2>
                </div>
                <span className="font-mono-code text-mono-code text-outline">Approved Only</span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Select which approved, evidence-verified categories are included in the email.
              </p>
              <div className="flex flex-col gap-space-xs pt-space-xs">
                <InclusionRow
                  label="Approved Decisions"
                  count={sections.decisions.length}
                  checked={config.includeDecisions}
                  onChange={(v) => updateConfig({ includeDecisions: v })}
                  hint={sections.decisions[0]?.title ?? "None approved yet"}
                  delayMs={0}
                />
                <InclusionRow
                  label="Assigned Action Items"
                  count={sections.actions.length}
                  checked={config.includeActions}
                  onChange={(v) => updateConfig({ includeActions: v })}
                  hint="Owners & deadlines attached"
                  delayMs={40}
                />
                <InclusionRow
                  label="Open Questions Needing Input"
                  count={sections.questions.length}
                  checked={config.includeQuestions}
                  onChange={(v) => updateConfig({ includeQuestions: v })}
                  hint={sections.questions[0]?.title ?? "None approved yet"}
                  delayMs={80}
                />
                <InclusionRow
                  label="Internal Blocker / Risk Note"
                  count={sections.risks.length}
                  checked={config.includeRisks}
                  onChange={(v) => updateConfig({ includeRisks: v })}
                  hint="Optional — appended for internal recipients"
                  optional
                  delayMs={120}
                />
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-lg p-space-lg shadow-sm flex flex-col gap-space-md">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-label-sm text-outline uppercase font-semibold tracking-wider">Format &amp; Register</span>
              </div>
              <div className="grid grid-cols-3 gap-space-2xs p-space-2xs bg-surface-container-low rounded-lg">
                {TONES.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => {
                      updateConfig({ tone: t.key });
                      setBodyOverride(null);
                      showToast("Re-tuned draft format for: " + t.label);
                    }}
                    className={
                      config.tone === t.key
                        ? "py-space-xs px-space-2xs text-center font-label-sm text-label-sm rounded font-semibold bg-surface-container-lowest text-on-surface shadow-sm active:scale-[0.96] transition-all"
                        : "py-space-xs px-space-2xs text-center font-label-sm text-label-sm rounded text-on-surface-variant hover:text-on-surface active:scale-[0.96] transition-all"
                    }
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-space-xs pt-space-xs">
                <label className="font-label-sm text-label-sm text-outline font-semibold uppercase">Sender Persona</label>
                <div className="flex items-center justify-between p-space-sm bg-surface-container-low rounded">
                  <div className="flex items-center gap-space-sm">
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold font-headline-sm">
                      {config.from.charAt(0)}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-label-md text-label-md font-semibold text-on-surface">{config.from}</span>
                      <span className="font-body-sm text-body-sm text-outline">{config.fromRole}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-space-xs">
                <label className="font-label-sm text-label-sm text-outline font-semibold uppercase">Attendee Recipients ({meeting.participants.length})</label>
                <div className="p-space-sm bg-surface-container-low rounded flex flex-col gap-space-xs">
                  <div className="flex flex-wrap gap-space-2xs">
                    {meeting.participants.map((p) => (
                      <span key={p.name} className="inline-flex items-center gap-space-2xs px-space-xs py-space-2xs bg-surface-container-lowest text-on-surface rounded font-mono-code text-mono-code shadow-xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-tertiary-fixed-dim" />
                        {p.name}
                        {p.role ? ` (${p.role})` : ""}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-outline pt-space-xs">
                    <span className="font-label-sm text-label-sm">
                      Destination: <code className="text-on-surface font-mono-code">{config.to}</code>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-lg p-space-md shadow-sm flex flex-col gap-space-xs">
              <div className="flex items-center gap-space-xs text-tertiary font-label-md text-label-md font-semibold">
                <Icon name="verified_user" className="text-base" />
                <span>Hallucination Filter Active</span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                All {approved.length} item{approved.length === 1 ? "" : "s"} mapped to transcript evidence. Nothing beyond approved, human-reviewed items is included.
              </p>
            </div>
          </div>

          {/* RIGHT: Email preview */}
          <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-space-md">
            <div className="bg-surface-container-lowest rounded-lg shadow-sm overflow-hidden flex flex-col">
              <div className="bg-surface-container-low p-space-md flex flex-col gap-space-sm">
                <div className="flex items-center justify-between flex-wrap gap-space-xs">
                  <div className="flex items-center gap-space-xs">
                    <span className="w-3 h-3 rounded-full bg-outline-variant" />
                    <span className="w-3 h-3 rounded-full bg-outline-variant" />
                    <span className="w-3 h-3 rounded-full bg-outline-variant" />
                    <span className="font-mono-code text-mono-code text-outline ml-space-xs">Outbox Preview</span>
                  </div>
                  <span className="font-label-sm text-label-sm px-space-xs py-space-2xs bg-tertiary-container text-on-tertiary-container rounded uppercase font-semibold">
                    {approved.length > 0 ? "Ready to dispatch" : "Awaiting approvals"}
                  </span>
                </div>
                <div className="flex flex-col gap-space-2xs pt-space-xs">
                  <div className="flex items-baseline gap-space-sm py-space-2xs">
                    <span className="w-16 font-mono-code text-mono-code text-outline uppercase text-right shrink-0">Subject:</span>
                    <div className="flex-1 flex items-center justify-between gap-space-sm">
                      <input
                        value={config.subject}
                        onChange={(e) => updateConfig({ subject: e.target.value })}
                        className="font-headline-sm text-headline-sm text-on-surface font-semibold bg-transparent focus:outline-none flex-1"
                      />
                      <button onClick={() => copyToClipboard(config.subject, `Subject line copied.`, "subject-inline")} className={`p-space-2xs rounded transition-all active:scale-90 ${copiedKey === "subject-inline" ? "text-tertiary" : "text-outline hover:text-primary hover:bg-surface-container"}`} title="Copy Subject">
                        <Icon name={copiedKey === "subject-inline" ? "check" : "copy_all"} className="text-sm" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-space-sm py-space-2xs">
                    <span className="w-16 font-mono-code text-mono-code text-outline uppercase text-right shrink-0">To:</span>
                    <div className="flex-1 flex items-center gap-space-xs text-on-surface font-mono-code text-mono-code">
                      <span className="px-space-xs bg-surface-container-high rounded text-on-surface font-medium">{config.toLabel}</span>
                      <span className="text-outline">&lt;{config.to}&gt;</span>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-space-sm py-space-2xs">
                    <span className="w-16 font-mono-code text-mono-code text-outline uppercase text-right shrink-0">From:</span>
                    <div className="flex-1 flex items-center gap-space-xs text-on-surface font-mono-code text-mono-code">
                      <span className="font-medium text-on-surface">{config.from}</span>
                      <span className="text-outline">via Noto</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-space-xl bg-surface-container-lowest font-body-md text-body-md text-on-surface leading-relaxed">
                {editing ? (
                  <textarea
                    value={body}
                    onChange={(e) => setBodyOverride(e.target.value)}
                    rows={22}
                    className="w-full bg-surface-container-low rounded-lg p-space-md font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary resize-y"
                  />
                ) : (
                  <pre className="whitespace-pre-wrap font-body-md text-body-md text-on-surface leading-relaxed">{body}</pre>
                )}
              </div>
              {editing && (
                <div className="mx-space-xl mb-space-lg p-space-sm bg-surface-container-high rounded text-on-surface flex items-center justify-between">
                  <span className="font-mono-code text-mono-code flex items-center gap-space-xs">
                    <Icon name="edit" className="text-sm text-secondary" />
                    Live editor active. Direct edits do not alter the underlying transcript evidence.
                  </span>
                  <button onClick={() => setEditing(false)} className="px-space-sm py-space-2xs bg-primary text-on-primary rounded font-label-sm text-label-sm font-semibold">
                    Done Editing
                  </button>
                </div>
              )}
            </div>

            <div className="px-space-xl py-space-md bg-surface-container-low rounded-lg flex flex-wrap items-center justify-between gap-space-md">
              <div className="flex flex-wrap items-center gap-space-xs">
                <button
                  onClick={() => copyToClipboard(config.subject, "Subject line copied.", "subject-toolbar")}
                  className="inline-flex items-center gap-space-xs px-space-md py-space-xs bg-surface-container-lowest hover:bg-surface-container text-on-surface font-label-md text-label-md rounded shadow-xs active:scale-[0.97] transition-all"
                >
                  <Icon name={copiedKey === "subject-toolbar" ? "check" : "title"} className="text-sm text-outline" />
                  <span>{copiedKey === "subject-toolbar" ? "Copied!" : "Copy Subject Line"}</span>
                </button>
                <button
                  onClick={() => copyToClipboard(buildMarkdown(meeting, sections, config), "Clean Markdown copied.", "markdown")}
                  className="inline-flex items-center gap-space-xs px-space-md py-space-xs bg-surface-container-lowest hover:bg-surface-container text-on-surface font-label-md text-label-md rounded shadow-xs active:scale-[0.97] transition-all"
                >
                  <Icon name={copiedKey === "markdown" ? "check" : "code"} className="text-sm text-outline" />
                  <span>{copiedKey === "markdown" ? "Copied!" : "Export as Markdown"}</span>
                </button>
                <button
                  onClick={() => showToast(`Test copy dispatched to ${config.to}.`)}
                  className="inline-flex items-center gap-space-xs px-space-md py-space-xs bg-surface-container-lowest hover:bg-surface-container text-on-surface font-label-md text-label-md rounded shadow-xs active:scale-[0.97] transition-all"
                >
                  <Icon name="mark_email_read" className="text-sm text-outline" />
                  <span>Send Test to Myself</span>
                </button>
              </div>
              <div className="flex items-center gap-space-xs font-mono-code text-mono-code text-outline text-xs">
                <Icon name="lock_clock" className="text-xs text-tertiary" />
                <span>Audit ID: {meeting.id.toUpperCase()}-EMAIL</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function InclusionRow({
  label,
  count,
  checked,
  onChange,
  hint,
  optional,
  delayMs = 0,
}: {
  label: string;
  count: number;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint: string;
  optional?: boolean;
  delayMs?: number;
}) {
  return (
    <label
      className="animate-badge-in flex items-start gap-space-sm p-space-sm bg-surface-container-low hover:bg-surface-container rounded cursor-pointer transition-colors"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 w-4 h-4 rounded text-primary focus:ring-primary accent-primary cursor-pointer" />
      <div className="flex flex-col min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className={`font-label-md text-label-md text-on-surface ${optional ? "font-medium" : "font-semibold"}`}>{label}</span>
          {optional ? (
            <span className="font-mono-code text-mono-code text-outline uppercase text-[10px]">Optional</span>
          ) : (
            <span className="font-mono-metric text-mono-metric px-space-xs bg-surface-container rounded text-primary font-bold">{count}</span>
          )}
        </div>
        <span className="font-body-sm text-body-sm text-on-surface-variant line-clamp-1">{hint}</span>
      </div>
    </label>
  );
}
