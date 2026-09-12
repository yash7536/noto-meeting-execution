import { NextRequest, NextResponse } from "next/server";
import { extractExecutionItems, extractParticipants, parseTranscript } from "@/lib/extraction";
import { extractWithAI } from "@/lib/ai/extract";
import type { AnalyzeResult, ExecutionItem, Meeting } from "@/lib/types";

// Server-side analysis endpoint. Tries the AI extraction layer
// (lib/ai/extract.ts, backed by the Gemini API) first when GEMINI_API_KEY
// is configured — it's a candidate generator whose output is
// validated/normalized against the transcript before ever reaching the
// client. If the key is missing, the API call fails or times out, the
// response is malformed, or validation leaves zero usable items, this
// falls back to the deterministic extraction + validation pipeline
// (lib/extraction.ts) — the app always stays usable without the API. No
// LLM API key is ever exposed to the browser; both paths run entirely
// server-side and return the exact same Meeting + ExecutionItem[] shape
// regardless of which one produced it.

export async function POST(req: NextRequest) {
  let body: {
    title?: string;
    team?: string;
    recordedDate?: string;
    transcriptRaw?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const title = (body.title ?? "").trim();
  const transcriptRaw = (body.transcriptRaw ?? "").trim();

  if (!title) {
    return NextResponse.json({ error: "Meeting title is required." }, { status: 400 });
  }
  if (!transcriptRaw || transcriptRaw.split(/\s+/).length < 5) {
    return NextResponse.json(
      { error: "Transcript is required and must contain at least a few sentences." },
      { status: 400 }
    );
  }

  const turns = parseTranscript(transcriptRaw);
  if (turns.length === 0) {
    return NextResponse.json(
      { error: "Could not parse any speaker turns from the transcript." },
      { status: 422 }
    );
  }

  const participants = extractParticipants(turns);
  const id = `mtg-${Date.now().toString(36)}`;

  let items: ExecutionItem[];
  try {
    const aiResult = await extractWithAI(turns, id);
    if (aiResult.ok) {
      items = aiResult.items;
      if (process.env.NODE_ENV !== "production") {
        console.log(
          `[analyze] AI extraction succeeded (${aiResult.candidatesAccepted}/${aiResult.candidatesReturned} candidates accepted).`
        );
      }
    } else {
      if (process.env.NODE_ENV !== "production") {
        console.log("[analyze] AI extraction unavailable, using deterministic fallback:", aiResult.reason);
      }
      items = extractExecutionItems(turns, id).items;
    }
  } catch (err) {
    // Belt-and-suspenders: any unexpected throw from the AI path (network,
    // SDK, or a bug in the validation layer) must never break analysis —
    // fall back to the deterministic engine exactly as if the key were
    // simply absent.
    if (process.env.NODE_ENV !== "production") {
      console.log("[analyze] AI extraction threw, using deterministic fallback:", err instanceof Error ? err.message : err);
    }
    items = extractExecutionItems(turns, id).items;
  }

  const durationSeconds = (() => {
    const [h, m, s] = turns[turns.length - 1].timestamp.split(":").map(Number);
    return h * 3600 + m * 60 + s;
  })();

  const meeting: Meeting = {
    id,
    title,
    team: body.team?.trim() || "Product & Engineering",
    recordedDate: body.recordedDate || new Date().toISOString().slice(0, 10),
    durationMinutes: Math.max(1, Math.round(durationSeconds / 60)) || Math.max(5, turns.length * 1.5),
    transcriptRaw,
    transcriptTurns: turns,
    participants,
    // Extracted items are always AI proposals — the meeting only leaves
    // "needs review" once a human approves the plan (see approveMeetingPlan).
    status: "needs_review",
    createdAt: new Date().toISOString(),
  };

  const result: AnalyzeResult = { meeting, items };
  return NextResponse.json(result satisfies AnalyzeResult);
}
