// Core data model for Noto.
// A unified ExecutionItem represents Decisions, Action Items, Open Questions
// and Risks/Blockers — distinguished by `type` — so review, evidence,
// ambiguity, conflict and approval logic can be shared across all of them.

export type ItemType = "action" | "decision" | "question" | "risk";

/** Lifecycle of an extracted item. AI output starts at `extracted` or
 * `needs_review` and can only reach `approved` through human action. */
export type ReviewState =
  | "extracted" // AI extracted, no flags — still not authoritative
  | "needs_review" // AI extracted, has ambiguity/conflict flags
  | "edited" // human modified a field
  | "approved" // human approved — authoritative
  | "rejected"; // human rejected — excluded from plan/email/export

export type Priority = "Low" | "Medium" | "High" | "Urgent";

export interface Evidence {
  quote: string;
  speaker: string;
  speakerRole?: string;
  timestamp: string; // "00:16:02" or a "00:16:30 - 00:16:42" range
  turnIds: string[]; // transcript turn ids this evidence anchors to
}

export type AmbiguityFlagType =
  | "owner_unclear"
  | "deadline_unclear"
  | "status_unconfirmed"
  | "conflicting_statements"
  | "evidence_needs_review"
  | "needs_clarification";

export interface AmbiguityFlag {
  type: AmbiguityFlagType;
  message: string;
}

export interface ConflictPosition {
  speaker: string;
  quote: string;
  timestamp: string;
  stance: string;
}

export interface Conflict {
  id: string;
  summary: string;
  positions: ConflictPosition[];
  resolved: boolean;
  resolutionLabel?: string;
  resolutionNote?: string;
  resolvedBy?: string;
  resolvedAt?: string;
}

export interface SupersededDecision {
  previousTitle: string;
  previousQuote: string;
  previousTimestamp: string;
  supersededAtTimestamp: string;
  reason?: string;
}

/** The reverse pointer of SupersededDecision — set on the OLDER decision so
 * it remains self-descriptive in the record on its own (Fix 4): without
 * this, an old decision that got reversed carried no signal of that at all
 * unless a viewer also found the newer item's `supersedes` link. */
export interface SupersedingDecision {
  title: string;
  quote: string;
  timestamp: string;
}

export interface ExecutionItem {
  id: string;
  meetingId: string;
  code: string; // e.g. ACT-9021, DEC-041, QUE-108, RSK-019
  type: ItemType;
  title: string;
  description?: string;
  owner?: string;
  ownerCandidates?: string[];
  deadline?: string;
  deadlineConfirmed?: boolean;
  priority?: Priority;
  status: ReviewState;
  evidence: Evidence[];
  ambiguityFlags: AmbiguityFlag[];
  conflict?: Conflict;
  supersedes?: SupersededDecision;
  supersededBy?: SupersedingDecision;
  targetJira?: boolean;
  targetEmail?: boolean;
  targetNotion?: boolean;
  jiraKey?: string;
  linearKey?: string;
  adrTag?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TranscriptTurn {
  id: string; // "t-00-16-02"
  timestamp: string; // "00:16:02"
  speaker: string;
  speakerRole?: string;
  text: string;
  tag?: "ambiguous" | "superseded" | "pivot" | "blocker" | "normal";
}

export type MeetingStatus =
  | "processing"
  | "needs_review"
  | "reviewed_synced"
  | "approved";

export interface Participant {
  name: string;
  role?: string;
  turns: number;
  initial: string;
}

export interface Meeting {
  id: string;
  title: string;
  team: string;
  recordedDate: string; // ISO date
  durationMinutes: number;
  transcriptRaw: string;
  transcriptTurns: TranscriptTurn[];
  participants: Participant[];
  status: MeetingStatus;
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
  followUp?: FollowUpConfig;
}

export interface FollowUpConfig {
  subject: string;
  to: string;
  toLabel: string;
  from: string;
  fromRole: string;
  includeDecisions: boolean;
  includeActions: boolean;
  includeQuestions: boolean;
  includeRisks: boolean;
  tone: "executive" | "technical" | "casual";
  bodyOverride?: string;
}

export interface AnalyzeResult {
  meeting: Meeting;
  items: ExecutionItem[];
}
