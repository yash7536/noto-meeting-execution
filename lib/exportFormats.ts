// Copy-ready export generators. MVP does not integrate real Jira/Notion
// APIs — it produces structured, copy-paste-ready payloads sourced only
// from approved execution items (see lib/email.ts for the same rule).

import { formatShortDate } from "./format";
import type { ExecutionItem, Meeting } from "./types";

export function jiraTicketMarkup(item: ExecutionItem): string {
  const lines: string[] = [];
  lines.push("h3. Background & Objective");
  lines.push(item.description || item.title);
  lines.push("");
  lines.push("h3. Evidentiary Source");
  const e = item.evidence[0];
  if (e) {
    lines.push(`Anchored from transcript [${e.timestamp}]:`);
    lines.push(`{quote}${e.quote}{quote}`);
  }
  if (item.type === "action") {
    lines.push("");
    lines.push("h3. Acceptance Criteria");
    lines.push(`* Delivered by ${item.owner ?? "assigned owner"}${item.deadline ? ` before ${item.deadline}` : ""}`);
  }
  return lines.join("\n");
}

export function jiraStubId(index: number): string {
  return `JIRA-STUB-${String(index + 1).padStart(2, "0")}`;
}

export function buildMarkdownPlan(meeting: Meeting, items: ExecutionItem[]): string {
  const actions = items.filter((i) => i.type === "action");
  const decisions = items.filter((i) => i.type === "decision");
  const questions = items.filter((i) => i.type === "question");
  const risks = items.filter((i) => i.type === "risk");

  const lines: string[] = [`# Execution Plan: ${meeting.title} (${meeting.recordedDate})`, ""];

  if (actions.length > 0) {
    lines.push("## 1. Action Items");
    for (const a of actions) {
      lines.push(`- [ ] **[${a.code}] ${a.title}**`);
      lines.push(`  - Owner: @${a.owner ?? "Unassigned"}`);
      if (a.deadline) lines.push(`  - Deadline: ${a.deadline}`);
      lines.push(`  - Citations: Transcript [${a.evidence[0]?.timestamp ?? "n/a"}]`);
    }
    lines.push("");
  }
  if (decisions.length > 0) {
    lines.push("## 2. Decisions");
    for (const d of decisions) {
      lines.push(`- **[${d.code}]** ${d.title}${d.adrTag ? ` (${d.adrTag})` : ""}`);
      if (d.supersedes) lines.push(`  - Supersedes: ${d.supersedes.previousTitle}`);
    }
    lines.push("");
  }
  if (questions.length > 0) {
    lines.push("## 3. Open Questions");
    for (const q of questions) {
      lines.push(`- [${q.code}] ${q.title}${q.conflict?.resolved ? ` — Resolved: ${q.conflict.resolutionLabel}` : ""}`);
    }
    lines.push("");
  }
  if (risks.length > 0) {
    lines.push("## 4. Risks / Blockers");
    for (const r of risks) {
      lines.push(`- [${r.code}] ${r.title}`);
    }
  }
  return lines.join("\n");
}

export function buildJsonPayload(meeting: Meeting, items: ExecutionItem[]): string {
  const payload = {
    $schema: "https://copilot.local/schemas/v2/plan.json",
    meeting_id: meeting.id,
    meeting_title: meeting.title,
    recorded_date: meeting.recordedDate,
    generated_at: new Date().toISOString(),
    items: items.map((i) => ({
      id: i.code,
      type: i.type,
      title: i.title,
      owner: i.owner ?? null,
      deadline: i.deadline ?? null,
      priority: i.priority ?? null,
      status: i.status,
      evidence: i.evidence.map((e) => ({ timestamp: e.timestamp, speaker: e.speaker, quote: e.quote })),
      supersedes: i.supersedes?.previousTitle ?? null,
      conflict_resolution: i.conflict?.resolutionLabel ?? null,
    })),
  };
  return JSON.stringify(payload, null, 2);
}

export interface NotionRow {
  name: string;
  type: string;
  owner: string;
  deadline: string;
  status: string;
  timestamp: string;
  link: string;
}

export function buildNotionRows(items: ExecutionItem[]): NotionRow[] {
  return items.map((i) => ({
    name: i.title,
    type: i.type[0].toUpperCase() + i.type.slice(1),
    owner: i.owner ? `@${i.owner}` : i.type === "decision" ? "Team" : "—",
    deadline: i.deadline ?? "—",
    status: i.status === "approved" ? "Confirmed" : i.status === "needs_review" ? "Under Review" : "Pending",
    timestamp: i.evidence[0] ? `[${i.evidence[0].timestamp}]` : "—",
    link: i.adrTag ?? "—",
  }));
}

export function buildNotionTsv(items: ExecutionItem[]): string {
  const rows = buildNotionRows(items);
  const header = ["Item Name", "Type", "Owner", "Deadline", "Status", "Source Timestamp", "Decision Link"];
  const lines = [header.join("\t")];
  for (const r of rows) {
    lines.push([r.name, r.type, r.owner, r.deadline, r.status, r.timestamp, r.link].join("\t"));
  }
  return lines.join("\n");
}

export function buildCsv(items: ExecutionItem[]): string {
  const header = ["id", "type", "title", "owner", "deadline", "priority", "status"];
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [header.join(",")];
  for (const i of items) {
    lines.push(
      [esc(i.code), esc(i.type), esc(i.title), esc(i.owner ?? ""), esc(i.deadline ?? ""), esc(i.priority ?? ""), esc(i.status)].join(",")
    );
  }
  return lines.join("\n");
}

export { formatShortDate };
