// Follow-up email generation. By product rule, this reads ONLY from
// approved execution items — never raw AI extraction — so what gets sent
// to stakeholders is exactly what a human signed off on.

import { formatLongDate } from "./format";
import type { ExecutionItem, FollowUpConfig, Meeting } from "./types";

export interface EmailSections {
  decisions: ExecutionItem[];
  actions: ExecutionItem[];
  questions: ExecutionItem[];
  risks: ExecutionItem[];
}

export function approvedOnly(items: ExecutionItem[]): ExecutionItem[] {
  return items.filter((i) => i.status === "approved");
}

export function splitBySection(items: ExecutionItem[]): EmailSections {
  return {
    decisions: items.filter((i) => i.type === "decision"),
    actions: items.filter((i) => i.type === "action"),
    questions: items.filter((i) => i.type === "question"),
    risks: items.filter((i) => i.type === "risk"),
  };
}

export function defaultFollowUpConfig(meeting: Meeting): FollowUpConfig {
  return {
    subject: `[${meeting.title} — ${formatLongDate(meeting.recordedDate)}] Key Decisions, Action Owners & Next Steps`,
    to: "team@acme.com",
    toLabel: meeting.team,
    from: "Yash",
    fromRole: "Product Lead · Acme Core",
    includeDecisions: true,
    includeActions: true,
    includeQuestions: true,
    includeRisks: false,
    tone: "executive",
  };
}

const TONE_INTRO: Record<FollowUpConfig["tone"], (meetingTitle: string, date: string) => string> = {
  executive: (t, d) => `Thank you for the productive discussion during today's ${t} (${d}). Below is the verified execution plan agreed upon during the call:`,
  technical: (t, d) => `Recap from ${t} on ${d}. Implementation-relevant decisions and owned follow-ups below, each anchored to the transcript.`,
  casual: (t, d) => `Hey team — quick recap from ${t} (${d})! Here's what we locked in and who's got what:`,
};

export function buildEmailBody(meeting: Meeting, sections: EmailSections, config: FollowUpConfig): string {
  const lines: string[] = [];
  lines.push("Hi team,");
  lines.push("");
  lines.push(TONE_INTRO[config.tone](meeting.title, formatLongDate(meeting.recordedDate)));

  if (config.includeDecisions && sections.decisions.length > 0) {
    lines.push("");
    lines.push("DECISIONS MADE");
    for (const d of sections.decisions) {
      const supersede = d.supersedes ? ` (Supersedes: ${d.supersedes.previousTitle}.)` : "";
      lines.push(`• ${d.title}.${d.description ? ` ${d.description}` : ""}${supersede}`);
      lines.push(`  [Evidence: ${d.evidence[0]?.speaker} @ ${d.evidence[0]?.timestamp}]`);
    }
  }

  if (config.includeActions && sections.actions.length > 0) {
    lines.push("");
    lines.push("ACTION ITEMS & COMMITMENTS");
    for (const a of sections.actions) {
      lines.push(`• ${a.title} — ${a.owner ?? "Unassigned"}`);
      if (a.deadline) lines.push(`  Deadline: ${a.deadline}`);
      if (a.description) lines.push(`  Scope: ${a.description}`);
    }
  }

  if (config.includeQuestions && sections.questions.length > 0) {
    lines.push("");
    lines.push("OPEN QUESTIONS NEEDING INPUT");
    for (const q of sections.questions) {
      const resolution = q.conflict?.resolved ? ` Resolved: ${q.conflict.resolutionLabel}.` : "";
      lines.push(`• ${q.title}${resolution}`);
    }
  }

  if (config.includeRisks && sections.risks.length > 0) {
    lines.push("");
    lines.push("RISK / COMPLIANCE GATES");
    for (const r of sections.risks) {
      lines.push(`• ${r.title}${r.description ? ` — ${r.description}` : ""}`);
    }
  }

  lines.push("");
  lines.push("Please reach out if any deadlines or ownership boundaries need adjustment.");
  lines.push("");
  lines.push("Best regards,");
  lines.push(config.from);
  lines.push(config.fromRole);

  return lines.join("\n");
}

export function buildMarkdown(meeting: Meeting, sections: EmailSections, config: FollowUpConfig): string {
  const lines: string[] = [`# ${config.subject}`, ""];
  lines.push(`Hi team,`, "", TONE_INTRO[config.tone](meeting.title, formatLongDate(meeting.recordedDate)));
  if (config.includeDecisions && sections.decisions.length > 0) {
    lines.push("", "## Decisions Made");
    sections.decisions.forEach((d) => lines.push(`- **${d.title}**${d.description ? ` — ${d.description}` : ""}`));
  }
  if (config.includeActions && sections.actions.length > 0) {
    lines.push("", "## Action Items");
    sections.actions.forEach((a) => lines.push(`- [ ] **${a.title}** — ${a.owner ?? "Unassigned"}${a.deadline ? ` (Due: ${a.deadline})` : ""}`));
  }
  if (config.includeQuestions && sections.questions.length > 0) {
    lines.push("", "## Open Questions");
    sections.questions.forEach((q) => lines.push(`- ${q.title}`));
  }
  if (config.includeRisks && sections.risks.length > 0) {
    lines.push("", "## Risks / Blockers");
    sections.risks.forEach((r) => lines.push(`- ${r.title}`));
  }
  return lines.join("\n");
}
