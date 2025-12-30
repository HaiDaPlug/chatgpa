// Purpose: Server-side grading logic for API (Node ESM compatible)
// Migrated from: web/src/lib/grader.ts
// Contract: gradeSubmission(questions, responses) -> { percent, breakdown, summary }
// Notes: Uses heuristics for MCQ + fuzzy for short answers; optional OpenAI for feedback

import OpenAI from "openai";
import { detectModelFamily, buildOpenAIParams } from "./ai-router.js";

// ---- Types (align with quiz schema) ----
export type MCQ = {
  id: string;
  type: "mcq";
  prompt: string;
  options: string[];
  answer?: string; // correct choice
  explanation?: string; // optional author-provided
};

export type ShortQ = {
  id: string;
  type: "short";
  prompt: string;
  answer?: string; // optional reference text
};

export type Question = MCQ | ShortQ;

export type BreakdownItem = {
  id: string;
  type: "mcq" | "short";
  prompt: string;
  user_answer: string;
  correct: boolean;
  correct_answer?: string;      // for MCQ or if reference exists
  feedback: string;             // human-friendly explanation
  improvement?: string;         // concrete tip for next time
};

export type GradeOutput = {
  percent: number;              // 0..100
  correctCount: number;
  total: number;
  breakdown: BreakdownItem[];
  summary: string;              // brief overall advice
};

// ---- string helpers ----
function normalize(t: string) {
  return t.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
function eqLoose(a: string, b: string) {
  return normalize(a) === normalize(b);
}
function jaccard(a: string, b: string) {
  const A = new Set(normalize(a).split(" ").filter(Boolean));
  const B = new Set(normalize(b).split(" ").filter(Boolean));
  if (A.size === 0 && B.size === 0) return 1;
  const inter = [...A].filter((x) => B.has(x)).length;
  const union = new Set([...A, ...B]).size;
  return inter / union;
}

// ---- Model env helper (serverless-safe) ----
function modelEnv(name: string, fallback: string = "gpt-4o-mini"): string {
  const v = process.env[name];
  return (v && String(v).trim().length > 0) ? String(v) : fallback;
}

// ---- Optional OpenAI helpers ----
async function aiShortFeedbackBatch(
  shorts: ShortQ[],
  responses: Record<string, string>,
  apiKey?: string
): Promise<Record<string, { correct: boolean; feedback: string; improvement: string }>> {
  if (!apiKey || shorts.length === 0) return {};

  const client = new OpenAI({ apiKey });

  // Compact grading prompt - only essential info
  const items = shorts.map((q) => ({
    id: q.id,
    q: q.prompt,
    ref: q.answer ?? "",
    ans: responses[q.id] ?? "",
  }));

  // Light telemetry for grading token usage
  const promptStr = JSON.stringify(items);
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      action: 'grade_ai',
      question_count: shorts.length,
      prompt_chars: promptStr.length,
      estimated_tokens: Math.round(promptStr.length / 4),
      message: 'AI grading short answers'
    })
  );

  const model = modelEnv("OPENAI_GRADE_MODEL", "gpt-4o-mini");
  const maxTokens = Math.min(512, 64 + shorts.length * 64); // Scale with question count, cap at 512
  const modelFamily = detectModelFamily(model);

  const res = await client.chat.completions.create({
    model,
    ...buildOpenAIParams(modelFamily, maxTokens, 0.1),
    messages: [
      {
        role: "user",
        content:
          "Grade these short answers. Return JSON: {results:[{id,correct:boolean,feedback:string,improvement:string}]}.\n" +
          JSON.stringify(items),
      },
    ],
    response_format: { type: "json_object" as const },
  });

  try {
    const raw = res.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);
    const out: Record<
      string,
      { correct: boolean; feedback: string; improvement: string }
    > = {};
    for (const r of parsed?.results ?? []) {
      if (!r?.id) continue;
      out[r.id] = {
        correct: !!r.correct,
        feedback: typeof r.feedback === "string" ? r.feedback : "",
        improvement: typeof r.improvement === "string" ? r.improvement : "",
      };
    }
    return out;
  } catch {
    return {};
  }
}

export async function gradeSubmission(
  questions: Question[],
  responses: Record<string, string>
): Promise<GradeOutput> {
  const breakdown: BreakdownItem[] = [];
  let correct = 0;

  const mcqs = questions.filter((q): q is MCQ => q.type === "mcq");
  const shorts = questions.filter((q): q is ShortQ => q.type === "short");

  // 1) Grade MCQs (deterministic)
  for (const q of mcqs) {
    const user = (responses[q.id] ?? "").toString();
    const isCorrect = !!q.answer && eqLoose(user, q.answer);
    if (isCorrect) correct++;
    breakdown.push({
      id: q.id,
      type: "mcq",
      prompt: q.prompt,
      user_answer: user,
      correct: isCorrect,
      correct_answer: q.answer,
      feedback: isCorrect
        ? "Correct — matches the key."
        : q.explanation
        ? `Incorrect. ${q.explanation}`
        : "Incorrect. Review the concept and why the correct option fits better.",
      improvement: isCorrect ? undefined : "Re-read the prompt and eliminate distractors before choosing.",
    });
  }

  // 2) Grade short answers
  const withRef = shorts.filter((q) => q.answer && q.answer.trim().length > 0);
  const withoutRef = shorts.filter((q) => !q.answer || !q.answer.trim());

  // 2a) With reference: fuzzy
  for (const q of withRef) {
    const user = (responses[q.id] ?? "").toString();
    const ref = q.answer as string;
    const isCorrect = eqLoose(user, ref) || jaccard(user, ref) >= 0.6;
    if (isCorrect) correct++;
    breakdown.push({
      id: q.id,
      type: "short",
      prompt: q.prompt,
      user_answer: user,
      correct: isCorrect,
      correct_answer: ref,
      feedback: isCorrect
        ? "Good — your answer matches the reference closely."
        : "Your answer misses key elements compared to the reference.",
      improvement: isCorrect
        ? undefined
        : "Mention the missing key terms and define them briefly to tighten your answer.",
    });
  }

  // 2b) Without reference: optional AI pass
  let aiVerdicts: Record<
    string,
    { correct: boolean; feedback: string; improvement: string }
  > = {};
  try {
    aiVerdicts = await aiShortFeedbackBatch(withoutRef, responses, process.env.OPENAI_API_KEY);
  } catch {
    // ignore AI errors — we'll fallback to heuristic "not enough info"
  }

  for (const q of withoutRef) {
    const user = (responses[q.id] ?? "").toString();
    const ai = aiVerdicts[q.id];
    const isCorrect = ai ? !!ai.correct : false;
    if (isCorrect) correct++;

    breakdown.push({
      id: q.id,
      type: "short",
      prompt: q.prompt,
      user_answer: user,
      correct: isCorrect,
      feedback: ai?.feedback || "Graded without a reference. Provide clear definitions and reasoning.",
      improvement:
        ai?.improvement ||
        "Structure your answer: definition → key points → brief example to show understanding.",
    });
  }

  const total = questions.length || 1;
  const percent = Math.max(0, Math.min(100, Math.round((correct / total) * 100)));

  // Build short overall summary
  const summary =
    percent >= 85
      ? "Great work — strong grasp overall. Skim the few missed concepts."
      : percent >= 70
      ? "Solid base — focus revisions on the questions you missed."
      : "You're close — review fundamentals and key terms, then retake a focused quiz.";

  return { percent, correctCount: correct, total, breakdown, summary };
}
