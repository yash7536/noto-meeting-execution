// Regression protection for the deterministic engine itself, since two
// shared helpers used by both the deterministic and AI paths were touched
// while fixing the Gemini-path evaluation findings: SUPERSEDE_RE (broadened
// "instead of" -> "instead") and detectDeclarativeStance (specific stance
// vocabulary now outranks a bare leading "Yes"/"No"). Neither of these
// pipeline-4 fixes touch extractExecutionItems' own logic — these tests
// confirm the deterministic engine's existing behavior still holds.
import { describe, expect, it } from "vitest";
import { extractExecutionItems, parseTranscript, detectDeclarativeStance, SUPERSEDE_RE } from "./extraction";

describe("preference-vs-decision fix — deterministic engine Rule B", () => {
  it("demotes a decision-sounding sentence to a question when the transcript explicitly defers it elsewhere", () => {
    const turns = parseTranscript(
      `Priya: Let's go with the fifteen minute cache duration.\nMarcus: Let's test both cache durations before deciding.`
    );
    const { items } = extractExecutionItems(turns, "mtg-test");
    expect(items.some((i) => i.type === "decision")).toBe(false);
    const demoted = items.find((i) => i.type === "question");
    expect(demoted).toBeDefined();
    expect(demoted!.status).toBe("needs_review");
    expect(demoted!.ambiguityFlags.some((f) => f.type === "needs_clarification")).toBe(true);
  });

  it("leaves a genuine decision alone when nothing in the transcript defers it", () => {
    const turns = parseTranscript(`Priya: Let's go with PostgreSQL for the new service.`);
    const { items } = extractExecutionItems(turns, "mtg-test");
    const decision = items.find((i) => i.type === "decision");
    expect(decision).toBeDefined();
    expect(decision!.title.toLowerCase()).toContain("postgresql");
  });
});

describe("deterministic engine — regression protection", () => {
  it("still extracts a clean self-commitment action with owner + deadline", () => {
    const turns = parseTranscript(`Devraj: I'll have the fix out by Wednesday.`);
    const { items } = extractExecutionItems(turns, "mtg-test");
    const action = items.find((i) => i.type === "action");
    expect(action).toBeDefined();
    expect(action!.owner).toBe("Devraj");
    expect(action!.deadline).toBe("Wednesday");
  });

  it("still resolves an explicit request-form owner", () => {
    const turns = parseTranscript(`Priya: Sara, can you send the report by Friday?`);
    const { items } = extractExecutionItems(turns, "mtg-test");
    const action = items.find((i) => i.type === "action");
    expect(action?.owner).toBe("Sara");
  });

  it("still does not extract false actions from banter/acknowledgement", () => {
    const turns = parseTranscript(
      `Priya: Please note that the meeting moved to 3pm.\nDevraj: Sara, that's a great point.`
    );
    const { items } = extractExecutionItems(turns, "mtg-test");
    expect(items.some((i) => i.type === "action")).toBe(false);
  });

  it("still detects a T03/T16-style reversal via the broadened SUPERSEDE_RE (bare \"instead\")", () => {
    expect(SUPERSEDE_RE.test("Let's switch to blue-green deployment instead for this one.")).toBe(true);
    expect(SUPERSEDE_RE.test("We'll go with the markdown-based static page approach instead, sounds like better ROI.")).toBe(true);
  });

  it("still leaves a genuine refinement (not a reversal) untouched by SUPERSEDE_RE", () => {
    expect(
      SUPERSEDE_RE.test(
        "Sounds like we're refining the plan, not reversing it — markdown-based generator stays, with added custom styling."
      )
    ).toBe(false);
  });

  it("question-anchored conflict detection (T10-style) still produces a single conflict item", () => {
    const turns = parseTranscript(
      `Sara: Should the toggle default to on or off?\nMeera: It should be on by default.\nArjun: No, it should be off by default.`
    );
    const { items } = extractExecutionItems(turns, "mtg-test");
    const withConflict = items.filter((i) => i.conflict);
    expect(withConflict).toHaveLength(1);
    expect(withConflict[0].conflict!.positions).toHaveLength(2);
  });

  it("declarative conflict detection still pairs opposing statements with no anchoring question", () => {
    const turns = parseTranscript(
      `Meera: Notifications should be on by default.\nArjun: No, they should be off by default.`
    );
    const { items } = extractExecutionItems(turns, "mtg-test");
    const withConflict = items.filter((i) => i.conflict);
    expect(withConflict).toHaveLength(1);
    const stances = withConflict[0].conflict!.positions.map((p) => p.stance);
    expect(stances).toEqual(expect.arrayContaining(["On", "Off"]));
  });

  it("detectDeclarativeStance: specific vocabulary outranks a leading generic Yes/No", () => {
    expect(detectDeclarativeStance("No, they should be off by default.")).toBe("Off");
    expect(detectDeclarativeStance("Yes, let's turn it on by default.")).toBe("On");
  });

  it("detectDeclarativeStance: bare Yes/No still resolves when nothing more specific is present", () => {
    expect(detectDeclarativeStance("Yes, I agree with that.")).toBe("Yes");
    expect(detectDeclarativeStance("No, I don't think so.")).toBe("No");
  });
});
