// Hand-authored seed content for the demo workspace. The "Product Sync"
// meeting mirrors the Stitch reference designs verbatim (same transcript,
// same extracted items, same evidence, same conflict/supersession) so the
// hero Execution Review Workspace, the edit drawer, the follow-up email,
// the export workspace and the approved plan all show consistent,
// evidence-grounded content out of the box. The other three meetings are
// lighter-weight so the Dashboard / Meetings / Execution Plans lists have
// real, varied content to browse.

import type {
  Evidence,
  ExecutionItem,
  Meeting,
  Participant,
  TranscriptTurn,
} from "./types";

function turn(
  id: string,
  timestamp: string,
  speaker: string,
  speakerRole: string | undefined,
  text: string,
  tag?: TranscriptTurn["tag"]
): TranscriptTurn {
  return { id, timestamp, speaker, speakerRole, text, tag };
}

function ev(
  quote: string,
  speaker: string,
  timestamp: string,
  turnIds: string[],
  speakerRole?: string
): Evidence {
  return { quote, speaker, speakerRole, timestamp, turnIds };
}

function item(partial: Omit<ExecutionItem, "createdAt" | "updatedAt">): ExecutionItem {
  const now = "2026-09-10T16:15:00.000Z";
  return { ...partial, createdAt: now, updatedAt: now };
}

/* ------------------------------------------------------------------ */
/* Meeting 1 — Product Sync (the hero demo meeting)                    */
/* ------------------------------------------------------------------ */

const PS_ID = "mtg-product-sync";

const psTurns: TranscriptTurn[] = [
  turn("t-00-14-20", "00:14:20", "Marcus", "VP Product", "Okay, let's talk about the user onboarding overhaul. We have high dropoff at step 3."),
  turn("t-00-14-45", "00:14:45", "Sara", "Frontend Lead", "I looked into it. It's the webhook latency and the mandatory phone verification."),
  turn("t-00-15-10", "00:15:10", "Marcus", "VP Product", "Can we kill the phone verification requirement for enterprise trials?"),
  turn("t-00-15-28", "00:15:28", "David", "Tech Lead", "Security signed off on email-only OTP if SAML is configured. So let's make that a rule starting next sprint."),
  turn("t-00-16-02", "00:16:02", "Marcus", "VP Product", "Alright team, let's lock in execution commitments before we dive into telemetry graphs. Sara, can you take the onboarding changes and have them ready by Friday? We cannot slip the enterprise pilot date again."),
  turn("t-00-16-15", "00:16:15", "Sara", "Frontend Lead", "Yes, already sketched the wireframe adjustments. Friday 5 PM is solid. But who is handling the API documentation?"),
  turn("t-00-16-30", "00:16:30", "Marcus", "VP Product", "Great. For the partner API integration documentation... Maybe Arjun? Arjun, are you free or is David taking docs?", "ambiguous"),
  turn("t-00-16-42", "00:16:42", "Arjun", "API Platform", "I have bandwidth after Wednesday, so I can prepare the API documentation by September 15. But David needs to sign off on the gateway schema.", "ambiguous"),
  turn("t-00-17-05", "00:17:05", "David", "Tech Lead", "For the real-time sync, let's keep it simple with HTTP client-side polling every 2 seconds. Easy to roll out without queue infra.", "superseded"),
  turn("t-00-17-35", "00:17:35", "Elena", "Principal Architect", "Wait — earlier we decided on a client-side polling mechanism for updates, but with 10k users that will melt the DB. Let's go with the managed queue instead of polling. Polling will melt Postgres at 10,000 concurrent sessions.", "pivot"),
  turn("t-00-17-52", "00:17:52", "Elena", "Principal Architect", "If we deploy standard polling against the user-event ingestion endpoint, we breach the p99 SLA under peak spikes. We are agreeing today to standardize on the managed queue stream with backpressure."),
  turn("t-00-18-02", "00:18:02", "Marcus", "VP Product", "Agreed. Decision changed: use the managed queue, discard polling."),
  turn("t-00-18-00", "00:18:00", "Sara", "Frontend Lead", "Should push notifications be enabled by default for mobile users?"),
  turn("t-00-18-15", "00:18:15", "Elena", "Principal Architect", "Yes, it improves retention if we leave push notifications enabled as default opt-out. It improves 30-day user retention by 24%."),
  turn("t-00-18-22", "00:18:22", "David", "Tech Lead", "No way, users hate spam on day 1 — let's keep it opt-in to build trust."),
  turn("t-00-19-05", "00:19:05", "Sara", "Frontend Lead", "Should we alert enterprise customers before we remove the phone verification step, or is that overkill for a security relaxation?"),
  turn("t-00-21-40", "00:21:40", "David", "Tech Lead", "Security only signed off on email-only OTP if SAML is configured. If an admin disables SAML, we cannot bypass 2FA via email alone — otherwise SOC2 audit will fail next week."),
];

const psParticipants: Participant[] = [
  { name: "Marcus", role: "VP Product", turns: 5, initial: "M" },
  { name: "Sara", role: "Frontend Lead", turns: 3, initial: "S" },
  { name: "David", role: "Tech Lead", turns: 4, initial: "D" },
  { name: "Arjun", role: "API Platform", turns: 1, initial: "A" },
  { name: "Elena", role: "Principal Architect", turns: 3, initial: "E" },
];

const psItems: ExecutionItem[] = [
  item({
    id: "act-9021",
    meetingId: PS_ID,
    code: "ACT-9021",
    type: "action",
    title: "Update the onboarding flow",
    description: "Revise friction points identified in Q3 user feedback analysis; ship the wireframe adjustments Sara scoped.",
    owner: "Sara",
    deadline: "Friday, Sept 12, 2026",
    deadlineConfirmed: true,
    priority: "High",
    status: "extracted",
    evidence: [ev("Sara, can you take the onboarding changes and have them ready by Friday?", "Marcus", "00:16:02", ["t-00-16-02"], "VP Product")],
    ambiguityFlags: [],
    targetJira: true,
    targetEmail: true,
    targetNotion: true,
    jiraKey: "ENG-4912",
  }),
  item({
    id: "act-9022",
    meetingId: PS_ID,
    code: "ACT-9022",
    type: "action",
    title: "Prepare API documentation for partner integration",
    description: "Draft comprehensive partner API documentation for third-party ingestion webhooks and rate-limit contracts.",
    ownerCandidates: ["Arjun", "David"],
    deadline: "September 15, 2026",
    deadlineConfirmed: true,
    priority: "High",
    status: "needs_review",
    evidence: [
      ev(
        "Marcus: Maybe Arjun? Arjun, are you free or is David taking docs? … Arjun: I have bandwidth after Wednesday, so I can prepare the API documentation by September 15.",
        "Marcus",
        "00:16:30 - 00:16:42",
        ["t-00-16-30", "t-00-16-42"]
      ),
    ],
    ambiguityFlags: [
      { type: "owner_unclear", message: "Owner unclear · conflicting assignment in transcript (Arjun volunteered, but Marcus also named David)." },
    ],
    targetJira: true,
    targetEmail: true,
    targetNotion: true,
    jiraKey: "ENG-4913",
  }),
  item({
    id: "act-9023",
    meetingId: PS_ID,
    code: "ACT-9023",
    type: "action",
    title: "Provision staging sandbox clusters in us-east-2",
    description: "Stand up isolated staging clusters ahead of the partner API integration kickoff.",
    owner: "David",
    deadline: "September 18, 2026",
    deadlineConfirmed: true,
    priority: "Medium",
    status: "approved",
    evidence: [ev("We'll need a sandbox cluster live in us-east-2 before partners can hit the new endpoints.", "David", "00:17:05", ["t-00-17-05"], "Tech Lead")],
    ambiguityFlags: [],
    targetJira: true,
    targetEmail: false,
    targetNotion: true,
  }),
  item({
    id: "act-9024",
    meetingId: PS_ID,
    code: "ACT-9024",
    type: "action",
    title: "Configure SAML email OTP rule",
    description: "Enforce one-time authentication passcode requirement across enterprise tenants.",
    owner: "David",
    deadline: "Sprint 24 Start",
    deadlineConfirmed: true,
    priority: "High",
    status: "approved",
    evidence: [ev("Security signed off on email-only OTP if SAML is configured. So let's make that a rule starting next sprint.", "David", "00:15:28", ["t-00-15-28"], "Tech Lead")],
    ambiguityFlags: [],
    targetJira: true,
    targetEmail: true,
    targetNotion: true,
    linearKey: "LIN-put",
  }),
  item({
    id: "act-9025",
    meetingId: PS_ID,
    code: "ACT-9025",
    type: "action",
    title: "Remove mandatory phone verification for enterprise SAML trials",
    description: "Bypass phone verification automatically for enterprise SAML tenant sessions.",
    owner: "David",
    deadline: undefined,
    deadlineConfirmed: false,
    priority: "Medium",
    status: "extracted",
    evidence: [ev("Can we kill the phone verification requirement for enterprise trials?", "Marcus", "00:15:10", ["t-00-15-10"], "VP Product")],
    ambiguityFlags: [{ type: "deadline_unclear", message: "No explicit deadline stated — tie to the Sprint 24 SAML OTP rollout." }],
    targetJira: true,
    targetEmail: false,
    targetNotion: true,
  }),
  item({
    id: "act-9026",
    meetingId: PS_ID,
    code: "ACT-9026",
    type: "action",
    title: "Fix webhook latency causing step-3 onboarding dropoff",
    description: "Root-cause the webhook latency contributing to onboarding step-3 dropoff.",
    owner: "Sara",
    deadline: undefined,
    deadlineConfirmed: false,
    priority: "High",
    status: "needs_review",
    evidence: [ev("I looked into it. It's the webhook latency and the mandatory phone verification.", "Sara", "00:14:45", ["t-00-14-45"], "Frontend Lead")],
    ambiguityFlags: [{ type: "deadline_unclear", message: "No explicit deadline stated in the transcript for this item." }],
    targetJira: true,
    targetEmail: false,
    targetNotion: true,
  }),
  item({
    id: "dec-041",
    meetingId: PS_ID,
    code: "DEC-041",
    type: "decision",
    title: "Use managed queue architecture instead of client polling",
    description: "Superseded earlier polling proposal for horizontal scale resilience.",
    priority: "High",
    status: "extracted",
    evidence: [
      ev(
        "Elena: Let's go with the managed queue instead of polling… Marcus: Agreed. Decision changed: use the managed queue, discard polling.",
        "Elena",
        "00:17:35",
        ["t-00-17-35", "t-00-18-02"],
        "Principal Architect"
      ),
    ],
    ambiguityFlags: [],
    supersedes: {
      previousTitle: "Client-side polling mechanism for real-time updates",
      previousQuote: "For the real-time sync, let's keep it simple with HTTP client-side polling every 2 seconds. Easy to roll out without queue infra.",
      previousTimestamp: "00:17:05",
      supersededAtTimestamp: "00:17:35",
    },
    adrTag: "#adr-09-concurrency",
    targetJira: false,
    targetEmail: true,
    targetNotion: true,
  }),
  item({
    id: "dec-042",
    meetingId: PS_ID,
    code: "DEC-042",
    type: "decision",
    title: "Standardize on OAuth2 Bearer Tokens across gateway",
    description: "Unify auth handling ahead of the partner API integration.",
    priority: "Medium",
    status: "approved",
    evidence: [ev("David needs to sign off on the gateway schema.", "Arjun", "00:16:42", ["t-00-16-42"], "API Platform")],
    ambiguityFlags: [],
    adrTag: "#adr-10-gateway-auth",
    targetJira: false,
    targetEmail: false,
    targetNotion: true,
  }),
  item({
    id: "dec-043",
    meetingId: PS_ID,
    code: "DEC-043",
    type: "decision",
    title: "Enforce email-only OTP verification when SAML is configured",
    description: "Security-approved compliance rule effective Sprint 24.",
    priority: "High",
    status: "approved",
    evidence: [ev("Security signed off on email-only OTP if SAML is configured.", "David", "00:15:28", ["t-00-15-28"], "Tech Lead")],
    ambiguityFlags: [],
    adrTag: "#adr-11-enterprise-auth",
    targetJira: false,
    targetEmail: true,
    targetNotion: true,
  }),
  item({
    id: "que-108",
    meetingId: PS_ID,
    code: "QUE-108",
    type: "question",
    title: "Should push notifications be enabled by default for mobile users?",
    priority: "Medium",
    status: "needs_review",
    evidence: [ev("Should push notifications be enabled by default for mobile users?", "Sara", "00:18:00", ["t-00-18-00"], "Frontend Lead")],
    ambiguityFlags: [{ type: "conflicting_statements", message: "Elena and David expressed opposing positions." }],
    conflict: {
      id: "conflict-push-default",
      summary: "Push notifications default setting: Elena (opt-out) vs. David (opt-in).",
      resolved: false,
      positions: [
        { speaker: "Elena", quote: "Yes, it improves 30-day user retention by 24%.", timestamp: "00:18:15", stance: "Opt-Out" },
        { speaker: "David", quote: "No way, users hate spam on day 1 — let's keep it opt-in.", timestamp: "00:18:22", stance: "Opt-In" },
      ],
    },
    targetJira: false,
    targetEmail: true,
    targetNotion: true,
  }),
  item({
    id: "que-109",
    meetingId: PS_ID,
    code: "QUE-109",
    type: "question",
    title: "Should enterprise customers be alerted before phone verification is removed?",
    priority: "Low",
    status: "extracted",
    evidence: [ev("Should we alert enterprise customers before we remove the phone verification step, or is that overkill for a security relaxation?", "Sara", "00:19:05", ["t-00-19-05"], "Frontend Lead")],
    ambiguityFlags: [{ type: "needs_clarification", message: "Open question raised in the meeting with no recorded resolution." }],
    targetJira: false,
    targetEmail: true,
    targetNotion: false,
  }),
  item({
    id: "rsk-019",
    meetingId: PS_ID,
    code: "RSK-019",
    type: "risk",
    title: "Security sign-off dependency for SAML email OTP",
    description: "SOC2 audit impact mitigated by prioritizing email OTP in Sprint 24.",
    owner: "David",
    priority: "High",
    status: "extracted",
    evidence: [ev("Security only signed off on email-only OTP if SAML is configured, otherwise SOC2 audit will fail next week.", "David", "00:21:40", ["t-00-21-40"], "Tech Lead")],
    ambiguityFlags: [],
    targetJira: true,
    targetEmail: true,
    targetNotion: true,
  }),
];

export function buildProductSyncMeeting(): { meeting: Meeting; items: ExecutionItem[] } {
  const meeting: Meeting = {
    id: PS_ID,
    title: "Product Sync",
    team: "Core Platform",
    recordedDate: "2026-09-10",
    durationMinutes: 45,
    transcriptRaw: psTurns.map((t) => `[${t.timestamp}] ${t.speaker}: ${t.text}`).join("\n"),
    transcriptTurns: psTurns,
    participants: psParticipants,
    status: "needs_review",
    createdAt: "2026-09-10T14:00:00.000Z",
  };
  return { meeting, items: psItems };
}

/* ------------------------------------------------------------------ */
/* Meeting 2 — Sprint Planning & Architecture (reviewed & synced)      */
/* ------------------------------------------------------------------ */

function buildSprintPlanningMeeting(): { meeting: Meeting; items: ExecutionItem[] } {
  const id = "mtg-sprint-planning";
  const turns: TranscriptTurn[] = [
    turn("t2-00-02-00", "00:02:00", "Priya", "Eng Manager", "Let's finalize the Sprint 24 scope. Top priority is the gateway rate-limit rollout."),
    turn("t2-00-03-10", "00:03:10", "Noah", "Backend Eng", "I'll own the rate-limiter service and have it in staging by next Tuesday."),
    turn("t2-00-04-45", "00:04:45", "Priya", "Eng Manager", "Agreed — we're standardizing on the token-bucket algorithm over fixed windows for burst tolerance."),
    turn("t2-00-06-20", "00:06:20", "Wei", "SRE", "Downtime risk: the migration script cannot run without a maintenance window, otherwise we risk dropped writes."),
  ];
  const meeting: Meeting = {
    id,
    title: "Sprint Planning & Architecture",
    team: "Engineering",
    recordedDate: "2026-09-08",
    durationMinutes: 60,
    transcriptRaw: turns.map((t) => `[${t.timestamp}] ${t.speaker}: ${t.text}`).join("\n"),
    transcriptTurns: turns,
    participants: [
      { name: "Priya", role: "Eng Manager", turns: 2, initial: "P" },
      { name: "Noah", role: "Backend Eng", turns: 1, initial: "N" },
      { name: "Wei", role: "SRE", turns: 1, initial: "W" },
    ],
    status: "reviewed_synced",
    createdAt: "2026-09-08T15:00:00.000Z",
    approvedAt: "2026-09-08T16:40:00.000Z",
    approvedBy: "Yash",
  };
  const items: ExecutionItem[] = [
    item({
      id: "act-sp-1",
      meetingId: id,
      code: "ACT-6110",
      type: "action",
      title: "Build the gateway rate-limiter service",
      owner: "Noah",
      deadline: "Tuesday, Sept 15, 2026",
      deadlineConfirmed: true,
      priority: "High",
      status: "approved",
      evidence: [ev("I'll own the rate-limiter service and have it in staging by next Tuesday.", "Noah", "00:03:10", ["t2-00-03-10"], "Backend Eng")],
      ambiguityFlags: [],
      targetJira: true,
      jiraKey: "PLAT-2201",
    }),
    item({
      id: "dec-sp-1",
      meetingId: id,
      code: "DEC-060",
      type: "decision",
      title: "Standardize on token-bucket rate limiting over fixed windows",
      priority: "Medium",
      status: "approved",
      evidence: [ev("Agreed — we're standardizing on the token-bucket algorithm over fixed windows for burst tolerance.", "Priya", "00:04:45", ["t2-00-04-45"], "Eng Manager")],
      ambiguityFlags: [],
      adrTag: "#adr-12-rate-limit",
    }),
    item({
      id: "rsk-sp-1",
      meetingId: id,
      code: "RSK-030",
      type: "risk",
      title: "Migration script requires a maintenance window",
      owner: "Wei",
      priority: "High",
      status: "approved",
      evidence: [ev("Downtime risk: the migration script cannot run without a maintenance window, otherwise we risk dropped writes.", "Wei", "00:06:20", ["t2-00-06-20"], "SRE")],
      ambiguityFlags: [],
      targetJira: true,
      jiraKey: "PLAT-2202",
    }),
  ];
  return { meeting, items };
}

/* ------------------------------------------------------------------ */
/* Meeting 3 — Customer Onboarding Friction Post-Mortem (approved)     */
/* ------------------------------------------------------------------ */

function buildPostMortemMeeting(): { meeting: Meeting; items: ExecutionItem[] } {
  const id = "mtg-cs-postmortem";
  const turns: TranscriptTurn[] = [
    turn("t3-00-01-00", "00:01:00", "Renee", "Customer Success Lead", "Three enterprise accounts flagged the same activation friction last week."),
    turn("t3-00-02-30", "00:02:30", "Omar", "Support Eng", "I'll compile the friction-point report and send it to the product team by Monday."),
    turn("t3-00-04-10", "00:04:10", "Renee", "Customer Success Lead", "Decision made: we're moving the CSM handoff call earlier, to day 2 instead of day 5."),
  ];
  const meeting: Meeting = {
    id,
    title: "Customer Onboarding Friction Post-Mortem",
    team: "Customer Success",
    recordedDate: "2026-09-05",
    durationMinutes: 30,
    transcriptRaw: turns.map((t) => `[${t.timestamp}] ${t.speaker}: ${t.text}`).join("\n"),
    transcriptTurns: turns,
    participants: [
      { name: "Renee", role: "Customer Success Lead", turns: 2, initial: "R" },
      { name: "Omar", role: "Support Eng", turns: 1, initial: "O" },
    ],
    status: "approved",
    createdAt: "2026-09-05T13:00:00.000Z",
    approvedAt: "2026-09-05T14:10:00.000Z",
    approvedBy: "Yash",
  };
  const items: ExecutionItem[] = [
    item({
      id: "act-cs-1",
      meetingId: id,
      code: "ACT-3301",
      type: "action",
      title: "Compile the activation friction-point report",
      owner: "Omar",
      deadline: "Monday, Sept 8, 2026",
      deadlineConfirmed: true,
      priority: "Medium",
      status: "approved",
      evidence: [ev("I'll compile the friction-point report and send it to the product team by Monday.", "Omar", "00:02:30", ["t3-00-02-30"], "Support Eng")],
      ambiguityFlags: [],
      targetEmail: true,
    }),
    item({
      id: "dec-cs-1",
      meetingId: id,
      code: "DEC-070",
      type: "decision",
      title: "Move the CSM handoff call to day 2 of onboarding",
      priority: "Medium",
      status: "approved",
      evidence: [ev("Decision made: we're moving the CSM handoff call earlier, to day 2 instead of day 5.", "Renee", "00:04:10", ["t3-00-04-10"], "Customer Success Lead")],
      ambiguityFlags: [],
    }),
    item({
      id: "que-cs-1",
      meetingId: id,
      code: "QUE-201",
      type: "question",
      title: "Should the trial period extend for accounts that hit activation friction?",
      priority: "Low",
      status: "approved",
      evidence: [ev("Three enterprise accounts flagged the same activation friction last week.", "Renee", "00:01:00", ["t3-00-01-00"], "Customer Success Lead")],
      ambiguityFlags: [],
    }),
  ];
  return { meeting, items };
}

/* ------------------------------------------------------------------ */
/* Meeting 4 — Q4 Roadmap & Resource Allocation (needs review)         */
/* ------------------------------------------------------------------ */

function buildRoadmapMeeting(): { meeting: Meeting; items: ExecutionItem[] } {
  const id = "mtg-q4-roadmap";
  const turns: TranscriptTurn[] = [
    turn("t4-00-05-00", "00:05:00", "Yash", "Product Lead", "For Q4 we assumed 8 engineers on core platform."),
    turn("t4-00-12-30", "00:12:30", "Farah", "Eng Director", "Correction — after the reorg it's actually 6, not 8. We need to reprioritize the roadmap around that.", "pivot"),
    turn("t4-00-15-00", "00:15:00", "Yash", "Product Lead", "Understood. Decision changed: Q4 roadmap now assumes 6 core engineers, discard the 8-engineer plan."),
    turn("t4-00-20-00", "00:20:00", "Farah", "Eng Director", "Who owns re-forecasting the roadmap dates — is that PM or eng leads?"),
  ];
  const meeting: Meeting = {
    id,
    title: "Q4 Roadmap & Resource Allocation",
    team: "Strategy",
    recordedDate: "2026-09-03",
    durationMinutes: 75,
    transcriptRaw: turns.map((t) => `[${t.timestamp}] ${t.speaker}: ${t.text}`).join("\n"),
    transcriptTurns: turns,
    participants: [
      { name: "Yash", role: "Product Lead", turns: 2, initial: "Y" },
      { name: "Farah", role: "Eng Director", turns: 2, initial: "F" },
    ],
    status: "needs_review",
    createdAt: "2026-09-03T17:00:00.000Z",
  };
  const items: ExecutionItem[] = [
    item({
      id: "dec-q4-1",
      meetingId: id,
      code: "DEC-080",
      type: "decision",
      title: "Q4 roadmap now assumes 6 core engineers",
      priority: "High",
      status: "needs_review",
      evidence: [ev("Understood. Decision changed: Q4 roadmap now assumes 6 core engineers, discard the 8-engineer plan.", "Yash", "00:15:00", ["t4-00-15-00"], "Product Lead")],
      ambiguityFlags: [{ type: "status_unconfirmed", message: "Headcount assumption superseded mid-meeting — confirm before re-forecasting dates." }],
      supersedes: {
        previousTitle: "Q4 roadmap assumes 8 core engineers",
        previousQuote: "For Q4 we assumed 8 engineers on core platform.",
        previousTimestamp: "00:05:00",
        supersededAtTimestamp: "00:15:00",
      },
      adrTag: "#adr-13-q4-headcount",
    }),
    item({
      id: "que-q4-1",
      meetingId: id,
      code: "QUE-210",
      type: "question",
      title: "Who owns re-forecasting the roadmap dates — PM or eng leads?",
      priority: "Medium",
      status: "needs_review",
      evidence: [ev("Who owns re-forecasting the roadmap dates — is that PM or eng leads?", "Farah", "00:20:00", ["t4-00-20-00"], "Eng Director")],
      ambiguityFlags: [{ type: "needs_clarification", message: "Ownership of the re-forecasting task was not assigned in the meeting." }],
    }),
  ];
  return { meeting, items };
}

export function buildSeedData(): { meetings: Meeting[]; items: ExecutionItem[] } {
  const a = buildProductSyncMeeting();
  const b = buildSprintPlanningMeeting();
  const c = buildPostMortemMeeting();
  const d = buildRoadmapMeeting();
  return {
    meetings: [a.meeting, b.meeting, c.meeting, d.meeting],
    items: [...a.items, ...b.items, ...c.items, ...d.items],
  };
}
