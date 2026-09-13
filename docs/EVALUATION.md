# Noto — Evaluation

Two separate evaluation passes, run in this order: a controlled experiment to decide *where* to put the accuracy work, then a production evaluation of the actual deployed pipeline.

Both runs use the same frozen gold set: **18 meeting transcripts, 54 hand-labeled ground-truth items** (a mix of decisions, actions, and open questions — the frozen set contains zero risk-type items, which matters for the limitations section below).

## Stage 1 — Controlled experiment (prompt-only conditions)

Before building the product's deterministic validation layer, I ran three prompt-only conditions directly against the Gemini API. No evidence checking, no guardrails, no fallback engine — just the raw model output from three progressively different prompts, scored against the same 54-item gold set.

The point of this stage was to separate two different questions: *does a better prompt help*, and *does independent validation logic help more than prompting alone*. C1 established a baseline zero-shot extraction prompt. C2 added a requirement that the model cite evidence for each item (but nothing checked that evidence — it was still self-reported). C3 added the same guardrail *instructions* the deterministic layer would later enforce in code (evidence, preference-vs-decision, deferral) — but still purely as prompt text, with no independent verification.

| Version | Precision | Recall | F1 | Correct | Output | False Positives |
|---|---:|---:|---:|---:|---:|---:|
| C1 — Baseline prompt | 61.2% | 75.9% | 67.8% | 41 | 67 | 26 |
| C2 — + Evidence requirement | 65.1% | 75.9% | 70.1% | 41 | 63 | 22 |
| C3 — + Evidence + Guardrail instructions | 71.9% | 85.2% | 78.0% | 46 | 64 | 18 |

**C3 vs. C1:** +10.4pp precision, +9.3pp recall, +10.2pp F1, 8 fewer false positives.

**What this told me:** prompting alone (C2) bought a real but modest improvement. Telling the model to follow guardrail rules in the prompt (C3) bought a much bigger jump — but critically, C3 is *still just a prompt asking the model to behave*, with no independent code checking that it actually did. That's the reasoning that led directly to building the deterministic validation layer as actual code rather than as prompt instructions the model could ignore or misapply on any given call. A prompt is a request; deterministic code is a check.

## Stage 2 — Production evaluation (the real, deployed pipeline)

This is the actual product: Gemini extraction → deterministic validation → evidence verification, run through the real `/api/analyze` route, not a prompt-only condition. All 18 transcripts, real Gemini calls (never counting a deterministic-fallback result as an AI result — any 429/503 was retried or the run was stopped and reported honestly rather than substituted).

**18/18 transcripts complete.**

| Metric | Result |
|---|---|
| Precision | 77.8% (49/63) |
| Recall | 90.7% (49/54) |
| F1 | 83.8% |
| Evidence grounding | 100% |
| Decision accuracy | 69.2% (9/13) |
| Owner accuracy | 79.3% (23/29) |
| Deadline accuracy | 86.2% (25/29) |
| Conflict detection | 50% (1/2) |
| Ambiguity handling | 77.8% recall (7/9), 61.5% precision (24/39) |
| Supersession handling | 0/4 |

**Important context on these numbers:** this run was measured **before** the preference-vs-decision guardrail fix described in `docs/PRODUCT-DECISIONS.md` and `docs/USER-RESEARCH.md`. That fix was validated with targeted regression tests (41/41 passing) against the specific failure cases it addressed — the full 18-transcript production evaluation was **not** rerun afterward. These numbers should be read as the pipeline's baseline production accuracy, not as reflecting the post-fix behavior. I'm calling that out explicitly rather than letting the two get conflated.

A few more honest notes: supersession handling at 0/4 is a real limitation in this run, not a rounding artifact — reversed decisions were hard for this pipeline to catch consistently. Conflict detection on a sample of 2 isn't something I'd stake a statistical claim on; it's reported as-is.

## Evaluation limitations

- **Supersession detection is still brittle** for some reversal/reference phrasing — it does not reliably catch every way a decision can be walked back or referenced from an earlier point in the conversation.
- **Ambiguity handling can be conservative and over-flag** — the 61.5% ambiguity precision means a meaningful fraction of flagged ambiguities weren't actually ambiguous; the system errs toward asking a human to double-check rather than guessing wrong.
- **Some question-typed items can bypass certain owner-resolution paths** — the owner-candidate confirmation UI is scoped to action/risk items; a question-typed item with an unclear owner doesn't go through the same resolution flow.
- **Code-switched Hindi-English self-commitments can be missed.** A real example surfaced during evaluation: a self-commitment phrased with code-switching between Hindi and English was misattributed rather than correctly linked to the speaker.
- **Sentence fragmentation can occasionally split a single commitment** across what the deterministic engine treats as two separate sentences, since extraction reasons at the sentence level.
- **Risk-type extraction has limited evaluation coverage** because the frozen gold set contains zero risk-type items — none of the precision/recall numbers above say anything about how well risk extraction actually performs; it simply wasn't represented in this dataset.
- **The dataset itself is small** (18 transcripts, 54 items). I'd trust the directional signal — evidence grounding matters, guardrails reduce false positives — more than I'd trust the exact percentage points holding up on a larger sample.

None of this is hidden because it's inconvenient. An evaluation that only reports the numbers that look good isn't an evaluation — it's marketing.
