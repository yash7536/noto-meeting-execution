// Server-only AI extraction layer.
//
// This module is a CANDIDATE GENERATOR, not an authority. It calls the
// Gemini API to propose execution items from a transcript, then puts every
// candidate through the same deterministic guardrails the rule-based
// engine (lib/extraction.ts) already enforces: every fact must be grounded
// in a verbatim, turn-ID-addressable transcript quote; owners and deadlines
// are cross-checked rather than trusted; ambiguity/conflict/supersession
// are (re)computed deterministically, never taken from the model. The
// model has no field in its output schema for status, id, ambiguity flags,
// conflict objects, or approval state — those don't exist in what it's
// allowed to return (see lib/ai/schema.ts).
//
// This file must never be imported from a "use client" component — it
// reads process.env.GEMINI_API_KEY and talks to the network. The only
// caller is app/api/analyze/route.ts.

import { ApiError, GoogleGenAI } from "@google/genai";
import {
  cleanTitle,
  DECISION_RE,
  DEFERRAL_RE,
  detectDeclarativeStance,
  extractDeadline,
  findDeferralSentence,
  isClearSelfCommitment,
  OPPOSING_STANCE,
  PREFERENCE_RE,
  splitSentences,
  SUPERSEDE_RE,
  topicWords,
  uid,
  type Sentence,
} from "../extraction";
import type {
  AmbiguityFlag,
  Conflict,
  ConflictPosition,
  Evidence,
  ExecutionItem,
  ItemType,
  Priority,
  ReviewState,
  TranscriptTurn,
} from "../types";
import { EXTRACTION_RESPONSE_SCHEMA, parseExtractionPayload, type RawCandidate } from "./schema";

const DEFAULT_MODEL = "gemini-3.6-flash";
const MAX_CANDIDATES = 40;
const MAX_OUTPUT_TOKENS = 8000;
const REQUEST_TIMEOUT_MS = 45_000;
const MAX_TITLE_LENGTH = 140;
const MAX_DESCRIPTION_LENGTH = 320;

export interface AIExtractionSuccess {
  ok: true;
  items: ExecutionItem[];
  candidatesReturned: number;
  candidatesAccepted: number;
}

export interface AIExtractionFailure {
  ok: false;
  reason: string;
}

export type AIExtractionResult = AIExtractionSuccess | AIExtractionFailure;

/* ------------------------------------------------------------------ */
/* Dev-only logging — counts and booleans only, never key/transcript    */
/* ------------------------------------------------------------------ */

function logAI(event: string, meta: Record<string, unknown> = {}) {
  if (process.env.NODE_ENV === "production") return;
  console.log(`[ai-extract] ${event}`, meta);
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return `${err.status ?? "?"}: ${err.message}`;
  if (err instanceof Error) return err.message;
  return String(err);
}

/* ------------------------------------------------------------------ */
/* Prompt construction                                                  */
/* ------------------------------------------------------------------ */

const SYSTEM_PROMPT = `You are a strict information-extraction engine for a meeting-execution product. You are NOT a summarizer — your job is to find concrete decisions, action items, open questions, and risks/blockers in a messy meeting transcript, each grounded in an exact quote.

Rules you must follow exactly:
- Every item must include at least one evidence entry citing a turn_id from the provided list and a verbatim quote — an exact substring of that turn's text, never a paraphrase or summary.
- Never invent an owner. Only include a name in owner_mentions when it is explicitly stated as responsible for that specific item; otherwise leave owner_mentions empty. Do not guess based on role or seniority. If multiple people are raised as possible owners and the meeting does not confirm a single one, list every one of them in owner_mentions — do not pick the one you think is most likely.
- Never invent a deadline. Only set deadline_phrase to the exact words used (e.g. "Friday", "tomorrow", "next week", "September 15"). Never resolve relative language into a calendar date yourself. Use null if no deadline was mentioned.
- Never invent a decision. Only extract "decision" items for things the transcript shows were actually settled — not proposals, not things merely discussed, not things one person suggested without agreement. A preference, suggestion, or leaning ("I'd prefer X", "I think we should X", "maybe X") is NOT a decision, even if nobody objects to it. If the transcript explicitly defers the choice ("let's decide after legal signs off", "let's test both before deciding"), the choice is unresolved — extract that as an open_question, never as a decision for whichever option was mentioned most recently.
- Distinguish ordinary discussion from an actual commitment. Do not extract an action item for vague discussion that never became a concrete ask.
- If two or more people express opposing positions on the same topic (e.g. one says a setting should be on by default, another says off by default), prefer extracting each position as its own separate item. If you do summarize them into one item instead, you must cite evidence from BOTH sides' turns, not just one — never cite only the side you think won. Either way, never silently pick a side, never imply the disagreement was resolved, and never present it as a settled decision.
- You do not set status, approval state, or a numeric confidence score — those are not fields you can produce. priority_hint is a soft, optional signal only.
- Respond only with JSON matching the provided response schema. Do not include any prose outside the JSON.`;

function buildTranscriptBlock(turns: TranscriptTurn[]): string {
  return turns
    .map((t) => `[${t.id}] ${t.speaker}${t.speakerRole ? ` (${t.speakerRole})` : ""} @ ${t.timestamp}: ${t.text}`)
    .join("\n");
}

function buildUserPrompt(turns: TranscriptTurn[]): string {
  return [
    "Here is a meeting transcript, parsed into turns. Each line starts with the turn's ID in brackets — cite that exact ID in your evidence.",
    "",
    buildTranscriptBlock(turns),
    "",
    "Extract every decision, action item, open question, and risk/blocker that is clearly supported by the transcript above.",
  ].join("\n");
}

/* ------------------------------------------------------------------ */
/* Evidence verification                                                */
/* ------------------------------------------------------------------ */

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/** Deterministically verifies each cited (turn_id, quote) pair against the
 * real transcript turns — this is the guard against hallucinated evidence.
 * A turn_id that doesn't exist, or a quote that isn't actually a substring
 * of that turn's real text, is dropped rather than trusted. */
function verifyEvidence(
  evidence: { turn_id: string; quote: string }[],
  turnsById: Map<string, TranscriptTurn>
): { verified: Evidence[]; droppedCount: number } {
  const verified: Evidence[] = [];
  let droppedCount = 0;
  for (const e of evidence) {
    const turn = turnsById.get(e.turn_id);
    const normQuote = normalize(e.quote);
    if (!turn || !normQuote || !normalize(turn.text).includes(normQuote)) {
      droppedCount += 1;
      continue;
    }
    verified.push({
      quote: e.quote,
      speaker: turn.speaker,
      speakerRole: turn.speakerRole,
      timestamp: turn.timestamp,
      turnIds: [turn.id],
    });
  }
  return { verified, droppedCount };
}

/* ------------------------------------------------------------------ */
/* Owner / deadline resolution (reuses the deterministic rules)         */
/* ------------------------------------------------------------------ */

/** Owner resolution precedence (Fix 2 + Fix 3):
 *   1. Exactly one AI-proposed owner mention, grounded in the verified
 *      evidence and matching a known speaker -> resolved cleanly.
 *   2. Two or more grounded mentions -> never choose one; preserve every
 *      candidate name and flag for human review (Fix 2).
 *   3. Zero mentions at all, but the evidence is a single-speaker, clearly
 *      first-person action commitment ("I'll ship the fix Wednesday") ->
 *      attribute ownership to that speaker via transcript attribution, not
 *      a name match (Fix 3). Never applied when the AI *did* propose a
 *      mention that simply failed to ground — that's still surfaced as an
 *      unverified-mention warning (existing behavior), since a name
 *      Gemini saw but couldn't ground is a stronger signal something is
 *      off than plain silence.
 *   4. Otherwise -> existing "no explicit owner stated" ambiguity flag. */
export function resolveOwner(
  ownerMentions: string[],
  evidenceText: string,
  speakers: string[],
  evidenceSpeakers: string[],
  itemType: ItemType
): { owner?: string; ownerCandidates?: string[]; flags: AmbiguityFlag[] } {
  const mentions = dedupeCaseInsensitive(ownerMentions.filter((m) => m && m.trim().length > 0));

  if (mentions.length === 0) {
    // Fix 3: first-person self-commitment attribution. Restricted to a
    // single cited speaker (never guess between multiple people quoted in
    // the same item) and to actions (matches the deterministic engine's
    // own ACTION_SELF_RE scope, and the product's own worked examples).
    if (itemType === "action" && evidenceSpeakers.length === 1 && isClearSelfCommitment(evidenceText)) {
      return { owner: evidenceSpeakers[0], flags: [] };
    }
    return { flags: [{ type: "owner_unclear", message: "No explicit owner stated for this commitment." }] };
  }

  // Grounding check applies to every proposed mention — never trust a name
  // Gemini produced that doesn't actually appear in the verified evidence,
  // whether there's one name or several ("Do not infer an owner merely
  // because a person appears somewhere unrelated in the transcript.").
  const grounded = mentions.filter((m) => normalize(evidenceText).includes(normalize(m)));

  if (grounded.length === 0) {
    // Fix 3 refinement: an ungrounded mention isn't automatically discarded
    // if it independently agrees with who actually said the cited evidence
    // — e.g. Gemini proposes "Devraj" for a candidate whose only evidence
    // is Devraj's own "we start execution Monday" turn, which never states
    // his name and isn't first-person-singular phrasing either, so the
    // stricter isClearSelfCommitment check alone wouldn't attribute it.
    // Two independent signals agreeing (the model's own guess, and "there
    // is exactly one speaker behind this item's evidence and it's the same
    // person") is still a safe enough basis to resolve cleanly on an
    // action item; a mismatch between the two still falls through to the
    // existing unverified-mention warning below.
    if (
      mentions.length === 1 &&
      itemType === "action" &&
      evidenceSpeakers.length === 1 &&
      evidenceSpeakers[0].split(" ")[0].toLowerCase() === mentions[0].split(" ")[0].toLowerCase()
    ) {
      return { owner: evidenceSpeakers[0], flags: [] };
    }
    return {
      ownerCandidates: mentions,
      flags: [
        {
          type: "owner_unclear",
          message: `AI-identified owner${mentions.length > 1 ? "s" : ""} (${mentions.join(", ")}) do${
            mentions.length > 1 ? "" : "es"
          } not appear in the verified evidence — needs manual confirmation.`,
        },
      ],
    };
  }

  if (grounded.length >= 2) {
    // Fix 2: multiple grounded candidates — preserve all of them, pick none.
    return {
      ownerCandidates: grounded,
      flags: [
        {
          type: "owner_unclear",
          message: `Multiple candidate owners mentioned and none confirmed: ${grounded.join(", ")}.`,
        },
      ],
    };
  }

  const mention = grounded[0];
  const mentionFirst = mention.split(" ")[0].toLowerCase();
  const matchedSpeaker = speakers.find(
    (s) => s.split(" ")[0].toLowerCase() === mentionFirst || s.toLowerCase() === mention.toLowerCase()
  );
  if (matchedSpeaker) {
    return { owner: matchedSpeaker, flags: [] };
  }
  return {
    ownerCandidates: [mention],
    flags: [
      {
        type: "owner_unclear",
        message: `Owner ("${mention}") is mentioned in the evidence but could not be cross-verified against known meeting participants.`,
      },
    ],
  };
}

function dedupeCaseInsensitive(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of names) {
    const key = n.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(n.trim());
  }
  return out;
}

function resolveDeadline(
  deadlinePhrase: string | null,
  evidenceText: string
): { deadline?: string; deadlineConfirmed: boolean; flags: AmbiguityFlag[] } {
  if (!deadlinePhrase) {
    return {
      deadlineConfirmed: false,
      flags: [{ type: "deadline_unclear", message: "No explicit deadline stated in the transcript for this item." }],
    };
  }

  if (!normalize(evidenceText).includes(normalize(deadlinePhrase))) {
    return {
      deadlineConfirmed: false,
      flags: [
        {
          type: "deadline_unclear",
          message: `AI-stated deadline ("${deadlinePhrase}") could not be verified against the cited evidence.`,
        },
      ],
    };
  }

  // Same classifier the deterministic engine uses (Fix 3): distinguishes an
  // absolute date, a relative-but-stated one, and a genuinely vague one —
  // never resolves a relative phrase into a fabricated calendar date.
  const classified = extractDeadline(deadlinePhrase);
  if (!classified) {
    return {
      deadline: deadlinePhrase,
      deadlineConfirmed: false,
      flags: [{ type: "deadline_unclear", message: `Deadline is vague ("${deadlinePhrase}") — needs a concrete date.` }],
    };
  }
  if (classified.relative) {
    return {
      deadline: classified.text,
      deadlineConfirmed: false,
      flags: [
        {
          type: "deadline_unclear",
          message: `Relative deadline ("${classified.text}") — exact date depends on the meeting date.`,
        },
      ],
    };
  }
  if (!classified.confirmed) {
    return {
      deadline: classified.text,
      deadlineConfirmed: false,
      flags: [{ type: "deadline_unclear", message: `Deadline is vague ("${classified.text}") — needs a concrete date.` }],
    };
  }
  return { deadline: classified.text, deadlineConfirmed: true, flags: [] };
}

function resolvePriority(hint: RawCandidate["priority_hint"], hasAmbiguity: boolean, type: ItemType): Priority {
  if (type === "risk") return "High";
  if (hasAmbiguity) return "High";
  if (hint === "low") return "Low";
  if (hint === "high") return "High";
  return "Medium";
}

function truncate(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + "…";
}

/* ------------------------------------------------------------------ */
/* Candidate -> ExecutionItem                                          */
/* ------------------------------------------------------------------ */

export function createCodeGenerator() {
  // Offset from the deterministic engine's own per-call counters (which
  // start at 9020/40/107/18) purely so codes are visually distinguishable
  // if the two paths are ever compared side by side — not a functional
  // requirement, since only one path runs per analyze call.
  let actionN = 9500;
  let decisionN = 80;
  let questionN = 160;
  let riskN = 40;
  return function next(type: ItemType): string {
    switch (type) {
      case "action":
        return `ACT-${++actionN}`;
      case "decision":
        return `DEC-${String(++decisionN).padStart(3, "0")}`;
      case "question":
        return `QUE-${++questionN}`;
      case "risk":
        return `RSK-${String(++riskN).padStart(3, "0")}`;
    }
  };
}

export function buildItemFromCandidate(
  raw: RawCandidate,
  turnsById: Map<string, TranscriptTurn>,
  speakers: string[],
  meetingId: string,
  nextCode: (type: ItemType) => string
): ExecutionItem | null {
  const { verified, droppedCount } = verifyEvidence(raw.evidence, turnsById);
  if (verified.length === 0) return null; // no grounded evidence at all — discard entirely, never enters review

  const evidenceText = verified.map((e) => e.quote).join(" ");
  const ambiguityFlags: AmbiguityFlag[] = [];

  let owner: string | undefined;
  let ownerCandidates: string[] | undefined;
  let deadline: string | undefined;
  let deadlineConfirmed = false;
  const description = raw.description ? truncate(raw.description, MAX_DESCRIPTION_LENGTH) : undefined;

  if (raw.type === "action" || raw.type === "risk") {
    const evidenceSpeakers = Array.from(new Set(verified.map((e) => e.speaker)));
    const ownerResult = resolveOwner(raw.owner_mentions, evidenceText, speakers, evidenceSpeakers, raw.type);
    owner = ownerResult.owner;
    ownerCandidates = ownerResult.ownerCandidates;
    ambiguityFlags.push(...ownerResult.flags);
  }

  if (raw.type === "action") {
    const deadlineResult = resolveDeadline(raw.deadline_phrase, evidenceText);
    deadline = deadlineResult.deadline;
    deadlineConfirmed = deadlineResult.deadlineConfirmed;
    ambiguityFlags.push(...deadlineResult.flags);
  }

  if (droppedCount > 0) {
    ambiguityFlags.push({
      type: "evidence_needs_review",
      message: `${droppedCount} cited quote(s) could not be verified against the transcript and were removed from this item's evidence.`,
    });
  }

  const now = new Date().toISOString();
  const status: ReviewState = ambiguityFlags.length > 0 ? "needs_review" : "extracted";

  return {
    id: uid(raw.type),
    meetingId,
    code: nextCode(raw.type),
    type: raw.type,
    title: truncate(raw.title, MAX_TITLE_LENGTH),
    description,
    owner,
    ownerCandidates,
    deadline,
    deadlineConfirmed,
    priority: resolvePriority(raw.priority_hint, ambiguityFlags.length > 0, raw.type),
    status,
    evidence: verified,
    ambiguityFlags,
    targetJira: raw.type === "action",
    targetEmail: true,
    targetNotion: true,
    createdAt: now,
    updatedAt: now,
  };
}

/* ------------------------------------------------------------------ */
/* Dedup                                                                */
/* ------------------------------------------------------------------ */

/** Drops obvious duplicates: same type, same underlying transcript turn(s),
 * and a near-identical title. Keeps the first occurrence. */
export function dedupeItems(items: ExecutionItem[]): ExecutionItem[] {
  const seen: { type: ItemType; turnKey: string; titleNorm: string }[] = [];
  const out: ExecutionItem[] = [];
  for (const item of items) {
    const turnKey = item.evidence
      .flatMap((e) => e.turnIds)
      .sort()
      .join(",");
    const titleNorm = item.title.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
    const isDup = seen.some(
      (s) =>
        s.type === item.type &&
        s.turnKey === turnKey &&
        (s.titleNorm === titleNorm || s.titleNorm.includes(titleNorm) || titleNorm.includes(s.titleNorm))
    );
    if (isDup) continue;
    seen.push({ type: item.type, turnKey, titleNorm });
    out.push(item);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Conflict + supersession (reuses the deterministic engine's rules)   */
/* ------------------------------------------------------------------ */

/** Fix 4: scans the raw transcript (not just Gemini's own candidates) for
 * the sentence that most plausibly states the ORIGINAL decision a later,
 * reversing decision (`current`) supersedes — used only when the
 * candidate-pairwise pass below found no matching earlier decision among
 * what Gemini actually returned (i.e. Gemini never proposed the original
 * as its own candidate at all). Requires: a genuine decision-sounding
 * sentence (DECISION_RE), not itself a reversal (SUPERSEDE_RE), occurring
 * strictly before `current`'s own evidence turn, sharing at least one real
 * topic word, and not already cited as evidence by some other item (never
 * duplicate a decision Gemini did extract, just under a different type).
 * Entirely deterministic — Gemini's own interpretation is never consulted. */
function findOriginalDecisionSentence(
  turns: TranscriptTurn[],
  items: ExecutionItem[],
  current: ExecutionItem,
  currentTopics: Set<string>
): Sentence | null {
  const currentTurnId = current.evidence[0]?.turnIds[0];
  const currentIndex = currentTurnId ? turns.findIndex((t) => t.id === currentTurnId) : -1;
  if (currentIndex <= 0) return null;

  const alreadyCited = new Set(items.flatMap((it) => it.evidence.flatMap((e) => e.turnIds)));
  const sentences = splitSentences(turns.slice(0, currentIndex));
  let best: Sentence | null = null;
  let bestScore = 0;
  for (const s of sentences) {
    if (alreadyCited.has(s.turn.id)) continue;
    if (!DECISION_RE.test(s.text)) continue;
    if (SUPERSEDE_RE.test(s.text)) continue; // want the original, not another reversal
    const topics = topicWords(s.text);
    let score = 0;
    for (const w of currentTopics) if (topics.has(w)) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return best;
}

/** Applies the exact same rules lib/extraction.ts uses for decision
 * supersession and declarative conflicts, but over the validated candidate
 * set — extended with two transcript-level fallbacks (Fix 1, Fix 4) for
 * the case the Gemini-path evaluation actually found: Gemini frequently
 * does NOT emit the two sides of a disagreement, or the original half of a
 * reversed decision, as separate candidates the way this pairing logic
 * needs. Both fallbacks independently re-inspect the real transcript
 * sentences (same curated vocabulary, same topic-overlap conservatism) —
 * Gemini is never treated as the authority that something is resolved.
 * The model's own `related_to` hint is still never used to construct
 * these objects — it's advisory only. */
export function applyConflictAndSupersession(
  items: ExecutionItem[],
  turns: TranscriptTurn[],
  meetingId: string,
  nextCode: (type: ItemType) => string
): void {
  const conflictClaimedTurns = new Set<string>(); // `${speaker}@${timestamp}`

  const decisions = items.filter((i) => i.type === "decision");
  // Starts at i=0 (not 1): when Gemini returns only the FINAL decision and
  // never proposes the original as its own candidate at all — exactly the
  // T16 gap this fix targets — decisions.length is 1, and a loop starting
  // at i=1 would never run at all. Starting at 0 makes j<i naturally a
  // no-op when there are no earlier candidates, falling straight through
  // to the transcript-level fallback below.
  for (let i = 0; i < decisions.length; i++) {
    const current = decisions[i];
    const text = current.evidence.map((e) => e.quote).join(" ");
    if (!SUPERSEDE_RE.test(text)) continue;

    const topics = topicWords(text);
    let best: ExecutionItem | null = null;
    let bestScore = 0;
    for (let j = 0; j < i; j++) {
      const earlier = decisions[j];
      if (earlier.supersedes) continue; // don't chain through an already-superseded one
      const earlierText = earlier.evidence.map((e) => e.quote).join(" ");
      const earlierTopics = topicWords(earlierText);
      let score = 0;
      for (const w of topics) if (earlierTopics.has(w)) score += 1;
      if (score > bestScore) {
        bestScore = score;
        best = earlier;
      }
    }

    if (best) {
      current.supersedes = {
        previousTitle: best.title,
        previousQuote: best.evidence[0]?.quote ?? "",
        previousTimestamp: best.evidence[0]?.timestamp ?? "",
        supersededAtTimestamp: current.evidence[0]?.timestamp ?? "",
      };
      best.supersededBy = {
        title: current.title,
        quote: current.evidence[0]?.quote ?? "",
        timestamp: current.evidence[0]?.timestamp ?? "",
      };
      continue;
    }

    // Fix 4 fallback: Gemini never proposed the original decision as a
    // candidate at all. Recover it deterministically from the transcript
    // rather than letting the reversal disappear silently.
    const original = findOriginalDecisionSentence(turns, items, current, topics);
    if (!original) continue;

    const now = new Date().toISOString();
    const evidence: Evidence = {
      quote: original.text.replace(/\s+/g, " ").trim(),
      speaker: original.turn.speaker,
      speakerRole: original.turn.speakerRole,
      timestamp: original.turn.timestamp,
      turnIds: [original.turn.id],
    };
    const synthesized: ExecutionItem = {
      id: uid("decision"),
      meetingId,
      code: nextCode("decision"),
      type: "decision",
      title: cleanTitle(original.text),
      status: "extracted",
      evidence: [evidence],
      ambiguityFlags: [],
      supersededBy: { title: current.title, quote: current.evidence[0]?.quote ?? "", timestamp: current.evidence[0]?.timestamp ?? "" },
      targetJira: false,
      targetEmail: true,
      targetNotion: true,
      createdAt: now,
      updatedAt: now,
    };
    current.supersedes = {
      previousTitle: synthesized.title,
      previousQuote: evidence.quote,
      previousTimestamp: evidence.timestamp,
      supersededAtTimestamp: current.evidence[0]?.timestamp ?? "",
    };
    items.push(synthesized);
    decisions.push(synthesized);
  }

  // ---- Declarative conflict pairing over the accepted candidate items ----
  for (let i = 0; i < items.length; i++) {
    const a = items[i];
    if (a.conflict) continue;
    const textA = a.evidence.map((e) => e.quote).join(" ");
    const stanceA = detectDeclarativeStance(textA);
    if (!stanceA) continue;
    const topicsA = topicWords(textA);

    for (let j = i + 1; j < items.length; j++) {
      const b = items[j];
      if (b.conflict) continue;
      if (b.evidence[0]?.speaker === a.evidence[0]?.speaker) continue;
      const textB = b.evidence.map((e) => e.quote).join(" ");
      const stanceB = detectDeclarativeStance(textB);
      if (!stanceB || OPPOSING_STANCE.get(stanceA) !== stanceB) continue;

      const topicsB = topicWords(textB);
      const shared = [...topicsA].filter((w) => topicsB.has(w));
      if (shared.length === 0) continue; // not clearly the same topic — stay conservative

      const topicLabel = shared[0];
      const positions: ConflictPosition[] = [
        { speaker: a.evidence[0].speaker, quote: a.evidence[0].quote, timestamp: a.evidence[0].timestamp, stance: stanceA },
        { speaker: b.evidence[0].speaker, quote: b.evidence[0].quote, timestamp: b.evidence[0].timestamp, stance: stanceB },
      ];
      const conflict: Conflict = {
        id: uid("conflict"),
        summary: `Conflicting positions on ${topicLabel}`,
        positions,
        resolved: false,
      };

      // The deterministic engine always models a conflict on a "question"
      // item; mirror that when one of the pair is a question, otherwise
      // attach it to whichever candidate was extracted first.
      const target = a.type === "question" ? a : b.type === "question" ? b : a;
      target.conflict = conflict;
      target.ambiguityFlags = [
        ...target.ambiguityFlags.filter((f) => f.type !== "needs_clarification"),
        {
          type: "conflicting_statements",
          message: `${a.evidence[0].speaker} and ${b.evidence[0].speaker} expressed opposing positions on ${topicLabel} (${stanceA} vs. ${stanceB}) — not resolved in the transcript.`,
        },
      ];
      target.status = "needs_review";
      conflictClaimedTurns.add(`${a.evidence[0].speaker}@${a.evidence[0].timestamp}`);
      conflictClaimedTurns.add(`${b.evidence[0].speaker}@${b.evidence[0].timestamp}`);
      break;
    }
  }

  // ---- Fix 1 fallback: transcript-level conflict scan ----
  // The evaluation found Gemini reliably collapses opposing statements
  // into ONE summarizing candidate rather than the two separate items the
  // pairing pass above needs. Independently re-scan the actual transcript
  // sentences for opposing declarative positions (same curated vocabulary,
  // same conservatism) and, when found, attach a Conflict object to
  // whichever existing candidate item already cites one of those two
  // turns as evidence. Never fabricate a new item for this — if nothing
  // Gemini produced touches either turn, there's nothing to mark Needs
  // Review, so it's skipped rather than invented. Turns already claimed by
  // the pairwise pass above are skipped so a conflict already caught there
  // is never duplicated here.
  //
  // "Approach A" / "Approach B" is excluded from this transcript-wide scan
  // specifically (still available to the narrower item-pairwise pass
  // above): unlike the other pairs, it's a neutral option LABEL rather
  // than an inherent position, so a single speaker merely listing two
  // options ("Option A is Redis, Option B is in-memory...") before the
  // group picks one is a normal decision process, not a disagreement — the
  // evaluation surfaced exactly this false positive on T01.
  const TRANSCRIPT_SCAN_EXCLUDED_LABELS = new Set(["Approach A", "Approach B"]);
  const sentences = splitSentences(turns);
  for (let i = 0; i < sentences.length; i++) {
    const a = sentences[i];
    const keyA = `${a.turn.speaker}@${a.turn.timestamp}`;
    if (conflictClaimedTurns.has(keyA)) continue;
    const stanceA = detectDeclarativeStance(a.text);
    if (!stanceA || TRANSCRIPT_SCAN_EXCLUDED_LABELS.has(stanceA)) continue;
    const topicsA = topicWords(a.text);

    for (let j = i + 1; j < Math.min(sentences.length, i + 6); j++) {
      const b = sentences[j];
      if (b.turn.speaker === a.turn.speaker) continue;
      const keyB = `${b.turn.speaker}@${b.turn.timestamp}`;
      if (conflictClaimedTurns.has(keyB)) continue;
      const stanceB = detectDeclarativeStance(b.text);
      if (!stanceB || TRANSCRIPT_SCAN_EXCLUDED_LABELS.has(stanceB) || OPPOSING_STANCE.get(stanceA) !== stanceB) continue;

      const topicsB = topicWords(b.text);
      const shared = [...topicsA].filter((w) => topicsB.has(w));
      if (shared.length === 0) continue;

      const target = items.find(
        (it) => !it.conflict && it.evidence.some((e) => e.turnIds.includes(a.turn.id) || e.turnIds.includes(b.turn.id))
      );
      if (!target) continue; // nothing Gemini produced touches this exchange — don't invent an item

      const topicLabel = shared[0];
      target.conflict = {
        id: uid("conflict"),
        summary: `Conflicting positions on ${topicLabel}`,
        positions: [
          { speaker: a.turn.speaker, quote: a.text.replace(/\s+/g, " ").trim(), timestamp: a.turn.timestamp, stance: stanceA },
          { speaker: b.turn.speaker, quote: b.text.replace(/\s+/g, " ").trim(), timestamp: b.turn.timestamp, stance: stanceB },
        ],
        resolved: false,
      };
      target.ambiguityFlags = [
        ...target.ambiguityFlags.filter((f) => f.type !== "needs_clarification"),
        {
          type: "conflicting_statements",
          message: `${a.turn.speaker} and ${b.turn.speaker} expressed opposing positions on ${topicLabel} (${stanceA} vs. ${stanceB}) — not resolved in the transcript. Recovered from the transcript directly; the AI candidate summarized both sides into one item.`,
        },
      ];
      target.status = "needs_review";
      conflictClaimedTurns.add(keyA);
      conflictClaimedTurns.add(keyB);
      break;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Preference-vs-decision validation                                    */
/* ------------------------------------------------------------------ */

/** Gemini can occasionally propose a `decision` candidate for an option
 * that was only ever discussed as a preference, suggestion, or tentative
 * leaning — especially when several people state competing preferences
 * and the transcript explicitly defers the actual choice ("let's test
 * both before deciding", "let's decide after legal signs off"). There was
 * previously no deterministic check that a "decision"-typed candidate
 * actually contains decisive language at all — owner/deadline get
 * cross-checked against evidence, but a decision's TYPE itself was
 * trusted outright. This closes that gap independently of the prompt
 * (never rely on the model alone to police itself).
 *
 * Two independent checks, either one demotes the candidate to an open
 * `question` instead:
 *   Rule A (intra-evidence): the candidate's OWN cited evidence either
 *     (a) contains explicit deferral language (DEFERRAL_RE) — an absolute
 *     override regardless of anything else in the evidence, or (b) reads
 *     as tentative (PREFERENCE_RE) with no decisive language (DECISION_RE)
 *     anywhere in it. A later decisive statement in the SAME evidence
 *     (e.g. "I prefer X... okay, we've decided on X") overrides an
 *     earlier preference rather than being downgraded — a genuine
 *     decision is never demoted merely because discussion preceded it.
 *   Rule B (transcript-wide, defense-in-depth): independently scans the
 *     full transcript for a deferral sentence sharing a real topic word
 *     with the decision's evidence — catches cases where Gemini's own
 *     cited evidence looks clean but the group explicitly deferred
 *     elsewhere. When it fires, the deferral sentence is preserved as
 *     additional evidence on the demoted item rather than discarded.
 *
 * Decisions already linked into a confirmed supersession (either side)
 * are skipped — those have already been established as real decision
 * history and are not second-guessed here. Must run AFTER
 * applyConflictAndSupersession so that linkage already exists. */
export function demoteUnresolvedDecisions(
  items: ExecutionItem[],
  turns: TranscriptTurn[],
  nextCode: (type: ItemType) => string
): void {
  for (const item of items) {
    if (item.type !== "decision") continue;
    if (item.supersedes || item.supersededBy) continue;

    const evidenceText = item.evidence.map((e) => e.quote).join(" ");
    const explicitDeferral = DEFERRAL_RE.test(evidenceText);
    const tentativeOnly = PREFERENCE_RE.test(evidenceText) && !DECISION_RE.test(evidenceText);

    let reason: string | null = null;
    let extraSentence: Sentence | null = null;

    if (explicitDeferral) {
      reason =
        'The cited evidence itself contains explicit decision-deferral language (e.g. "before deciding", "pending approval", "after ... signs off") — this reads as unresolved, not a finalized decision.';
    } else if (tentativeOnly) {
      reason =
        'The cited evidence reads as a preference, suggestion, or tentative leaning (e.g. "I\'d prefer", "I think we should", "maybe") with no decisive language anywhere in it — not a finalized decision.';
    } else {
      const topics = topicWords(evidenceText);
      const excludeIds = new Set(item.evidence.flatMap((e) => e.turnIds));
      const deferral = findDeferralSentence(turns, topics, excludeIds);
      if (deferral) {
        extraSentence = deferral;
        reason = `The transcript explicitly defers this decision elsewhere ("${deferral.text
          .replace(/\s+/g, " ")
          .trim()}") — treating it as unresolved rather than finalized.`;
      }
    }

    if (!reason) continue;

    if (extraSentence) {
      item.evidence = [
        ...item.evidence,
        {
          quote: extraSentence.text.replace(/\s+/g, " ").trim(),
          speaker: extraSentence.turn.speaker,
          speakerRole: extraSentence.turn.speakerRole,
          timestamp: extraSentence.turn.timestamp,
          turnIds: [extraSentence.turn.id],
        },
      ];
    }

    item.type = "question";
    item.code = nextCode("question");
    item.status = "needs_review";
    item.ambiguityFlags = [
      ...item.ambiguityFlags.filter((f) => f.type !== "needs_clarification"),
      { type: "needs_clarification", message: reason },
    ];
    item.updatedAt = new Date().toISOString();
    delete item.adrTag;
    item.targetJira = false;
  }
}

/* ------------------------------------------------------------------ */
/* Orchestration                                                        */
/* ------------------------------------------------------------------ */

export async function extractWithAI(turns: TranscriptTurn[], meetingId: string): Promise<AIExtractionResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, reason: "GEMINI_API_KEY is not configured." };
  }
  if (turns.length === 0) {
    return { ok: false, reason: "No transcript turns to analyze." };
  }

  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;

  let client: GoogleGenAI;
  try {
    client = new GoogleGenAI({ apiKey });
  } catch (err) {
    logAI("client_init_failed", { meetingId });
    return { ok: false, reason: `Gemini client init failed: ${errorMessage(err)}` };
  }

  let response;
  try {
    response = await client.models.generateContent({
      model,
      contents: buildUserPrompt(turns),
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: EXTRACTION_RESPONSE_SCHEMA,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        httpOptions: { timeout: REQUEST_TIMEOUT_MS },
      },
    });
  } catch (err) {
    logAI("api_call_failed", { meetingId, model });
    return { ok: false, reason: `Gemini API call failed: ${errorMessage(err)}` };
  }

  let payload: unknown;
  try {
    const text = response.text;
    if (!text) throw new Error("empty response text");
    payload = JSON.parse(text);
  } catch (err) {
    logAI("malformed_response", { meetingId, reason: errorMessage(err) });
    return { ok: false, reason: "Model did not return parseable structured output." };
  }

  const rawCandidates = parseExtractionPayload(payload, MAX_CANDIDATES);
  if (rawCandidates.length === 0) {
    logAI("empty_candidates", { meetingId });
    return { ok: false, reason: "Model returned no usable candidates." };
  }

  const turnsById = new Map(turns.map((t) => [t.id, t] as const));
  const speakers = Array.from(new Set(turns.map((t) => t.speaker)));
  const nextCode = createCodeGenerator();

  const items: ExecutionItem[] = [];
  for (const raw of rawCandidates) {
    const built = buildItemFromCandidate(raw, turnsById, speakers, meetingId, nextCode);
    if (built) items.push(built);
  }

  if (items.length === 0) {
    logAI("all_candidates_rejected", { meetingId, candidatesReturned: rawCandidates.length });
    return { ok: false, reason: "No candidate had verifiable evidence against the transcript." };
  }

  const deduped = dedupeItems(items);
  applyConflictAndSupersession(deduped, turns, meetingId, nextCode);
  demoteUnresolvedDecisions(deduped, turns, nextCode);

  logAI("extraction_succeeded", {
    meetingId,
    model,
    candidatesReturned: rawCandidates.length,
    candidatesAccepted: deduped.length,
  });

  return {
    ok: true,
    items: deduped,
    candidatesReturned: rawCandidates.length,
    candidatesAccepted: deduped.length,
  };
}
