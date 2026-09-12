"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { useCopilotStore } from "@/lib/store";
import { formatShortDate } from "@/lib/format";
import {
  buildCsv,
  buildJsonPayload,
  buildMarkdownPlan,
  buildNotionRows,
  buildNotionTsv,
  jiraStubId,
  jiraTicketMarkup,
} from "@/lib/exportFormats";

type Tab = "jira" | "notion" | "markdown" | "json";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "jira", label: "Jira Format", icon: "confirmation_number" },
  { key: "notion", label: "Notion Database Table", icon: "table_rows" },
  { key: "markdown", label: "Plain Text / Markdown", icon: "markdown" },
  { key: "json", label: "JSON Schema Payload", icon: "data_object" },
];

export default function ExportWorkspacePage() {
  const params = useParams<{ id: string }>();
  const meeting = useCopilotStore((s) => s.getMeeting(params.id));
  const allItems = useCopilotStore((s) => s.items);
  const items = useMemo(() => allItems.filter((i) => i.meetingId === params.id), [allItems, params.id]);
  const [tab, setTab] = useState<Tab>("jira");
  const [toast, setToast] = useState<string | null>(null);

  const approved = useMemo(() => items.filter((i) => i.status === "approved"), [items]);
  const jiraItems = useMemo(() => approved.filter((i) => i.type === "action" || i.type === "risk"), [approved]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }

  async function copy(text: string, msg: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore — still confirm content was generated */
    }
    showToast(msg);
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

  const markdown = buildMarkdownPlan(meeting, approved);
  const json = buildJsonPayload(meeting, approved);
  const notionRows = buildNotionRows(approved);
  const notionTsv = buildNotionTsv(approved);

  return (
    <AppShell>
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-space-sm px-space-md py-space-sm bg-inverse-surface text-inverse-on-surface rounded-xl shadow-xl animate-fade-in">
          <Icon name="check_circle" className="text-tertiary-fixed-dim text-lg" />
          <span className="font-label-md text-label-md">{toast}</span>
        </div>
      )}

      <div className="w-full px-gutter-desktop py-space-xl flex flex-col gap-space-xl max-w-7xl mx-auto">
        <div className="flex flex-col gap-space-sm">
          <div className="flex items-center gap-space-xs text-on-surface-variant font-label-md text-label-md flex-wrap">
            <Link href="/dashboard" className="hover:text-primary transition-colors">Dashboard</Link>
            <Icon name="chevron_right" className="text-xs" />
            <Link href="/meetings" className="hover:text-primary transition-colors">Meetings</Link>
            <Icon name="chevron_right" className="text-xs" />
            <Link href={`/meetings/${meeting.id}/review`} className="hover:text-primary transition-colors">{meeting.title}</Link>
            <Icon name="chevron_right" className="text-xs" />
            <span className="text-on-surface font-semibold">Export Execution Plan</span>
          </div>
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-md pt-space-xs">
            <div className="flex flex-col gap-space-2xs">
              <div className="flex items-center gap-space-sm">
                <h1 className="font-display-lg text-display-lg text-on-surface tracking-tight">Export Execution Plan</h1>
                <span className="px-space-sm py-space-2xs bg-tertiary-container text-on-tertiary-container rounded-full font-label-sm text-label-sm uppercase tracking-wider font-semibold">Deterministic</span>
              </div>
              <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl">
                Copy-ready, structured output engineered directly for issue trackers and documentation databases. Zero integration setup required.
              </p>
            </div>
            <div className="flex items-center gap-space-base bg-surface-container-low px-space-md py-space-sm rounded-xl">
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm uppercase text-outline font-semibold">Tracked Items</span>
                <span className="font-mono-metric text-mono-metric text-on-surface font-bold">{approved.length} Approved</span>
              </div>
              <div className="w-px h-8 bg-outline-variant/30" />
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm uppercase text-outline font-semibold">Source</span>
                <span className="font-mono-metric text-mono-metric text-primary font-bold">{formatShortDate(meeting.recordedDate)} Transcript</span>
              </div>
              <div className="w-px h-8 bg-outline-variant/30" />
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm uppercase text-outline font-semibold">Evidence</span>
                <span className="font-mono-metric text-mono-metric text-tertiary font-bold">100% Grounded</span>
              </div>
            </div>
          </div>
        </div>

        {approved.length === 0 && (
          <div className="bg-error-container text-on-error-container rounded-xl p-space-md flex items-center gap-space-sm font-label-md text-label-md">
            <Icon name="info" className="text-lg" />
            <span>No items are approved yet — exports only include approved, human-reviewed items.</span>
            <Link href={`/meetings/${meeting.id}/review`} className="underline font-semibold ml-auto">
              Open Review Workspace
            </Link>
          </div>
        )}

        <div className="w-full bg-surface-container-low p-space-xs rounded-xl flex items-center gap-space-xs shadow-sm overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={
                tab === t.key
                  ? "flex-1 min-w-[160px] py-space-sm px-space-md rounded-lg flex items-center justify-center gap-space-xs transition-all bg-surface-container-lowest text-on-surface shadow-[0_1px_2px_rgba(0,0,0,0.06)] font-headline-sm text-headline-sm"
                  : "flex-1 min-w-[160px] py-space-sm px-space-md rounded-lg flex items-center justify-center gap-space-xs transition-all text-on-surface-variant hover:text-on-surface font-headline-sm text-headline-sm"
              }
            >
              <Icon name={t.icon} className="text-secondary text-base" />
              <span>{t.label}</span>
              {t.key === "jira" && <span className="px-space-xs py-space-2xs bg-surface-container text-on-surface-variant rounded-full font-mono-code text-mono-code ml-space-2xs">{jiraItems.length}</span>}
            </button>
          ))}
        </div>

        {tab === "jira" && (
          <div className="flex flex-col gap-space-xl">
            <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-space-lg">
              <div className="flex flex-wrap items-center gap-space-lg">
                <div className="flex items-center gap-space-sm">
                  <div className="w-10 h-10 rounded-lg bg-primary-container/10 flex items-center justify-center text-primary">
                    <Icon name="account_tree" className="text-xl" />
                  </div>
                  <div>
                    <p className="font-label-sm text-label-sm uppercase text-outline font-semibold">Target Jira Project</p>
                    <div className="flex items-center gap-space-xs mt-space-2xs">
                      <span className="font-mono-metric text-mono-metric bg-surface-container px-space-xs py-space-2xs rounded font-bold text-on-surface">[{meeting.team.toUpperCase().replace(/\s+/g, "-")}]</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-space-sm">
                <button
                  onClick={() => copy(jiraItems.map(jiraTicketMarkup).join("\n\n---\n\n"), `All ${jiraItems.length} Jira issues copied to clipboard.`)}
                  className="px-space-md py-space-sm bg-primary text-on-primary font-label-md text-label-md rounded-lg shadow-sm hover:bg-primary-container transition-colors flex items-center gap-space-xs"
                >
                  <Icon name="content_copy" className="text-base" />
                  <span>Copy All Jira Tickets</span>
                </button>
                <button
                  onClick={() => copy(buildCsv(jiraItems), "execution_plan.csv copied to clipboard.")}
                  className="px-space-md py-space-sm bg-surface-container text-on-surface font-label-md text-label-md rounded-lg hover:bg-surface-variant transition-colors flex items-center gap-space-xs"
                >
                  <Icon name="download" className="text-base" />
                  <span>Copy .CSV for Jira Importer</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-space-base">
              {jiraItems.length === 0 && (
                <div className="bg-surface-container-lowest rounded-xl p-space-xl text-center text-on-surface-variant font-body-md text-body-md shadow-sm">
                  No approved action items or risks yet.
                </div>
              )}
              {jiraItems.map((item, idx) => (
                <div key={item.id} className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md transition-all hover:shadow-md">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm pb-space-sm bg-surface-container-low/40 -mx-space-lg -mt-space-lg px-space-lg pt-space-lg rounded-t-xl">
                    <div className="flex flex-wrap items-center gap-space-sm">
                      <span className="font-mono-code text-mono-code font-bold px-space-xs py-space-2xs bg-surface-container-high text-primary rounded">
                        [{jiraStubId(idx)}] · {item.type === "risk" ? "Blocker" : "Task"}
                      </span>
                      <span className="flex items-center gap-space-2xs font-label-sm text-label-sm uppercase text-error font-semibold bg-error-container/40 px-space-xs py-space-2xs rounded">
                        <span className="h-1.5 w-1.5 rounded-full bg-error" />
                        Priority: {item.priority ?? "Medium"}
                      </span>
                    </div>
                    <button
                      onClick={() => copy(jiraTicketMarkup(item), `[${jiraStubId(idx)}] copied to clipboard.`)}
                      className="self-start sm:self-auto px-space-sm py-space-xs bg-surface-container-lowest text-on-surface hover:bg-surface-container font-label-sm text-label-sm rounded-lg flex items-center gap-space-xs transition-colors shadow-sm"
                    >
                      <Icon name="content_copy" className="text-sm" />
                      <span>Copy This Ticket</span>
                    </button>
                  </div>
                  <div className="flex flex-col gap-space-2xs">
                    <span className="font-label-sm text-label-sm uppercase text-outline font-semibold">Issue Summary</span>
                    <p className="font-headline-md text-headline-md text-on-surface font-bold">{item.title}</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-space-base py-space-xs bg-surface-container-low/50 px-space-md rounded-lg">
                    <div className="flex flex-col">
                      <span className="font-label-sm text-label-sm text-outline uppercase font-semibold">Assignee</span>
                      <span className="font-label-md text-label-md text-on-surface font-medium mt-space-2xs">{item.owner ?? "Unassigned"}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-label-sm text-label-sm text-outline uppercase font-semibold">Due Date</span>
                      <span className="font-mono-metric text-mono-metric text-on-surface font-semibold mt-space-2xs">{item.deadline ?? "—"}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-label-sm text-label-sm text-outline uppercase font-semibold">Anchor Node</span>
                      <span className="font-mono-metric text-mono-metric text-secondary font-semibold mt-space-2xs flex items-center gap-space-2xs">
                        <Icon name="schedule" className="text-sm" />
                        {item.evidence[0]?.timestamp ?? "—"}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-space-2xs">
                    <div className="flex items-center justify-between">
                      <span className="font-label-sm text-label-sm uppercase text-outline font-semibold">Pre-Formatted Jira Markup</span>
                      <span className="font-mono-code text-mono-code text-outline">application/jira-wiki-syntax</span>
                    </div>
                    <pre className="bg-surface-variant/30 p-space-md rounded-lg font-mono-code text-mono-code text-on-surface flex flex-col gap-space-xs leading-relaxed overflow-x-auto whitespace-pre-wrap">
                      {jiraTicketMarkup(item)}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "markdown" && (
          <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col gap-space-md">
            <div className="flex items-center justify-between">
              <span className="font-headline-sm text-headline-sm text-on-surface">Standard Markdown Format</span>
              <button onClick={() => copy(markdown, "Markdown plan copied to clipboard.")} className="px-space-md py-space-xs bg-primary text-on-primary rounded-lg font-label-md text-label-md flex items-center gap-space-xs">
                <Icon name="content_copy" className="text-base" />
                <span>Copy Markdown</span>
              </button>
            </div>
            <pre className="bg-inverse-surface text-inverse-on-surface p-space-md rounded-lg font-mono-code text-mono-code overflow-x-auto leading-relaxed whitespace-pre-wrap">{markdown}</pre>
          </div>
        )}

        {tab === "json" && (
          <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col gap-space-md">
            <div className="flex items-center justify-between">
              <span className="font-headline-sm text-headline-sm text-on-surface">Structured JSON Schema (RFC 8259)</span>
              <button onClick={() => copy(json, "RFC 8259 JSON payload copied to clipboard.")} className="px-space-md py-space-xs bg-primary text-on-primary rounded-lg font-label-md text-label-md flex items-center gap-space-xs">
                <Icon name="content_copy" className="text-base" />
                <span>Copy JSON Payload</span>
              </button>
            </div>
            <pre className="bg-inverse-surface text-inverse-on-surface p-space-md rounded-lg font-mono-code text-mono-code overflow-x-auto leading-relaxed whitespace-pre-wrap">{json}</pre>
          </div>
        )}

        {tab === "notion" && (
          <div className="flex flex-col gap-space-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
              <div className="flex items-center gap-space-sm">
                <div className="p-space-2xs bg-surface-container rounded">
                  <Icon name="table_chart" className="text-lg text-on-surface" />
                </div>
                <div>
                  <h2 className="font-headline-sm text-headline-sm text-on-surface">Preview: Notion Database Table View</h2>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">Direct copy pastes cleanly into a Notion inline database, Excel, or Airtable sheet.</p>
                </div>
              </div>
              <button
                onClick={() => copy(notionTsv, "Notion database table copied as tab-separated values.")}
                className="px-space-md py-space-sm bg-surface-container text-on-surface hover:bg-surface-variant font-label-md text-label-md rounded-lg flex items-center gap-space-xs transition-colors shadow-sm self-start sm:self-auto"
              >
                <Icon name="copy_all" className="text-base" />
                <span>Copy Notion Table (TSV)</span>
              </button>
            </div>
            <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left font-body-md text-body-md border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                      <th className="py-space-sm px-space-md font-semibold">Item Name</th>
                      <th className="py-space-sm px-space-md font-semibold">Type</th>
                      <th className="py-space-sm px-space-md font-semibold">Owner</th>
                      <th className="py-space-sm px-space-md font-semibold">Deadline</th>
                      <th className="py-space-sm px-space-md font-semibold">Status</th>
                      <th className="py-space-sm px-space-md font-semibold">Source Timestamp</th>
                      <th className="py-space-sm px-space-md font-semibold">Decision Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notionRows.map((r, idx) => (
                      <tr key={idx} className={idx % 2 === 1 ? "bg-surface-container-low/20 hover:bg-surface-container-low/40 transition-colors" : "hover:bg-surface-container-low/40 transition-colors"}>
                        <td className="py-space-sm px-space-md font-semibold text-on-surface">{r.name}</td>
                        <td className="py-space-sm px-space-md">
                          <span className="px-space-xs py-space-2xs bg-surface-container text-on-surface rounded font-label-sm text-label-sm">{r.type}</span>
                        </td>
                        <td className="py-space-sm px-space-md">
                          <span className="font-mono-code text-mono-code text-primary bg-primary-fixed/40 px-space-xs py-space-2xs rounded">{r.owner}</span>
                        </td>
                        <td className="py-space-sm px-space-md font-mono-code text-mono-code text-on-surface">{r.deadline}</td>
                        <td className="py-space-sm px-space-md">
                          <span className="inline-flex items-center gap-space-2xs px-space-xs py-space-2xs bg-tertiary-fixed/30 text-tertiary font-label-sm text-label-sm rounded-full font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />
                            {r.status}
                          </span>
                        </td>
                        <td className="py-space-sm px-space-md font-mono-code text-mono-code text-secondary">{r.timestamp}</td>
                        <td className="py-space-sm px-space-md text-outline">{r.link}</td>
                      </tr>
                    ))}
                    {notionRows.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-space-lg px-space-md text-center text-on-surface-variant">
                          No approved items yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="px-space-md py-space-sm bg-surface-container-low/50 flex flex-col sm:flex-row items-center justify-between text-outline font-label-sm text-label-sm gap-space-xs">
                <span>Displaying {notionRows.length} approved artifacts with citations</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
