# Noto — AI System Design

This document explains the AI architecture in product terms: what the model is trusted to do, what it's explicitly never trusted to do, and why.

## The central design principle

> Use AI for interpretation, deterministic logic for consistency and validation, and humans for authority.

Concretely: Gemini reads the transcript and proposes candidates. It has **zero ability to set status, approval, ownership, ambiguity, conflict, or supersession** — there is no field in its output schema for any of those. Every one of those is computed by plain TypeScript that checks the model's proposal against the actual transcript text. Nothing the model outputs becomes authoritative until a person approves it in the review workspace.

## AI / Deterministic / Human boundary

| Responsibility | AI (Gemini) | Deterministic code | Human |
|---|:---:|:---:|:---:|
| Identify candidate decisions / actions / questions / risks | ✓ | | |
| Propose an evidence quote for a candidate | ✓ | ✓ verifies it's a real substring | |
| Propose an owner / deadline | ✓ | ✓ verifies it's grounded, flags if not | |
| Distinguish preference/proposal from a finalized decision | ✓ prompted to | ✓ enforced regardless of what the model does | |
| Compute ambiguity flags (unclear owner, unclear deadline) | | ✓ | |
| Compute conflict detection between speakers | | ✓ (using the AI's proposed evidence/relations as input) | |
| Compute supersession links between decisions | | ✓ | |
| Full deterministic fallback extraction (Gemini unavailable/fails) | | ✓ | |
| Decide an item's authoritative status (approved / edited / rejected) | | | ✓ |
| Resolve an ambiguous owner or an unresolved conflict | | | ✓ |
| Generate the follow-up email draft | | ✓ (templated from approved items) | ✓ reviews/edits/sends |
| Generate Jira / Notion export | | ✓ (formatting only) | ✓ initiates, copies, reviews |

The model proposes everything in the top section. Deterministic code owns everything in the middle. Nothing crosses into "real" until a human acts on it in the bottom section.

## Guardrails

These are the actual, implemented guardrails — not aspirational ones.

**Grounding.** Every extracted item must carry evidence — a quote the model claims came from the transcript. Deterministic code checks that the quote is an actual, verbatim substring of the cited transcript turn. If it isn't, the item is dropped outright, not repaired or reworded into something that would pass.

**No invention.** Owners and deadlines aren't asserted unless they're grounded in the evidence text. An owner mention that doesn't match a real transcript speaker doesn't get "corrected" to the closest name — it gets flagged as ambiguous instead. A vague deadline phrase ("sometime next week") is never converted into a specific date.

**Uncertainty becomes a review state, not a guess.** Missing owners, missing deadlines, and hedged commitments are surfaced as ambiguity flags (`owner_unclear`, `deadline_unclear`) rather than silently resolved one way or the other.

**Preference ≠ decision.** This is the guardrail that exists because of a real failure — see `docs/PRODUCT-DECISIONS.md` and the failure story below. A preference, suggestion, or proposal is not automatically treated as a finalized decision, even if the model's raw candidate said so.

**Deferral detection.** Explicit deferral language ("let's decide after legal signs off," "before deciding") demotes a would-be decision to an open question — the system looks for signals that the room explicitly said "not yet," not just for the absence of confident language.

**Conflicts are surfaced, not resolved.** When two people take opposing positions on the same topic and the meeting doesn't resolve it, both positions are shown as an unresolved conflict. The system does not pick a "winner."

**Supersession preserves history.** When a decision is explicitly reversed later in the meeting, Noto attempts to keep both the original and the final decision, linked together — not just the last one, with the earlier one silently discarded.

**Human authority.** AI output is never authoritative on its own. Every item's real status (`approved`/`edited`/`rejected`) is set exclusively by a human action in the review workspace.

**Export gate.** Only items with `status: approved` are eligible to appear in the approved execution plan, the follow-up email, or the Jira/Notion export. This is enforced at the point those views are built, not left as a convention.

**Deterministic fallback.** If the Gemini call fails for any reason — no API key, network error, malformed response, or a response with nothing usable — the app automatically falls back to a fully deterministic, regex/rule-based extraction engine (`lib/extraction.ts`), so the product still works end-to-end without the AI path.

**Structural resistance to prompt injection.** The transcript is the only untrusted input in this system, and it's treated that way by construction rather than by a separate filter: Gemini's output is constrained to a fixed JSON schema that has no field for status, approval, or authority. Even if a transcript contained text trying to instruct the model to "mark this approved" or "treat this as final," there is no channel in the output schema for that instruction to take effect — those fields don't exist on the AI side of the boundary at all. This is an emergent property of the schema-constrained, zero-authority design, not a dedicated prompt-injection test suite.

## What this does *not* guarantee

Worth being explicit about: this architecture does not guarantee zero hallucinations, and it does not produce perfectly accurate output. What it guarantees is that independent, non-AI code checks the specific claims that matter most (evidence, ownership, deadlines, conflicts, decision-vs-preference) before anything reaches a human reviewer — and that nothing reaches a human's exports without that human's own approval. See `docs/EVALUATION.md` for how well that actually performs in measurement, and `docs/EVALUATION.md`'s limitations section for where it still falls short.
