// Regression tests for the four production issues found by the Gemini-path
// evaluation (T01/T10/T13/T16/T17): conflict collapse, multi-owner
// ambiguity, self-commitment ownership, and lost supersession history.
//
// These test the deterministic candidate -> item pipeline directly (no
// live Gemini call, no API key needed) by constructing RawCandidate[]
// objects the way a real Gemini response would be shaped after schema
// parsing, and real TranscriptTurn[] via the app's own parseTranscript —
// exactly the inputs buildItemFromCandidate / applyConflictAndSupersession
// receive from extractWithAI in production.
import { describe, expect, it } from "vitest";
import {
  applyConflictAndSupersession,
  buildItemFromCandidate,
  createCodeGenerator,
  dedupeItems,
  demoteUnresolvedDecisions,
  resolveOwner,
} from "./extract";
import { parseTranscript, extractExecutionItems, isClearSelfCommitment } from "../extraction";
import type { RawCandidate } from "./schema";
import type { TranscriptTurn } from "../types";

function turnsFrom(raw: string): TranscriptTurn[] {
  return parseTranscript(raw);
}

function candidate(overrides: Partial<RawCandidate>): RawCandidate {
  return {
    type: "action",
    title: "Untitled",
    description: null,
    owner_mentions: [],
    deadline_phrase: null,
    priority_hint: null,
    evidence: [],
    related_to: null,
    ...overrides,
  };
}

function buildAll(turns: TranscriptTurn[], candidates: RawCandidate[], meetingId = "mtg-test") {
  const turnsById = new Map(turns.map((t) => [t.id, t] as const));
  const speakers = Array.from(new Set(turns.map((t) => t.speaker)));
  const nextCode = createCodeGenerator();
  const items = candidates
    .map((c) => buildItemFromCandidate(c, turnsById, speakers, meetingId, nextCode))
    .filter((it): it is NonNullable<typeof it> => it !== null);
  const deduped = dedupeItems(items);
  applyConflictAndSupersession(deduped, turns, meetingId, nextCode);
  demoteUnresolvedDecisions(deduped, turns, nextCode);
  return deduped;
}

describe("Fix 3 — self-commitment ownership", () => {
  it("A. speaker attribution: \"I'll have the fix out by Wednesday.\" -> owner is the speaker", () => {
    const turns = turnsFrom(`Devraj: I'll have the fix out by Wednesday.`);
    const items = buildAll(turns, [
      candidate({
        type: "action",
        title: "Fix the bug",
        owner_mentions: [],
        deadline_phrase: "Wednesday",
        evidence: [{ turn_id: turns[0].id, quote: "I'll have the fix out by Wednesday." }],
      }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].owner).toBe("Devraj");
    expect(items[0].deadline).toBe("Wednesday");
    expect(items[0].ambiguityFlags.some((f) => f.type === "owner_unclear")).toBe(false);
  });

  it("B. explicit owner still resolves via named-mention logic: \"Sara, can you send the report by Friday?\"", () => {
    const turns = turnsFrom(`Sara: Sure, I'm around.\nPriya: Sara, can you send the report by Friday?`);
    const items = buildAll(turns, [
      candidate({
        type: "action",
        title: "Send the report",
        owner_mentions: ["Sara"],
        deadline_phrase: "Friday",
        evidence: [{ turn_id: turns[1].id, quote: "Sara, can you send the report by Friday?" }],
      }),
    ]);
    expect(items[0].owner).toBe("Sara");
    expect(items[0].ambiguityFlags.some((f) => f.type === "owner_unclear")).toBe(false);
  });

  it("H. relative deadline: \"I'll have the fix out tomorrow.\" -> owner resolved, deadline flagged relative, no fabricated date", () => {
    const turns = turnsFrom(`Devraj: I'll have the fix out tomorrow.`);
    const items = buildAll(turns, [
      candidate({
        type: "action",
        title: "Fix the bug",
        deadline_phrase: "tomorrow",
        evidence: [{ turn_id: turns[0].id, quote: "I'll have the fix out tomorrow." }],
      }),
    ]);
    expect(items[0].owner).toBe("Devraj");
    expect(items[0].deadline).toBe("tomorrow");
    expect(items[0].deadlineConfirmed).toBe(false);
    expect(items[0].ambiguityFlags.some((f) => f.type === "deadline_unclear")).toBe(true);
    // never a fabricated absolute/ISO date anywhere on the item
    expect(items[0].deadline).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("does NOT attribute ownership for hedged/generic discussion", () => {
    const cases = [
      "I think we should look into this.",
      "Maybe I'll take that.",
      "Someone should probably handle this.",
      "We could look at that later.",
      "I don't know if I can make it work.",
    ];
    for (const text of cases) {
      expect(isClearSelfCommitment(text)).toBe(false);
    }
  });

  it("J. does not extract false actions from banter/acknowledgement (deterministic layer)", () => {
    const turns = turnsFrom(
      `Priya: Please note that the meeting moved to 3pm.\nDevraj: Sara, that's a great point.`
    );
    const { items } = extractExecutionItems(turns, "mtg-test");
    expect(items.some((i) => i.type === "action")).toBe(false);
  });
});

describe("Fix 2 — multi-person owner ambiguity", () => {
  it("C. three candidate owners -> owner unclear, all candidates preserved, none chosen", () => {
    const turns = turnsFrom(
      `Priya: Tom could take this. Arjun also offered. Devraj said he can handle it.`
    );
    const items = buildAll(turns, [
      candidate({
        type: "action",
        title: "Migrate the CI runner",
        owner_mentions: ["Tom", "Arjun", "Devraj"],
        evidence: [
          { turn_id: turns[0].id, quote: "Tom could take this." },
          { turn_id: turns[0].id, quote: "Arjun also offered." },
          { turn_id: turns[0].id, quote: "Devraj said he can handle it." },
        ],
      }),
    ]);
    expect(items[0].owner).toBeUndefined();
    expect(items[0].ownerCandidates).toEqual(expect.arrayContaining(["Tom", "Arjun", "Devraj"]));
    expect(items[0].ownerCandidates).toHaveLength(3);
    expect(items[0].ambiguityFlags.some((f) => f.type === "owner_unclear")).toBe(true);
  });

  it("resolveOwner unit: zero, one, and many mentions", () => {
    expect(resolveOwner([], "no names here", ["Sara"], ["Sara"], "action").owner).toBeUndefined();

    const single = resolveOwner(["Sara"], "Sara said she'd do it", ["Sara", "Tom"], ["Priya"], "action");
    expect(single.owner).toBe("Sara");

    const multi = resolveOwner(["Tom", "Arjun"], "Tom and Arjun both offered", ["Tom", "Arjun", "Devraj"], ["Priya"], "action");
    expect(multi.owner).toBeUndefined();
    expect(multi.ownerCandidates).toEqual(expect.arrayContaining(["Tom", "Arjun"]));
  });

  it("never invents a candidate that doesn't appear in the evidence text", () => {
    const result = resolveOwner(["Ghost Person"], "nothing relevant here", ["Sara"], ["Sara"], "action");
    expect(result.owner).toBeUndefined();
    expect(result.ownerCandidates).toEqual(["Ghost Person"]);
    expect(result.flags[0].message).toMatch(/does not appear in the verified evidence/);
  });
});

describe("Fix 1 — conflict preserved even when Gemini collapses it into one candidate", () => {
  it("D. declarative conflict recovered from the transcript when only ONE summarizing candidate is returned", () => {
    const turns = turnsFrom(
      `Meera: Notifications should be on by default.\nArjun: No, they should be off by default.`
    );
    // Simulates the observed Gemini failure mode: a single item citing only
    // one side, no second candidate for the pairwise pass to match against.
    const items = buildAll(turns, [
      candidate({
        type: "risk",
        title: "Conflicting notification default settings",
        evidence: [{ turn_id: turns[0].id, quote: "Notifications should be on by default." }],
      }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].conflict).toBeDefined();
    expect(items[0].conflict!.positions).toHaveLength(2);
    expect(items[0].conflict!.resolved).toBe(false);
    expect(items[0].status).toBe("needs_review");
    // never silently picks a side
    const stances = items[0].conflict!.positions.map((p) => p.stance);
    expect(stances).toEqual(expect.arrayContaining(["On", "Off"]));
  });

  it("E. existing two-candidate conflict path still works, exactly one conflict, no duplicate", () => {
    const turns = turnsFrom(
      `Meera: Notifications should be on by default.\nArjun: No, they should be off by default.`
    );
    const items = buildAll(turns, [
      candidate({
        type: "question",
        title: "Should notifications default on or off?",
        evidence: [{ turn_id: turns[0].id, quote: "Notifications should be on by default." }],
      }),
      candidate({
        type: "question",
        title: "Notifications should default off",
        evidence: [{ turn_id: turns[1].id, quote: "No, they should be off by default." }],
      }),
    ]);
    const withConflict = items.filter((i) => i.conflict);
    expect(withConflict).toHaveLength(1); // not duplicated by the Fix 1 fallback
    expect(withConflict[0].conflict!.positions).toHaveLength(2);
  });

  it("does not invent a conflict from unrelated statements", () => {
    const turns = turnsFrom(
      `Meera: Notifications should be on by default.\nArjun: The deploy pipeline is off today for maintenance.`
    );
    const items = buildAll(turns, [
      candidate({
        type: "risk",
        title: "Notification defaults",
        evidence: [{ turn_id: turns[0].id, quote: "Notifications should be on by default." }],
      }),
    ]);
    expect(items[0].conflict).toBeUndefined();
  });
});

describe("Fix 4 — superseded decisions are preserved, not dropped", () => {
  it("F. original decision recovered from the transcript and linked both ways when Gemini only returns the final one", () => {
    const turns = turnsFrom(
      `Priya: We decided on the fully custom approach.\nPriya: Actually, let's drop that and use the markdown approach instead.`
    );
    const items = buildAll(turns, [
      candidate({
        type: "decision",
        title: "Use the markdown approach",
        evidence: [{ turn_id: turns[1].id, quote: "Actually, let's drop that and use the markdown approach instead." }],
      }),
    ]);
    const decisions = items.filter((i) => i.type === "decision");
    expect(decisions).toHaveLength(2); // both preserved
    const final = decisions.find((d) => d.supersedes);
    const original = decisions.find((d) => d.supersededBy);
    expect(final).toBeDefined();
    expect(original).toBeDefined();
    expect(final!.supersedes!.previousTitle).toBe(original!.title);
    expect(original!.supersededBy!.title).toBe(final!.title);
  });

  it("G. refinement, not a reversal (T17-style) — does NOT create a supersession", () => {
    const turns = turnsFrom(
      `Priya: Sounds like we're refining the plan, not reversing it — markdown-based generator stays, with added custom styling.`
    );
    const items = buildAll(turns, [
      candidate({
        type: "decision",
        title: "Refine the changelog page plan",
        evidence: [
          {
            turn_id: turns[0].id,
            quote:
              "Sounds like we're refining the plan, not reversing it — markdown-based generator stays, with added custom styling.",
          },
        ],
      }),
    ]);
    expect(items).toHaveLength(1); // no phantom original decision synthesized
    expect(items[0].supersedes).toBeUndefined();
  });

  it("does not link a supersession when there is no earlier decision-sounding sentence at all", () => {
    const turns = turnsFrom(
      `Priya: Let's switch to the managed queue instead of the polling table.`
    );
    const items = buildAll(turns, [
      candidate({
        type: "decision",
        title: "Use the managed queue",
        evidence: [{ turn_id: turns[0].id, quote: "Let's switch to the managed queue instead of the polling table." }],
      }),
    ]);
    expect(items[0].supersedes).toBeUndefined();
  });
});

describe("Fix 1/2/3 — evidence integrity is never weakened", () => {
  it("I. every generated item's evidence is an exact substring of the cited transcript turn", () => {
    const turns = turnsFrom(`Devraj: I'll have the fix out by Wednesday.`);
    const items = buildAll(turns, [
      candidate({
        type: "action",
        title: "Fix the bug",
        evidence: [{ turn_id: turns[0].id, quote: "I'll have the fix out by Wednesday." }],
      }),
    ]);
    for (const item of items) {
      for (const e of item.evidence) {
        const turn = turns.find((t) => e.turnIds.includes(t.id));
        expect(turn).toBeDefined();
        expect(turn!.text).toContain(e.quote);
      }
    }
  });

  it("discards a candidate whose cited quote does not actually appear in the turn (hallucinated evidence)", () => {
    const turns = turnsFrom(`Devraj: I'll have the fix out by Wednesday.`);
    const turnsById = new Map(turns.map((t) => [t.id, t] as const));
    const speakers = Array.from(new Set(turns.map((t) => t.speaker)));
    const nextCode = createCodeGenerator();
    const item = buildItemFromCandidate(
      candidate({
        type: "action",
        title: "Fabricated item",
        evidence: [{ turn_id: turns[0].id, quote: "This sentence was never said." }],
      }),
      turnsById,
      speakers,
      "mtg-test",
      nextCode
    );
    expect(item).toBeNull();
  });

  it("a grounded mention that matches no known speaker still surfaces as an unverified candidate, not a chosen owner", () => {
    // Regression guard for Fix 2: a name that's proposed and appears in the
    // evidence, but isn't actually one of the meeting's known speakers,
    // must not be silently trusted as owner or dropped.
    const result = resolveOwner(
      ["Ghost Person"],
      "Ghost Person offered to help with this.",
      ["Priya", "Tom"],
      ["Priya"],
      "action"
    );
    expect(result.owner).toBeUndefined();
    expect(result.ownerCandidates).toEqual(["Ghost Person"]);
  });
});

describe("post-fix production-path findings — regression coverage", () => {
  it("does not flag a plain 'let's go with option B' style decision as a conflict (T01 false-positive found during production testing)", () => {
    const turns = turnsFrom(
      `Arjun: Option A is Redis, Option B is in-memory with a scheduled refresh. Given our traffic, I think in-memory is simpler.\nPriya: Okay, let's go with Option B then — in-memory caching with scheduled refresh.`
    );
    const items = buildAll(turns, [
      candidate({
        type: "decision",
        title: "Use Option B in-memory caching",
        evidence: [{ turn_id: turns[1].id, quote: "Okay, let's go with Option B then — in-memory caching with scheduled refresh." }],
      }),
    ]);
    expect(items[0].conflict).toBeUndefined();
  });

  it("detects the on/off-default conflict using real T10 phrasing (\"should default to 'on'\" / \"defaults should be 'off'\"), not just \"X by default\"", () => {
    const turns = turnsFrom(
      `Meera: All notification categories should default to "on" for new users.\nArjun: I thought we agreed defaults should be "off" except for critical alerts.`
    );
    const items = buildAll(turns, [
      candidate({
        type: "question",
        title: "Notification default state",
        evidence: [{ turn_id: turns[0].id, quote: `All notification categories should default to "on" for new users.` }],
      }),
    ]);
    expect(items[0].conflict).toBeDefined();
    expect(items[0].conflict!.positions.map((p) => p.stance)).toEqual(expect.arrayContaining(["On", "Off"]));
  });

  it("resolves ownership when Gemini's proposed name is ungrounded but agrees with the sole self-committing speaker (T13 production finding)", () => {
    const turns = turnsFrom(`Devraj: Test plan's ready, we start execution Monday.`);
    const items = buildAll(turns, [
      candidate({
        type: "action",
        title: "Start execution of test plan",
        owner_mentions: ["Devraj"],
        evidence: [{ turn_id: turns[0].id, quote: "Test plan's ready, we start execution Monday." }],
      }),
    ]);
    expect(items[0].owner).toBe("Devraj");
    expect(items[0].ambiguityFlags.some((f) => f.type === "owner_unclear")).toBe(false);
  });

  it("still flags an ungrounded name that does NOT match the self-committing speaker (no false agreement)", () => {
    const turns = turnsFrom(`Devraj: Test plan's ready, we start execution Monday.`);
    const items = buildAll(turns, [
      candidate({
        type: "action",
        title: "Start execution of test plan",
        owner_mentions: ["Sara"],
        evidence: [{ turn_id: turns[0].id, quote: "Test plan's ready, we start execution Monday." }],
      }),
    ]);
    expect(items[0].owner).toBeUndefined();
    expect(items[0].ownerCandidates).toEqual(["Sara"]);
  });
});

describe("preference-vs-decision fix", () => {
  it("A. competing preferences (Sara 15 vs Devraj 5) with explicit deferral -> no final decision for either option", () => {
    const turns = turnsFrom(
      `Sara: I'd prefer fifteen.\nDevraj: Five minutes would be safer for stale data.\nMarcus: Let's test both options before deciding.`
    );
    const items = buildAll(turns, [
      candidate({
        type: "decision",
        title: "Use a 15 minute cache duration",
        evidence: [{ turn_id: turns[0].id, quote: "I'd prefer fifteen." }],
      }),
      candidate({
        type: "decision",
        title: "Use a 5 minute cache duration",
        evidence: [{ turn_id: turns[1].id, quote: "Five minutes would be safer for stale data." }],
      }),
    ]);
    expect(items.some((i) => i.type === "decision")).toBe(false);
    for (const item of items) {
      expect(item.type).toBe("question");
      expect(item.status).toBe("needs_review");
      expect(item.ambiguityFlags.some((f) => f.type === "needs_clarification")).toBe(true);
      // evidence preserved, not discarded
      expect(item.evidence.length).toBeGreaterThan(0);
    }
  });

  it("B. competing rollout percentages (10% vs 100%) deferred to legal sign-off -> no final rollout decision", () => {
    const turns = turnsFrom(
      `Rohan: Should we launch to everyone or start with 10 percent?\nMeera: I prefer 10 percent initially.\nKabir: I'm leaning toward everyone.\nMeera: Let's decide after legal signs off.`
    );
    const items = buildAll(turns, [
      candidate({
        type: "decision",
        title: "Launch to 10 percent of users",
        evidence: [{ turn_id: turns[1].id, quote: "I prefer 10 percent initially." }],
      }),
      candidate({
        type: "decision",
        title: "Launch to everyone",
        evidence: [{ turn_id: turns[2].id, quote: "I'm leaning toward everyone." }],
      }),
    ]);
    expect(items.some((i) => i.type === "decision")).toBe(false);
    expect(items.every((i) => i.type === "question")).toBe(true);
  });

  it("C. \"let's decide after legal signs off\" cited directly as decision evidence -> demoted, not a final decision", () => {
    const turns = turnsFrom(`Meera: Let's decide after legal signs off.`);
    const items = buildAll(turns, [
      candidate({
        type: "decision",
        title: "Launch pending legal sign-off",
        evidence: [{ turn_id: turns[0].id, quote: "Let's decide after legal signs off." }],
      }),
    ]);
    expect(items[0].type).toBe("question");
    expect(items[0].status).toBe("needs_review");
  });

  it("D. genuine finalized decision is still extracted as a decision", () => {
    const turns = turnsFrom(`Priya: Okay, let's go with PostgreSQL. That's our final choice.`);
    const items = buildAll(turns, [
      candidate({
        type: "decision",
        title: "Use PostgreSQL",
        evidence: [{ turn_id: turns[0].id, quote: "Okay, let's go with PostgreSQL. That's our final choice." }],
      }),
    ]);
    expect(items[0].type).toBe("decision");
    expect(items[0].title).toContain("PostgreSQL");
  });

  it("E. preference followed by an explicit decision in the same evidence -> final decision still stands", () => {
    const turns = turnsFrom(
      `Priya: I prefer PostgreSQL.\nPriya: Okay, we've decided to use PostgreSQL.`
    );
    const items = buildAll(turns, [
      candidate({
        type: "decision",
        title: "Use PostgreSQL",
        evidence: [
          { turn_id: turns[0].id, quote: "I prefer PostgreSQL." },
          { turn_id: turns[1].id, quote: "Okay, we've decided to use PostgreSQL." },
        ],
      }),
    ]);
    expect(items[0].type).toBe("decision");
    expect(items[0].title).toContain("PostgreSQL");
  });

  it("F. existing conflict regression: two genuinely opposing positions with no resolution are still surfaced as a conflict", () => {
    const turns = turnsFrom(
      `Meera: Notifications should be on by default.\nArjun: No, they should be off by default.`
    );
    const items = buildAll(turns, [
      candidate({
        type: "question",
        title: "Should notifications default on or off?",
        evidence: [{ turn_id: turns[0].id, quote: "Notifications should be on by default." }],
      }),
      candidate({
        type: "question",
        title: "Notifications should default off",
        evidence: [{ turn_id: turns[1].id, quote: "No, they should be off by default." }],
      }),
    ]);
    const withConflict = items.filter((i) => i.conflict);
    expect(withConflict).toHaveLength(1);
    expect(withConflict[0].conflict!.positions).toHaveLength(2);
    expect(withConflict[0].conflict!.resolved).toBe(false);
  });

  it("G. existing supersession regression: a genuine earlier decision that is explicitly reversed still preserves decision history", () => {
    const turns = turnsFrom(
      `Priya: We decided on the fully custom approach.\nPriya: Actually, let's drop that and use the markdown approach instead.`
    );
    const items = buildAll(turns, [
      candidate({
        type: "decision",
        title: "Use the markdown approach",
        evidence: [{ turn_id: turns[1].id, quote: "Actually, let's drop that and use the markdown approach instead." }],
      }),
    ]);
    const decisions = items.filter((i) => i.type === "decision");
    expect(decisions).toHaveLength(2);
    const final = decisions.find((d) => d.supersedes);
    const original = decisions.find((d) => d.supersededBy);
    expect(final).toBeDefined();
    expect(original).toBeDefined();
    expect(final!.supersedes!.previousTitle).toBe(original!.title);
  });

  it("does not demote a decision just because it is discussed further afterward, absent explicit reversal/deferral", () => {
    const turns = turnsFrom(
      `Priya: Let's go with PostgreSQL for the new service.\nArjun: Sounds good, I'll start setting up the schema.\nSara: Makes sense, Postgres has great JSON support too.`
    );
    const items = buildAll(turns, [
      candidate({
        type: "decision",
        title: "Use PostgreSQL for the new service",
        evidence: [{ turn_id: turns[0].id, quote: "Let's go with PostgreSQL for the new service." }],
      }),
    ]);
    expect(items[0].type).toBe("decision");
  });
});

describe("createCodeGenerator", () => {
  it("uses the AI-path offset ranges, distinguishable from the deterministic engine's own codes", () => {
    const next = createCodeGenerator();
    expect(next("action")).toBe("ACT-9501");
    expect(next("decision")).toBe("DEC-081");
    expect(next("question")).toBe("QUE-161");
    expect(next("risk")).toBe("RSK-041");
  });
});
