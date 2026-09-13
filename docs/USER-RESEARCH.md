# Noto — User Research

**This is exploratory usability testing with 8 users, not a statistically significant study.** No claim in this document should be read as "N% of users experienced X" — the sample is far too small for that, and I'm not going to dress it up as more rigorous than it was.

## Sample

8 real people, across four groups:

- 3 college club coordinators
- 2 project students
- 1 software developer
- 2 startup team members

A caveat worth stating plainly: this wasn't 8 independently-designed scenarios. Some testers — including within the club-coordinator group — worked from the same starting transcript rather than each bringing a fully separate real meeting. That's a real limitation of this round, not something to gloss over: it means the effective diversity of inputs is lower than "8 people" implies on its own, even though the reactions, confusion points, and the failure described below came from real people actually using the product, not from me testing my own app.

## Testing prompt

Testers weren't given a rigid script. The instruction was, in spirit:

> Use the app normally. Paste a transcript, review what it produces, and tell me anything that's wrong, missing, confusing, or unnecessary.

## Findings

Organized as **Observation → Impact → Product response**.

### 1. Owner identification was incorrect in one test
**Observation:** an action item was attributed to the wrong person.
**Impact:** a wrong owner in an execution plan is exactly the failure mode the whole product is designed to prevent — it's worse than no owner at all, because it looks confident.
**Product response:** this is the case for why owner grounding is checked deterministically rather than trusted from the model directly (see `docs/AI-SYSTEM-DESIGN.md`); it's also why "unclear owner" is a first-class review state instead of the system always picking someone.

### 2. One unresolved question wasn't surfaced clearly enough
**Observation:** a tester didn't immediately notice that an open question still needed their input.
**Impact:** if a reviewer misses a flagged item, the review step doesn't do its job.
**Product response:** this remains a known UX gap rather than a claimed fix — noted here rather than hidden. It's a legitimate candidate for future review-workspace polish (clearer visual priority for unresolved items), not something I'm claiming is solved.

### 3. The system conservatively avoided assigning an uncertain person rather than inventing ownership
**Observation:** when ownership genuinely wasn't clear from the transcript, Noto surfaced it as ambiguous instead of guessing.
**Impact:** this is the design working as intended — confirms that "surface uncertainty rather than guess" holds up under real use, not just in my own testing.
**Product response:** none needed; recorded here as validation of an existing guardrail, not a bug.

### 4. Preference vs. decision was initially mishandled — the most important finding
**Observation:** in a test meeting about scheduling, one person's preference and another's conflicting preference — with a third person explicitly saying to test both before deciding — got extracted as a finalized decision.
**Impact:** this directly violates the core promise of the product ("don't invent information that wasn't actually agreed"). It's the single most important thing this testing round found.
**Product response:** a full guardrail fix — see `docs/PRODUCT-DECISIONS.md` and the failure story below.

### 5. Explicit deferral ("pending legal approval") was correctly recognized as not-yet-decided
**Observation:** when a statement explicitly deferred a decision pending another condition, the system correctly held it as unresolved rather than treating the discussion as final.
**Impact:** confirms the deferral-detection guardrail generalizes past the specific case that motivated it.
**Product response:** none needed; recorded as validation.

### 6. Conflicting options should not be automatically turned into a decision
**Observation:** the general pattern behind finding #4 — when people propose different options and the room doesn't converge, the system shouldn't pick one and call it settled.
**Impact:** reinforced that conflict detection and preference-vs-decision detection are closely related guardrails, not one bug — both come from the same underlying principle.
**Product response:** covered by the same guardrail work as #4.

## The critical failure, in detail

**Preference ≠ Decision.**

The specific scenario: Sara preferred a 15-minute slot, Devraj preferred 5 minutes, and Marcus said they should test both before deciding anything. The system still extracted a "decision" for whichever option was mentioned most recently, instead of recognizing that nothing had actually been decided.

**What we learned:** real meeting conversations contain preferences, proposals, tentative plans, disagreements, deferrals, and finalized decisions — and these are not interchangeable. A system that treats "I'd prefer X" the same as "we're going with X" will confidently fabricate consensus that never happened.

**Product change:**

- Preference detection (tentative language: "I'd prefer," "maybe," "I think we should")
- Deferral detection (explicit "let's decide after X," "before deciding")
- Deterministic post-processing that runs regardless of what the AI candidate said
- Demotion of unresolved decisions into open-question / needs-review states
- Evidence is preserved through the demotion — the item doesn't lose its grounding, it loses its false certainty

**Validation:** targeted retest of the specific failure cases from user testing passed after the fix. Automated regression tests: **41/41 passing.** The full 18-transcript production evaluation in `docs/EVALUATION.md` was **not** rerun after this fix — that's stated explicitly there too, so the two documents don't contradict each other.

This is the clearest example in the whole project of the loop actually closing: **real user testing → a genuine failure → a product insight → a guardrail → an implementation → validation.**
