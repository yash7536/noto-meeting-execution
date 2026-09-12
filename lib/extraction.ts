// Deterministic extraction + validation engine.
//
// This intentionally does NOT call an LLM. It mirrors the "C3 — Evidence +
// Guardrails" pipeline direction from the product's evaluation experiment:
// every candidate item must be grounded in a verbatim transcript quote, and
// anything the rules cannot confirm (owner, deadline, status, a conflicting
// statement) is surfaced as an explicit flag for human review rather than
// silently resolved or invented. Nothing here is presented to the end user
// as ground truth until a human approves it.

import type {
  AmbiguityFlag,
  Conflict,
  ConflictPosition,
  Evidence,
  ExecutionItem,
  ItemType,
  Participant,
  ReviewState,
  TranscriptTurn,
} from "./types";

let counter = 0;
/** Shared id-generation scheme so IDs look consistent regardless of which
 * extraction path (deterministic or AI) produced an item. */
export function uid(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`;
}

/* ------------------------------------------------------------------ */
/* Transcript parsing                                                  */
/* ------------------------------------------------------------------ */

const TURN_WITH_TIMESTAMP =
  /^\s*\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*([A-Za-z][\w .'-]{0,40}?)\s*(?:\(([^)]+)\))?\s*:\s*(.*)$/;
const TURN_NO_TIMESTAMP = /^\s*([A-Za-z][\w .'-]{0,40}?)\s*(?:\(([^)]+)\))?\s*:\s*(.*)$/;

function normalizeTimestamp(ts: string): string {
  const parts = ts.split(":").map((p) => p.padStart(2, "0"));
  if (parts.length === 2) return `00:${parts[0]}:${parts[1]}`;
  return parts.join(":");
}

function secondsToTimestamp(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  return [h, m, s].map((n) => n.toString().padStart(2, "0")).join(":");
}

export function parseTranscript(raw: string): TranscriptTurn[] {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const turns: TranscriptTurn[] = [];
  let autoSeconds = 0;

  for (const line of lines) {
    const withTs = line.match(TURN_WITH_TIMESTAMP);
    if (withTs) {
      const [, ts, speaker, role, text] = withTs;
      const norm = normalizeTimestamp(ts);
      turns.push({
        id: `t-${norm.replace(/:/g, "-")}`,
        timestamp: norm,
        speaker: speaker.trim(),
        speakerRole: role?.trim(),
        text: text.trim(),
      });
      continue;
    }
    const noTs = line.match(TURN_NO_TIMESTAMP);
    if (noTs) {
      const [, speaker, role, text] = noTs;
      const ts = secondsToTimestamp(autoSeconds);
      autoSeconds += 20;
      turns.push({
        id: `t-${ts.replace(/:/g, "-")}-${turns.length}`,
        timestamp: ts,
        speaker: speaker.trim(),
        speakerRole: role?.trim(),
        text: text.trim(),
      });
      continue;
    }
    // Continuation line — append to previous turn if one exists.
    if (turns.length > 0) {
      turns[turns.length - 1].text += ` ${line}`;
    }
  }

  return turns;
}

export function extractParticipants(turns: TranscriptTurn[]): Participant[] {
  const map = new Map<string, Participant>();
  for (const t of turns) {
    const existing = map.get(t.speaker);
    if (existing) {
      existing.turns += 1;
      if (!existing.role && t.speakerRole) existing.role = t.speakerRole;
    } else {
      map.set(t.speaker, {
        name: t.speaker,
        role: t.speakerRole,
        turns: 1,
        initial: t.speaker.trim().charAt(0).toUpperCase() || "?",
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.turns - a.turns);
}

/* ------------------------------------------------------------------ */
/* Sentence splitting (keeps evidence tight instead of whole turns)    */
/* ------------------------------------------------------------------ */

export interface Sentence {
  text: string;
  turn: TranscriptTurn;
}

/** Splits every transcript turn into individual sentences. Exported so the
 * AI extraction layer can independently scan the full transcript for
 * decision/reversal/opposing-stance language (Fix 1 / Fix 4) instead of
 * relying on Gemini having surfaced it as separate candidates. */
export function splitSentences(turns: TranscriptTurn[]): Sentence[] {
  const out: Sentence[] = [];
  for (const turn of turns) {
    const parts = turn.text
      .split(/(?<=[.?!])\s+(?=[A-Z0-9"“])/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (parts.length === 0) continue;
    for (const p of parts) out.push({ text: p, turn });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Keyword libraries                                                   */
/* ------------------------------------------------------------------ */

const FILLER_STARTS =
  /^(ok(ay)?|so|right|yeah|yep|sure|great|got it|cool|alright|well|hmm)\b[,.]?\s*$/i;

// Broadened (additively — every phrase the old pattern matched still
// matches) after the preference-vs-decision fix's worked examples exposed
// real gaps: contractions weren't handled ("we'll use X" didn't match
// "we will"), and a few common finalization phrasings were missing
// ("let's proceed with", "final approach/answer/choice", "we're doing X").
export const DECISION_RE =
  /\b(decision (?:changed|finalized|made|locked)|we(?:'re| are) (?:adopting|going with|standardizing|doing)|let'?s (?:go with|use|standardize on|proceed with)|final(?:ize|ized)? (?:call|decision|approach|answer|choice)|decided (?:to|that|on)|agreed[,:]?|standardiz(?:e|ing) on|we(?:'ll| will) (?:go with|use|adopt))\b/i;

// Tentative/preference language — a person stating a leaning, suggestion,
// or proposal, not a commitment the group has settled on. Matching this
// (with no decisive DECISION_RE language also present) is one of the two
// signals the preference-vs-decision fix uses to stop a mere preference
// from being extracted as a final decision.
export const PREFERENCE_RE = new RegExp(
  [
    "i'?d? prefer",
    "i think we should",
    "i'?m leaning (?:toward|towards)",
    "\\bmaybe\\b",
    "\\bwhat if\\b",
    "\\bcould we\\b",
    "we should probably",
    "\\bi suggest\\b",
    "let'?s consider",
    "might be better",
    "would be (?:better|safer)",
    "\\bprobably\\b",
    "\\bi guess\\b",
    "i'?m (?:okay|ok) with",
  ].join("|"),
  "i"
);

// Explicit decision-deferral language — the group itself saying the choice
// is not yet made. This is an absolute override in the preference-vs-
// decision fix: even language that otherwise sounds decisive is treated as
// unresolved when this is present, since the transcript is directly
// telling us nothing has actually been settled.
export const DEFERRAL_RE = new RegExp(
  [
    "before deciding",
    "still open",
    "not (?:yet )?finalized",
    "let'?s decide (?:this )?later",
    "we(?:'ll| will) decide",
    "decide after",
    "pending (?:approval|sign[- ]?off|review)",
    "signed? off",
    "let'?s confirm first",
    "don'?t commit yet",
    "not (?:yet )?decided",
    "haven'?t decided",
    "let'?s (?:test|try) both",
    "let'?s not decide",
    "still unresolved",
    "remains? unresolved",
  ].join("|"),
  "i"
);

/** Scans transcript sentences for explicit decision-deferral language
 * (DEFERRAL_RE) sharing at least one real topic word with the given
 * decision candidate's own evidence — independent, transcript-wide
 * evidence the matter was left unresolved, used even when the candidate's
 * own cited evidence doesn't itself contain tentative/deferral language.
 * Exported so the AI path (lib/ai/extract.ts) can run the identical check
 * against Gemini-proposed decision candidates. Conservative by the same
 * topic-overlap gate used everywhere else in this file — a deferral
 * sentence about a genuinely unrelated topic never triggers this. */
export function findDeferralSentence(
  turns: TranscriptTurn[],
  topics: Set<string>,
  excludeTurnIds: Set<string>
): Sentence | null {
  for (const s of splitSentences(turns)) {
    if (excludeTurnIds.has(s.turn.id)) continue;
    if (!DEFERRAL_RE.test(s.text)) continue;
    const sTopics = topicWords(s.text);
    for (const w of topics) {
      if (sTopics.has(w)) return s;
    }
  }
  return null;
}

// Broadened from a stricter "instead of" requirement after the Gemini-path
// evaluation found real reversal language phrased as a trailing adverb
// ("we'll go with X instead", "switch to Y instead for this one") rather
// than "instead of Z" — both T03's and T16's actual reversal sentences use
// this bare-"instead" phrasing and were going undetected by the narrower
// pattern. Still deliberately gated everywhere it's used (both here and in
// the AI path) by also requiring the sentence to independently match
// DECISION_RE, so a bare "instead" in ordinary small talk never triggers a
// supersession search on its own.
export const SUPERSEDE_RE =
  /\b(instead|discard(?:ed|ing)?|replace(?:d|s)?|rather than|no longer|change[d]?\s+(?:the\s+)?(?:decision|plan)|supersed(?:e|ed|es|ing))\b/i;

export const ACTION_SELF_RE =
  /\b(I'?ll|I will|I can|I'?m going to|let me)\b\s+([a-z][\w '-]*)/i;

// Hedge language that means a sentence matching ACTION_SELF_RE is NOT a
// firm enough commitment to attribute ownership to the speaker (Fix 3) —
// deliberately separate from, and stricter than, ACTION_SELF_RE itself:
// the deterministic engine's own action-detection can stay lenient (a
// hedged commitment is still worth surfacing as an item), but *assigning
// an owner* from bare speaker attribution is a stronger claim and must not
// fire on "Maybe I'll..." / "I don't know if I can...", etc.
const SELF_COMMITMENT_HEDGE_RE =
  /\b(maybe|perhaps|possibly|might|i guess|not sure if|don'?t know if)\b/i;

/** Conservative check for whether a sentence is a clear enough first-person
 * action commitment that the speaker can be attributed as owner without an
 * explicit name (Fix 3 — AI-path self-commitment attribution). Exported so
 * lib/ai/extract.ts can use the exact same rule the deterministic engine's
 * own action-detection is built on, plus the extra hedge guard needed
 * because owner-attribution is a stronger claim than "this is an action". */
export function isClearSelfCommitment(text: string): boolean {
  if (!ACTION_SELF_RE.test(text)) return false;
  if (SELF_COMMITMENT_HEDGE_RE.test(text)) return false;
  return true;
}

const ACTION_REQUEST_RE =
  /\b([A-Z][\w'-]*)\s*,?\s*(?:can|could|will) you\b/;

// Imperative work-assignment vocabulary ("Sara, please update the dashboard
// by Friday." / "Priya, update the documentation by Monday."). Kept to a
// curated list of concrete work verbs (rather than matching any word after
// a name+comma) so ordinary address forms ("Sara, I think this is fine.")
// or unrelated "please" phrasing ("Please note that...") never qualify.
const IMPERATIVE_VERBS = [
  "update",
  "review",
  "send",
  "draft",
  "prepare",
  "provision",
  "configure",
  "fix",
  "deploy",
  "schedule",
  "write",
  "handle",
  "take",
  "finish",
  "complete",
  "submit",
  "confirm",
  "check",
  "test",
  "verify",
  "create",
  "build",
  "implement",
  "investigate",
  "follow up",
  "reach out",
  "ping",
  "call",
  "email",
  "share",
  "publish",
  "set up",
];
const IMPERATIVE_VERBS_PATTERN = IMPERATIVE_VERBS.map((v) => v.replace(/ /g, "\\s+")).join("|");

// Anchored at the start of the sentence: "<Name>, [please] <verb> ...". The
// anchor is what keeps this safe — it only fires when the addressed name is
// immediately followed by a recognized work verb, not whenever those words
// appear anywhere in a sentence (e.g. "Sara, here's the update..." never
// matches, since "update" isn't the word right after the comma).
const ACTION_IMPERATIVE_RE = new RegExp(
  `^\\s*([A-Z][\\w'-]*)\\s*,\\s*(?:please\\s+)?(?:${IMPERATIVE_VERBS_PATTERN})\\b`,
  "i"
);

const RISK_RE =
  /\b(risk|blocker|block(?:ed|ing|s)?|won'?t work|cannot|can'?t bypass|will (?:fail|break|melt)|depend(?:ency|s)? on|audit|security (?:sign[- ]off|signed off|concern)|soc ?2|compliance|sla breach|outage|downtime|bottleneck)\b/i;

// A deadline that IS stated in the transcript, just relative to the meeting
// date rather than an absolute calendar date. This must never be resolved
// to a fabricated absolute date — we don't reliably know the meeting date
// context here — but it's meaningfully different from "no deadline at all":
// the flag/message for these should say the date is relative, not missing.
const RELATIVE_DEADLINE_RE =
  /\b(today|tomorrow|tonight|this afternoon|this morning|this evening|this week|next week|by end of day|end of day|by end of week|end of week|by end of next week|end of next week|eod)\b/i;

// Genuinely open-ended — no relative or absolute anchor at all.
const VAGUE_DEADLINE_RE =
  /\b(next sprint|soon|eventually|at some point|later|asap|when(?:ever)? (?:we|possible)|tbd)\b/i;

const MONTH_DAY_RE =
  /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s*\d{4})?\b/i;

const WEEKDAY_RE =
  /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i;

const NAME_RE = /\b([A-Z][a-z]{1,20})\b/g;
const COMMON_CAPITALIZED_NON_NAMES = new Set([
  "I",
  "The",
  "We",
  "Yes",
  "No",
  "Ok",
  "Okay",
  "But",
  "So",
  "And",
  "Let",
  "Maybe",
  "Sprint",
  "Friday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Saturday",
  "Sunday",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]);

// Deliberately narrow: generic acknowledgements like "agreed" or "no" on
// their own are too easily mismatched to an unrelated nearby question, so
// only fairly unambiguous topical stance markers are included here. This
// trades recall for precision on conflict detection — a missed conflict is
// safer than a false one, and either way nothing here becomes authoritative
// without a human resolving it in the review workspace.
export const STANCE_PAIRS: [RegExp, string][] = [
  [/\bopt[- ]?out\b/i, "Opt-Out"],
  [/\bopt[- ]?in\b/i, "Opt-In"],
  [/\benable(?:d)?\b/i, "Enable"],
  [/\bdisable(?:d)?\b/i, "Disable"],
  [/^\s*yes\b/i, "Yes"],
  [/\bno way\b|^\s*no\b/i, "No"],
];

export function detectStance(text: string): string | null {
  for (const [re, label] of STANCE_PAIRS) {
    if (re.test(text)) return label;
  }
  return null;
}

// Stance vocabulary for the *declarative* conflict pass (Fix 2) — a
// separate, slightly broader list from STANCE_PAIRS above, tuned for
// standalone statements rather than direct answers to a question. Phrases
// like "on/off by default" are used instead of bare "on"/"off" so this
// doesn't fire on every sentence that happens to contain those extremely
// common words.
export const DECLARATIVE_STANCE_PAIRS: [RegExp, string][] = [
  // "X by default" and "default(s) to/should be X" are both extremely
  // common real phrasings of the same on/off-by-default position (the
  // Gemini-path evaluation's T10 transcript uses the latter: "should
  // default to 'on'" / "defaults should be 'off'") — both word orders are
  // covered so a real disagreement isn't missed on phrasing alone.
  [/\boff by default\b|\bturn(?:ed|ing)? it off\b|\bkeep(?:ing)? it off\b|\bdefault(?:s|ing)?\s+(?:to|should\s+be)\s+["']?off\b/i, "Off"],
  [/\bon by default\b|\bturn(?:ed|ing)? it on\b|\bkeep(?:ing)? it on\b|\bdefault(?:s|ing)?\s+(?:to|should\s+be)\s+["']?on\b/i, "On"],
  [/\benable(?:d|ing)?\b/i, "Enable"],
  [/\bdisable(?:d|ing)?\b/i, "Disable"],
  [/\bopt[- ]?out\b/i, "Opt-Out"],
  [/\bopt[- ]?in\b/i, "Opt-In"],
  [/^\s*yes\b|\byes,?\s+(?:it should|we should|let'?s)\b/i, "Yes"],
  [/^\s*no\b|\bno way\b|\bno,?\s+(?:it should|we should|let'?s)\b/i, "No"],
  [/\bremove(?:d|ing)?\s+(?:it|this|that|them)\b|\bshould(?:n'?t)? be removed\b|\blet'?s remove\b/i, "Remove"],
  [/\bkeep(?:ing)?\s+(?:it|this|that|them)\b|\bshould stay\b|\blet'?s keep\b/i, "Keep"],
  [/\bimmediate(?:ly)?\b/i, "Immediate"],
  [/\bdelay(?:ed|ing)?\b/i, "Delayed"],
  [/\bapproach a\b|\boption a\b/i, "Approach A"],
  [/\bapproach b\b|\boption b\b/i, "Approach B"],
];

/** Pairs of stance labels considered to *materially oppose* each other.
 * Only these named opposites can form a declarative conflict — two
 * different stance labels that aren't a recognized pair (e.g. "Keep" vs.
 * "Enable") never do, which is what keeps this conservative. */
export const OPPOSING_STANCE = new Map<string, string>([
  ["On", "Off"],
  ["Off", "On"],
  ["Enable", "Disable"],
  ["Disable", "Enable"],
  ["Opt-In", "Opt-Out"],
  ["Opt-Out", "Opt-In"],
  ["Yes", "No"],
  ["No", "Yes"],
  ["Keep", "Remove"],
  ["Remove", "Keep"],
  ["Immediate", "Delayed"],
  ["Delayed", "Immediate"],
  ["Approach A", "Approach B"],
  ["Approach B", "Approach A"],
]);

// Bare "Yes"/"No" are the weakest signal in DECLARATIVE_STANCE_PAIRS — a
// sentence very often opens with "No, ..." as a conversational reaction
// before stating its actual, more specific position later ("No, they
// should be off by default."). Never let that generic opener outrank a
// specific stance phrase (on/off, enable/disable, keep/remove, …) found
// anywhere else in the same sentence.
const GENERIC_DECLARATIVE_LABELS = new Set(["Yes", "No"]);

/** Unlike detectStance, tries every pattern and returns the label of
 * whichever matches *earliest* in the sentence. Some real sentences state
 * their own position first and then explain by contrast ("...should be on
 * by default, actually — off by default kills engagement") — the earliest
 * match best approximates the speaker's actual stated position rather than
 * a word that shows up later while explaining the opposing view. Specific
 * stance vocabulary always wins over a bare "Yes"/"No" elsewhere in the
 * same sentence, regardless of position — see GENERIC_DECLARATIVE_LABELS. */
export function detectDeclarativeStance(text: string): string | null {
  let bestIndex = Infinity;
  let bestLabel: string | null = null;
  let genericIndex = Infinity;
  let genericLabel: string | null = null;
  for (const [re, label] of DECLARATIVE_STANCE_PAIRS) {
    const m = text.match(re);
    if (!m || m.index === undefined) continue;
    if (GENERIC_DECLARATIVE_LABELS.has(label)) {
      if (m.index < genericIndex) {
        genericIndex = m.index;
        genericLabel = label;
      }
      continue;
    }
    if (m.index < bestIndex) {
      bestIndex = m.index;
      bestLabel = label;
    }
  }
  return bestLabel ?? genericLabel;
}

export interface DeadlineExtraction {
  text: string;
  confirmed: boolean;
  /** Stated in the transcript but relative to the meeting date (e.g.
   * "tomorrow", "next week") rather than an absolute date — distinct from
   * no deadline having been mentioned at all. Never resolved to a
   * fabricated calendar date. */
  relative: boolean;
}

/** Classifies a deadline phrase as absolute/confirmed, relative-but-stated,
 * vague, or absent. Exported so the AI extraction layer can run the LLM's
 * `deadline_phrase` field through the exact same rules instead of trusting
 * (or re-deriving) a resolved date on its own — see Fix 3. */
export function extractDeadline(text: string): DeadlineExtraction | null {
  const month = text.match(MONTH_DAY_RE)?.[0];
  const weekday = text.match(WEEKDAY_RE)?.[0];
  if (month) return { text: weekday ? `${weekday}, ${month}` : month, confirmed: true, relative: false };
  if (weekday) return { text: weekday, confirmed: true, relative: false };
  const relative = text.match(RELATIVE_DEADLINE_RE)?.[0];
  if (relative) return { text: relative, confirmed: false, relative: true };
  const vague = text.match(VAGUE_DEADLINE_RE)?.[0];
  if (vague) return { text: vague, confirmed: false, relative: false };
  return null;
}

/** Finds which known participant names are mentioned in a piece of text.
 * Exported so the AI extraction layer can cross-check an LLM-proposed
 * `owner_mention` against the real transcript participants instead of
 * trusting it blindly. */
export function findNames(text: string, knownSpeakers: string[]): string[] {
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(NAME_RE);
  while ((m = re.exec(text))) {
    const name = m[1];
    if (COMMON_CAPITALIZED_NON_NAMES.has(name)) continue;
    if (knownSpeakers.some((s) => s.split(" ")[0] === name)) found.add(name);
  }
  return Array.from(found);
}

/** Lowercased, punctuation-stripped "significant words" (>4 chars) used to
 * decide whether two statements are plausibly about the same topic — the
 * conservatism gate for both decision-supersession matching and conflict
 * pairing. Exported so the AI extraction layer (lib/ai/extract.ts) can
 * apply the exact same topic-overlap rule to LLM-proposed candidates
 * instead of re-implementing it. */
export function topicWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 4)
  );
}

function evidenceFrom(sentence: Sentence, extraTurnIds: string[] = []): Evidence {
  return {
    quote: sentence.text.replace(/\s+/g, " ").trim(),
    speaker: sentence.turn.speaker,
    speakerRole: sentence.turn.speakerRole,
    timestamp: sentence.turn.timestamp,
    turnIds: [sentence.turn.id, ...extraTurnIds],
  };
}

/* ------------------------------------------------------------------ */
/* Main extraction                                                     */
/* ------------------------------------------------------------------ */

export interface ExtractionOutput {
  items: ExecutionItem[];
}

export function extractExecutionItems(
  turns: TranscriptTurn[],
  meetingId: string
): ExtractionOutput {
  const sentences = splitSentences(turns);
  const speakers = Array.from(new Set(turns.map((t) => t.speaker)));
  const items: ExecutionItem[] = [];

  let actionN = 9020;
  let decisionN = 40;
  let questionN = 107;
  let riskN = 18;

  const now = new Date().toISOString();

  function push(
    type: ItemType,
    title: string,
    evidence: Evidence[],
    opts: Partial<ExecutionItem> = {}
  ): ExecutionItem {
    const code =
      type === "action"
        ? `ACT-${++actionN}`
        : type === "decision"
        ? `DEC-${String(++decisionN).padStart(3, "0")}`
        : type === "question"
        ? `QUE-${++questionN}`
        : `RSK-${String(++riskN).padStart(3, "0")}`;
    const ambiguityFlags = opts.ambiguityFlags ?? [];
    const status: ReviewState = ambiguityFlags.length > 0 ? "needs_review" : "extracted";
    const item: ExecutionItem = {
      id: uid(type),
      meetingId,
      code,
      type,
      title,
      status,
      evidence,
      ambiguityFlags,
      targetJira: type === "action",
      targetEmail: true,
      targetNotion: true,
      priority: "Medium",
      createdAt: now,
      updatedAt: now,
      ...opts,
    };
    items.push(item);
    return item;
  }

  // Track decision-topic keywords for supersession detection.
  const decisionTopics: { keywords: Set<string>; item: ExecutionItem; sentence: Sentence }[] = [];

  // Sentence indices already turned into a decision/action/risk/question —
  // the declarative-conflict pass (after this loop) skips these so it never
  // re-classifies a sentence the main pass already handled.
  const consumedIdx = new Set<number>();
  // (speaker, timestamp) pairs already used as a conflict position, so the
  // declarative-conflict pass can't produce a second, duplicate conflict
  // item for a pair of turns the question-based path already resolved.
  const conflictClaimedTurns = new Set<string>();

  sentences.forEach((sentence, idx) => {
    const text = sentence.text;
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length < 3) return;
    if (FILLER_STARTS.test(text)) return;

    const isQuestion = /\?\s*$/.test(text);
    const hasSupersede = SUPERSEDE_RE.test(text);
    const hasDecision = DECISION_RE.test(text);
    const hasAction = ACTION_SELF_RE.test(text) || ACTION_REQUEST_RE.test(text) || ACTION_IMPERATIVE_RE.test(text);
    const hasRisk = RISK_RE.test(text);

    // --- Supersession / decision ---------------------------------
    if (hasDecision && !isQuestion) {
      const title = cleanTitle(text);
      const evidence = [evidenceFrom(sentence)];
      const topics = topicWords(text);

      if (hasSupersede) {
        // Find the earlier decision this most overlaps with.
        let best: (typeof decisionTopics)[number] | null = null;
        let bestScore = 0;
        for (const dt of decisionTopics) {
          let score = 0;
          for (const w of topics) if (dt.keywords.has(w)) score += 1;
          if (score > bestScore) {
            bestScore = score;
            best = dt;
          }
        }

        // Two consecutive utterances (e.g. one speaker proposing the pivot,
        // the next confirming it) often both mention the same override —
        // fold them into a single supersede record instead of duplicating.
        const last = items[items.length - 1];
        if (last && last.type === "decision" && last.supersedes && best && last.supersedes.previousTimestamp === best.sentence.turn.timestamp) {
          last.title = title;
          last.evidence = [...last.evidence, ...evidence];
          last.supersedes.supersededAtTimestamp = sentence.turn.timestamp;
          last.updatedAt = now;
          consumedIdx.add(idx);
          return;
        }

        const item = push("decision", title, evidence, {
          supersedes: best
            ? {
                previousTitle: cleanTitle(best.sentence.text),
                previousQuote: best.sentence.text.replace(/\s+/g, " ").trim(),
                previousTimestamp: best.sentence.turn.timestamp,
                supersededAtTimestamp: sentence.turn.timestamp,
              }
            : undefined,
          adrTag: `#adr-${String(decisionN).padStart(2, "0")}-${slug(title).slice(0, 18)}`,
        });
        decisionTopics.push({ keywords: topics, item, sentence });
        consumedIdx.add(idx);
        return;
      }

      const item = push("decision", title, evidence, {
        adrTag: `#adr-${String(decisionN).padStart(2, "0")}-${slug(title).slice(0, 18)}`,
      });
      decisionTopics.push({ keywords: topics, item, sentence });
      consumedIdx.add(idx);
      return;
    }

    // --- Risk / blocker -------------------------------------------
    if (hasRisk && !isQuestion) {
      const title = cleanTitle(text);
      push("risk", title, [evidenceFrom(sentence)], {
        priority: "High",
        description: text,
      });
      consumedIdx.add(idx);
      return;
    }

    // --- Action item -------------------------------------------------
    // A request phrased as a question ("Sara, can you ... by Friday?") is a
    // commitment, not an open question — check it before the question path.
    if (hasAction) {
      const title = cleanTitle(text);
      const ambiguityFlags: AmbiguityFlag[] = [];
      let owner: string | undefined;
      let ownerCandidates: string[] | undefined;

      const requestMatch = text.match(ACTION_REQUEST_RE);
      const imperativeMatch = text.match(ACTION_IMPERATIVE_RE);
      if (requestMatch) {
        owner = requestMatch[1];
      } else if (imperativeMatch) {
        owner = imperativeMatch[1];
      } else if (ACTION_SELF_RE.test(text)) {
        owner = sentence.turn.speaker;
      }

      // Ambiguous multi-candidate pattern: "Maybe X? X, are you free or is Y ...?"
      const multiNames = findNames(text, speakers);
      if (multiNames.length >= 2) {
        ownerCandidates = multiNames;
        owner = undefined;
        ambiguityFlags.push({
          type: "owner_unclear",
          message: `Multiple candidate owners mentioned in transcript: ${multiNames.join(", ")}.`,
        });
      } else if (!owner) {
        ambiguityFlags.push({
          type: "owner_unclear",
          message: "No explicit owner stated for this commitment.",
        });
      }

      const deadline = extractDeadline(text);
      if (!deadline) {
        ambiguityFlags.push({
          type: "deadline_unclear",
          message: "No explicit deadline stated in the transcript for this item.",
        });
      } else if (deadline.relative) {
        ambiguityFlags.push({
          type: "deadline_unclear",
          message: `Relative deadline ("${deadline.text}") — exact date depends on the meeting date.`,
        });
      } else if (!deadline.confirmed) {
        ambiguityFlags.push({
          type: "deadline_unclear",
          message: `Deadline is vague ("${deadline.text}") — needs a concrete date.`,
        });
      }

      push("action", title, [evidenceFrom(sentence)], {
        owner,
        ownerCandidates,
        deadline: deadline?.text,
        deadlineConfirmed: deadline?.confirmed ?? false,
        ambiguityFlags,
        priority: ambiguityFlags.length > 0 ? "High" : "Medium",
      });
      consumedIdx.add(idx);
      return;
    }

    // --- Open question ----------------------------------------------
    if (isQuestion && !hasAction && words.length >= 4) {
      const title = cleanTitle(text.replace(/\?$/, "")) + "?";

      // Look ahead for opposing stances from different speakers.
      const positions: ConflictPosition[] = [];
      const seenSpeakers = new Set<string>();
      for (let j = idx + 1; j < Math.min(sentences.length, idx + 6); j++) {
        const s = sentences[j];
        if (s.turn.speaker === sentence.turn.speaker) continue;
        const stance = detectStance(s.text);
        if (!stance) continue;
        if (seenSpeakers.has(s.turn.speaker)) continue;
        seenSpeakers.add(s.turn.speaker);
        positions.push({
          speaker: s.turn.speaker,
          quote: s.text.replace(/\s+/g, " ").trim(),
          timestamp: s.turn.timestamp,
          stance,
        });
        if (positions.length >= 2) break;
      }

      const distinctStances = new Set(positions.map((p) => p.stance));
      const ambiguityFlags: AmbiguityFlag[] = [];
      let conflict: Conflict | undefined;

      if (positions.length >= 2 && distinctStances.size >= 2) {
        conflict = {
          id: uid("conflict"),
          summary: title,
          positions,
          resolved: false,
        };
        ambiguityFlags.push({
          type: "conflicting_statements",
          message: `${positions.map((p) => p.speaker).join(" and ")} expressed opposing positions.`,
        });
        for (const p of positions) conflictClaimedTurns.add(`${p.speaker}@${p.timestamp}`);
      } else {
        ambiguityFlags.push({
          type: "needs_clarification",
          message: "Open question raised in the meeting with no recorded resolution.",
        });
      }

      consumedIdx.add(idx);
      push("question", title, [evidenceFrom(sentence)], {
        conflict,
        ambiguityFlags,
      });
      return;
    }
  });

  /* ------------------------------------------------------------------ */
  /* Declarative conflict detection (Fix 2)                              */
  /* ------------------------------------------------------------------ */
  //
  // The pass above only surfaces a conflict when it's anchored to an actual
  // `?` question ("Should push notifications be enabled by default?"). Real
  // meetings often disagree without anyone asking a question at all:
  //   Marcus: "We'll keep notifications off by default for new users."
  //   David:  "I think notifications should be on by default, actually."
  // Neither sentence matches the decision/action/risk/question patterns, so
  // without this pass they'd be silently dropped (no fabrication, but also
  // no surfaced conflict). This walks the leftover, unclassified sentences
  // looking for a *named* pair of opposing positions (on/off, enable/
  // disable, opt-in/opt-out, yes/no, keep/remove, immediate/delayed,
  // approach A/B) from two different speakers who are talking about the
  // same thing (a shared topic word), and — reusing the exact same
  // Conflict/ConflictPosition shape and "question" item type the path
  // above already produces — surfaces it the same way: as an unresolved
  // conflict a human must resolve. It never picks a side and never
  // produces a decision.
  function detectDeclarativeConflicts() {
    for (let i = 0; i < sentences.length; i++) {
      if (consumedIdx.has(i)) continue;
      const a = sentences[i];
      const textA = a.text;
      const wordsA = textA.split(/\s+/).filter(Boolean);
      if (wordsA.length < 4) continue;
      if (FILLER_STARTS.test(textA)) continue;
      if (/\?\s*$/.test(textA)) continue; // questions are handled above
      if (conflictClaimedTurns.has(`${a.turn.speaker}@${a.turn.timestamp}`)) continue;

      const stanceA = detectDeclarativeStance(textA);
      if (!stanceA) continue;
      const topicsA = topicWords(textA);

      for (let j = i + 1; j < Math.min(sentences.length, i + 6); j++) {
        if (consumedIdx.has(j)) continue;
        const b = sentences[j];
        if (b.turn.speaker === a.turn.speaker) continue;
        const textB = b.text;
        if (textB.split(/\s+/).filter(Boolean).length < 4) continue;
        if (/\?\s*$/.test(textB)) continue;
        if (conflictClaimedTurns.has(`${b.turn.speaker}@${b.turn.timestamp}`)) continue;

        const stanceB = detectDeclarativeStance(textB);
        if (!stanceB || OPPOSING_STANCE.get(stanceA) !== stanceB) continue;

        const topicsB = topicWords(textB);
        const sharedTopics = [...topicsA].filter((w) => topicsB.has(w));
        if (sharedTopics.length === 0) continue; // not clearly the same topic — stay conservative

        const topicLabel = sharedTopics[0];
        const title = `Conflicting positions on ${topicLabel}`;
        const positions: ConflictPosition[] = [
          { speaker: a.turn.speaker, quote: textA.replace(/\s+/g, " ").trim(), timestamp: a.turn.timestamp, stance: stanceA },
          { speaker: b.turn.speaker, quote: textB.replace(/\s+/g, " ").trim(), timestamp: b.turn.timestamp, stance: stanceB },
        ];
        const conflict: Conflict = {
          id: uid("conflict"),
          summary: title,
          positions,
          resolved: false,
        };

        push("question", title, [evidenceFrom(a), evidenceFrom(b)], {
          conflict,
          ambiguityFlags: [
            {
              type: "conflicting_statements",
              message: `${a.turn.speaker} and ${b.turn.speaker} expressed opposing positions on ${topicLabel} (${stanceA} vs. ${stanceB}) — not resolved in the transcript.`,
            },
          ],
        });

        consumedIdx.add(i);
        consumedIdx.add(j);
        conflictClaimedTurns.add(`${a.turn.speaker}@${a.turn.timestamp}`);
        conflictClaimedTurns.add(`${b.turn.speaker}@${b.turn.timestamp}`);
        break;
      }
    }
  }

  detectDeclarativeConflicts();

  // Preference-vs-decision fix, Rule B (transcript-wide deferral scan).
  // Rule A (intra-evidence tentative-language check, see lib/ai/extract.ts)
  // is structurally moot here: this engine only ever creates a "decision"
  // from a single sentence that already matched DECISION_RE itself, so
  // tentative-only evidence with no decisive language can't occur by
  // construction. Rule B still applies: the decisive sentence that became
  // this item might be immediately followed by the group explicitly
  // deferring the actual choice elsewhere ("let's test both before
  // deciding") — independently re-scan for that rather than trusting a
  // single decisive-sounding sentence in isolation. Already-superseded/
  // superseding decisions are skipped — a decision that's part of a
  // confirmed reversal is not second-guessed by this pass.
  for (const item of items) {
    if (item.type !== "decision" || item.supersedes) continue;
    const evidenceText = item.evidence.map((e) => e.quote).join(" ");
    const topics = topicWords(evidenceText);
    const excludeIds = new Set(item.evidence.flatMap((e) => e.turnIds));
    const deferral = findDeferralSentence(turns, topics, excludeIds);
    if (!deferral) continue;

    item.evidence = [...item.evidence, evidenceFrom(deferral)];
    item.type = "question";
    item.code = `QUE-${++questionN}`;
    item.status = "needs_review";
    item.ambiguityFlags = [
      {
        type: "needs_clarification",
        message: `The transcript explicitly defers this decision elsewhere ("${deferral.text
          .replace(/\s+/g, " ")
          .trim()}") — treating it as unresolved rather than finalized.`,
      },
    ];
    item.updatedAt = new Date().toISOString();
    delete item.adrTag;
    item.targetJira = false;
  }

  return { items };
}

const DISCOURSE_FILLER_RE =
  /^(?:okay|ok|so|well|right|yeah|yep|alright|wait|but|also|and|hey|look|actually|honestly)[,.]?\s*/i;

/** Exported so the AI path can title a deterministically-synthesized
 * "original decision" item (Fix 4) using the exact same cleanup rules the
 * deterministic engine applies to its own item titles. */
export function cleanTitle(text: string): string {
  let t = text.trim();
  // Strip one or two leading discourse fillers ("Wait, earlier we..." / "So, ok, let's...").
  for (let i = 0; i < 2; i++) {
    const stripped = t.replace(DISCOURSE_FILLER_RE, "");
    if (stripped === t) break;
    t = stripped.trim();
  }
  t = t.replace(/^[A-Z][\w'-]*,?\s+(?:can|could|will) you\s+/i, "");
  // Strip an imperative address prefix ("Sara, please update..." / "Priya,
  // update...") but keep the verb itself — only when it's immediately
  // followed by a recognized work verb, so unrelated "Name, ..." openers
  // are left untouched.
  t = t.replace(new RegExp(`^[A-Z][\\w'-]*\\s*,\\s*(?:please\\s+)?(?=(?:${IMPERATIVE_VERBS_PATTERN})\\b)`, "i"), "");
  t = t.replace(/\?$/, "").trim();
  t = t.replace(/^(?:I'?ll|I will|I can|I'?m going to|let me)\s+/i, "");
  t = t.charAt(0).toUpperCase() + t.slice(1);
  if (t.length > 92) t = t.slice(0, 89).trimEnd() + "…";
  return t.replace(/\.$/, "");
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
