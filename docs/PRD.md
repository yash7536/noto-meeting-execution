# Noto — Product Requirements

## Problem

Meeting notes summarize a conversation. They don't produce an execution record a team can actually trust and act on.

The gap looks like this:

```
Meeting
  → notes (someone's paraphrase, written under time pressure)
  → manual interpretation (what did we actually agree to?)
  → clarification (wait, was that decided or just discussed?)
  → follow-up (chasing owners who didn't know they owned it)
  → Jira/Notion (re-typing the same items a third time)
```

Every one of those arrows is a place where something gets lost, misremembered, or quietly invented — an owner nobody volunteered for, a deadline nobody actually said, a proposal that gets treated as a done deal.

Noto's intended workflow collapses that into:

```
Transcript
  → Noto (AI extraction + deterministic validation)
  → evidence-backed review (a human checks it, not re-derives it)
  → approved execution plan
  → email / Jira / Notion-ready output
```

The transcript already contains everything needed — decisions, owners, deadlines, open questions, risks. The job isn't to summarize it (any LLM does that in one prompt); it's to turn it into something actionable without silently inventing what wasn't actually said.

## Target Users

**Primary:** product managers, project leads, and startup/small-team leads who run recurring meetings and are personally on the hook for turning them into follow-through.

These are the people who currently:

- leave a meeting and have to reconstruct "what did we actually agree to" from memory or scattered notes,
- are the ones chasing owners and deadlines afterward,
- are the ones who look bad when something discussed-but-not-decided gets treated as settled.

They have the problem because they sit at the exact point where a messy conversation has to become an accountable, checkable record — and today that translation is manual, slow, and error-prone.

## User Job

> After a messy meeting, I want to quickly turn what was actually agreed into accountable next steps — without manually re-listening to or re-reading the whole conversation to reconstruct it myself.

This is deliberately narrow. It is not "manage all my projects" or "replace my task tracker." It's specifically the translation step between a conversation and a reviewable record of what came out of it.

## Product Goal

> Reduce the effort required to turn a meeting transcript into an approved execution plan, while keeping the resulting record grounded (evidence-backed) and reviewable (a human checks it before it's authoritative).

Both halves matter. Speed without grounding is just a faster way to be confidently wrong. Grounding without a fast path defeats the point of automating the first pass at all.

## Non-Goals

Explicitly out of scope for this product, not oversights:

- **Not an autonomous decision-maker.** Noto never finalizes a decision, owner, or deadline on its own — a human approves everything that becomes authoritative.
- **Not a generic meeting summarizer.** A prose summary isn't checkable or actionable the way a structured, evidence-linked item is.
- **Not a live meeting transcription platform.** You paste a transcript in; Noto doesn't record or transcribe audio.
- **Not a Jira/Notion integration in the MVP.** Output is copy-ready formatted text, not a live API call — a deliberate scope cut to validate the extraction/review workflow first.
- **Not a replacement for human approval.** Every item that leaves the review workspace was approved by a person; the product is designed around that being non-negotiable, not a config toggle.

## Core Requirements

1. Accept a pasted meeting transcript with speaker labels and timestamps.
2. Extract candidate decisions, action items, open questions, and risks via an AI (Gemini) call, each with an owner mention, deadline phrase, and a verbatim evidence quote.
3. Independently validate every AI candidate with deterministic (non-AI) code before it reaches a human: evidence must be a real substring of the transcript, owners and deadlines must be grounded in that evidence, and status/approval fields are never set by the model.
4. Detect and surface — rather than silently resolve — ambiguity (missing/unclear owner or deadline), conflicting statements between speakers, and superseded decisions (a later decision that reverses an earlier one).
5. Detect and demote preferences/proposals/deferred discussions that are not actually finalized decisions (see `docs/AI-SYSTEM-DESIGN.md` and `docs/PRODUCT-DECISIONS.md` for why this exists).
6. Provide a human review workspace where every item can be edited, approved, or rejected, with the original evidence always visible.
7. Gate all downstream output (approved execution plan, follow-up email, Jira/Notion export) to only include items with `status: approved`.
8. Fall back to a fully deterministic (non-AI) extraction engine if the Gemini call is unavailable or fails, so the product still functions without an API key or network access to Gemini.
9. Persist meetings and item state locally (no backend/database in this MVP) so a session survives a page refresh.

## Success Metrics

### AI quality metrics (measured — see `docs/EVALUATION.md` for full numbers and methodology)

- Extraction precision / recall / F1 (frozen 18-transcript, 54-item gold set)
- Evidence grounding rate
- Owner accuracy
- Deadline accuracy
- Decision accuracy
- Conflict-detection and ambiguity-handling precision/recall
- Supersession-handling accuracy

### Product/user metrics — **not yet measured, defined for future instrumentation**

These are explicitly things Noto *should* eventually track, not numbers that exist today:

- Time from transcript submission to an approved execution plan
- Approval rate (approved / total extracted items)
- Edit rate (items a human had to correct before approving)
- Rejection rate
- Ambiguity/conflict resolution rate
- Percentage of generated items requiring correction
- User-reported usefulness (qualitative, from real usage — not a survey score invented for this document)

No values are asserted for the product/user metrics above. The only measured numbers in this project are the AI quality metrics in `docs/EVALUATION.md` and the exploratory findings in `docs/USER-RESEARCH.md`.
