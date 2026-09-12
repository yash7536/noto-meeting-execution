// Data contract for the LLM extraction step (see the architecture audit).
// Deliberately hand-validated rather than pulled in via a schema library —
// the shape is small and fully enumerated below, and the real structural
// constraint on the model's output is EXTRACTION_RESPONSE_SCHEMA (Gemini's
// structured-output JSON schema), which is what's actually sent to the API.
// What's here is defense-in-depth on top of that, in case the model (or a
// future version of it) doesn't respect the schema perfectly.
//
// This contract is provider-agnostic on purpose: RawCandidate and the
// validation functions below don't change when the AI provider does — only
// EXTRACTION_RESPONSE_SCHEMA's encoding (see lib/ai/extract.ts) is
// provider-specific.
//
// IMPORTANT: this file intentionally has NO "status", "id", "code",
// "ambiguityFlags", "conflict", or "supersedes" field anywhere. The model
// has no channel to set any of those — they're computed entirely by the
// deterministic validation layer in lib/ai/extract.ts.

import { Type, type Schema } from "@google/genai";

export type CandidateType = "action" | "decision" | "question" | "risk";
export type CandidatePriorityHint = "low" | "medium" | "high" | null;

export interface CandidateEvidence {
  turn_id: string;
  quote: string;
}

export interface RawCandidate {
  type: CandidateType;
  title: string;
  description: string | null;
  /** Every name the model saw mentioned as possibly responsible for this
   * item — [] if none, one entry if there's a single clear owner, multiple
   * entries when several people were raised as candidates and none was
   * confirmed (Fix 2). The model is never asked to pick one; that decision
   * belongs entirely to the deterministic validation layer. */
  owner_mentions: string[];
  deadline_phrase: string | null;
  priority_hint: CandidatePriorityHint;
  evidence: CandidateEvidence[];
  related_to: string | null;
}

const VALID_TYPES: ReadonlySet<string> = new Set(["action", "decision", "question", "risk"]);
const VALID_PRIORITY: ReadonlySet<string> = new Set(["low", "medium", "high"]);

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function optionalString(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

/** Validates and cleans one candidate item from the model's response.
 * Returns null if the item is too malformed to use at all — missing a
 * recognized type, a title, or any evidence at all. Everything else is
 * coerced to a safe value rather than rejecting the whole item over a
 * secondary field. */
export function coerceCandidate(raw: unknown): RawCandidate | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  if (typeof r.type !== "string" || !VALID_TYPES.has(r.type)) return null;
  if (!isNonEmptyString(r.title)) return null;
  if (!Array.isArray(r.evidence) || r.evidence.length === 0) return null;

  // owner_mentions is the current field (an array — see RawCandidate).
  // Also accept a legacy singular "owner_mention" string for backward
  // compatibility in case any older-shaped payload ever reaches this parser
  // (e.g. a cached/replayed response) — normalized to the same array shape
  // either way. Non-string / empty entries are dropped rather than
  // rejecting the whole candidate.
  const ownerMentionsRaw = Array.isArray(r.owner_mentions)
    ? r.owner_mentions
    : isNonEmptyString(r.owner_mention)
    ? [r.owner_mention]
    : [];
  const seenOwners = new Set<string>();
  const owner_mentions: string[] = [];
  for (const m of ownerMentionsRaw) {
    if (!isNonEmptyString(m)) continue;
    const trimmed = m.trim();
    const key = trimmed.toLowerCase();
    if (seenOwners.has(key)) continue;
    seenOwners.add(key);
    owner_mentions.push(trimmed);
  }

  const evidence: CandidateEvidence[] = [];
  for (const e of r.evidence) {
    if (!e || typeof e !== "object") continue;
    const eo = e as Record<string, unknown>;
    if (isNonEmptyString(eo.turn_id) && isNonEmptyString(eo.quote)) {
      evidence.push({ turn_id: (eo.turn_id as string).trim(), quote: (eo.quote as string).trim() });
    }
  }
  if (evidence.length === 0) return null;

  const priorityRaw = typeof r.priority_hint === "string" ? r.priority_hint.toLowerCase() : null;

  return {
    type: r.type as CandidateType,
    title: (r.title as string).trim(),
    description: optionalString(r.description),
    owner_mentions,
    deadline_phrase: optionalString(r.deadline_phrase),
    priority_hint: priorityRaw && VALID_PRIORITY.has(priorityRaw) ? (priorityRaw as CandidatePriorityHint) : null,
    evidence,
    related_to: optionalString(r.related_to),
  };
}

/** Validates the top-level structured-output payload, coercing every item
 * it can and silently dropping anything unusable. Returns an empty array —
 * not an error — for a structurally wrong payload; the caller treats zero
 * usable candidates as a signal to fall back to the deterministic engine. */
export function parseExtractionPayload(raw: unknown, maxItems: number): RawCandidate[] {
  if (!raw || typeof raw !== "object") return [];
  const items = (raw as Record<string, unknown>).items;
  if (!Array.isArray(items)) return [];
  const out: RawCandidate[] = [];
  for (const item of items) {
    const c = coerceCandidate(item);
    if (c) out.push(c);
    if (out.length >= maxItems) break;
  }
  return out;
}

/** The response schema sent to Gemini via `generationConfig.responseSchema`
 * (structured output, not free-form prose JSON) — this is what actually
 * constrains the model's output shape. It mirrors RawCandidate above field
 * for field. Note there is no "status", "id", or ambiguity/conflict field
 * anywhere in this schema: the model has no way to set them. */
export const EXTRACTION_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: {
            type: Type.STRING,
            enum: ["action", "decision", "question", "risk"],
            description:
              "action = a commitment/request someone will do; decision = something the group actually settled on (not merely discussed); question = an open/unresolved question; risk = a risk or blocker raised.",
          },
          title: { type: Type.STRING, description: "Short, specific title for this item." },
          description: {
            type: Type.STRING,
            nullable: true,
            description: "One extra sentence of context, or null.",
          },
          owner_mentions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description:
              "Every name mentioned as possibly responsible for this item, verbatim as it appears in the transcript. Empty array if no owner was stated. If more than one person was raised as a candidate owner and the meeting did not confirm a single one, list ALL of them — do not pick one yourself. Never guess a name that wasn't actually mentioned.",
          },
          deadline_phrase: {
            type: Type.STRING,
            nullable: true,
            description:
              "The exact deadline language as spoken (e.g. 'Friday', 'tomorrow', 'next week'). Do not resolve this to a calendar date yourself. null if no deadline was stated.",
          },
          priority_hint: {
            type: Type.STRING,
            nullable: true,
            enum: ["low", "medium", "high"],
          },
          evidence: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                turn_id: { type: Type.STRING, description: "Must exactly match one of the provided turn IDs." },
                quote: {
                  type: Type.STRING,
                  description: "An exact, verbatim substring of that turn's text — never a paraphrase.",
                },
              },
              required: ["turn_id", "quote"],
            },
          },
          related_to: {
            type: Type.STRING,
            nullable: true,
            description:
              "Optional: if this item appears related to, conflicts with, or supersedes another item you're recording, briefly say so here (e.g. reference the other item's title). Advisory only — not authoritative.",
          },
        },
        required: ["type", "title", "evidence"],
      },
    },
  },
  required: ["items"],
};
