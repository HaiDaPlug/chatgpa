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
  score?: number;               // ✅ P1: 0-1 granular score for semantic grading
  correct_answer?: string;      // for MCQ or if reference exists
  feedback: string;             // human-friendly explanation
  improvement?: string;         // concrete tip for next time
  missing_terms?: string[];     // ✅ P1: terms missing from answer (for semantic feedback)
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

// ✅ P1: Score clamping helper - prevents weird 1.2 or -0.1 edge cases
function clampScore(s: number): number {
  return Math.round(Math.max(0, Math.min(1, s)) * 100) / 100;
}

// ✅ P1: AI semantic grading result type
interface AIGradingResult {
  id: string;
  score: number;
  band: 'correct' | 'mostly_correct' | 'partial' | 'incorrect';
  why: string;
  improvements?: string[];
  missing_terms?: string[];
  misconception?: string | null;
}

// ✅ P1: Semantic AI grading for short answers
async function aiSemanticGradingBatch(
  shorts: ShortQ[],
  responses: Record<string, string>,
  apiKey?: string
): Promise<Record<string, AIGradingResult>> {
  if (!apiKey || shorts.length === 0) return {};

  const client = new OpenAI({ apiKey });

  // Build items with reference answer for semantic grading
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
      action: 'grade_ai_semantic',
      question_count: shorts.length,
      prompt_chars: promptStr.length,
      estimated_tokens: Math.round(promptStr.length / 4),
      message: 'AI semantic grading short answers'
    })
  );

  const model = modelEnv("OPENAI_GRADE_MODEL", "gpt-4o-mini");
  const maxTokens = Math.min(1024, 128 + shorts.length * 128); // More tokens for richer feedback
  const modelFamily = detectModelFamily(model);

  const systemPrompt = `Grade these short answers semantically.
Use "ref" as the ground truth; accept paraphrases of ref.
Return JSON: {"results":[{
  "id": string,
  "score": number (0-1),
  "band": "correct"|"mostly_correct"|"partial"|"incorrect",
  "why": string (1 sentence),
  "improvements": string[],
  "missing_terms": string[],
  "misconception": string|null
}]}

Scoring guide:
- 1.0: Perfect or near-perfect (exact match OR complete paraphrase)
- 0.75-0.99: Correct concept, minor terminology gaps (list missing_terms)
- 0.30-0.74: Partial understanding, key concepts missing
- 0.0-0.29: Wrong or off-topic`;

  const res = await client.chat.completions.create({
    model,
    ...buildOpenAIParams(modelFamily, maxTokens, 0.1),
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: JSON.stringify(items),
      },
    ],
    response_format: { type: "json_object" as const },
  });

  const raw = res.choices[0]?.message?.content ?? "{}";

  // ✅ P1: Validate AI response shape - don't silently fail
  let parsed: { results?: unknown[] };
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.warn('AI grading JSON parse failed:', e);
    throw new Error('AI_GRADING_PARSE_ERROR: Invalid JSON from model');
  }

  if (!parsed?.results || !Array.isArray(parsed.results)) {
    console.warn('AI grading missing results array:', parsed);
    throw new Error('AI_GRADING_PARSE_ERROR: Missing results array');
  }

  const out: Record<string, AIGradingResult> = {};
  for (const r of parsed.results) {
    if (!r || typeof r !== 'object' || !('id' in r)) continue;
    const item = r as Record<string, unknown>;

    // Validate required fields
    const id = String(item.id ?? '');
    const rawScore = Number(item.score);
    const band = String(item.band ?? 'incorrect');
    const why = String(item.why ?? '');

    if (!id || isNaN(rawScore)) continue;

    // Validate band is one of the allowed values
    const validBands = ['correct', 'mostly_correct', 'partial', 'incorrect'] as const;
    const validatedBand = validBands.includes(band as typeof validBands[number])
      ? (band as AIGradingResult['band'])
      : 'incorrect';

    out[id] = {
      id,
      score: clampScore(rawScore),
      band: validatedBand,
      why,
      improvements: Array.isArray(item.improvements)
        ? item.improvements.map(String)
        : [],
      missing_terms: Array.isArray(item.missing_terms)
        ? item.missing_terms.map(String)
        : [],
      misconception: typeof item.misconception === 'string' ? item.misconception : null,
    };
  }

  return out;
}

export async function gradeSubmission(
  questions: Question[],
  responses: Record<string, string>
): Promise<GradeOutput> {
  const breakdown: BreakdownItem[] = [];
  let correctCount = 0;
  let totalScore = 0;

  const mcqs = questions.filter((q): q is MCQ => q.type === "mcq");
  const shorts = questions.filter((q): q is ShortQ => q.type === "short");

  // 1) Grade MCQs (deterministic - exact match)
  for (const q of mcqs) {
    const user = (responses[q.id] ?? "").toString();
    const isCorrect = !!q.answer && eqLoose(user, q.answer);
    const score = isCorrect ? 1.0 : 0.0;
    if (isCorrect) correctCount++;
    totalScore += score;

    breakdown.push({
      id: q.id,
      type: "mcq",
      prompt: q.prompt,
      user_answer: user,
      correct: isCorrect,
      score, // ✅ P1: Add score for MCQs too
      correct_answer: q.answer,
      feedback: isCorrect
        ? "Correct — matches the key."
        : q.explanation
        ? `Incorrect. ${q.explanation}`
        : "Incorrect. Review the concept and why the correct option fits better.",
      improvement: isCorrect ? undefined : "You got it next time!",
    });
  }

  // 2) ✅ P1: Grade short answers with HYBRID approach (cost guard)
  const withRef = shorts.filter((q) => q.answer && q.answer.trim().length > 0);
  const needsAiGrading: ShortQ[] = [];

  for (const q of withRef) {
    const user = (responses[q.id] ?? "").toString();
    const ref = q.answer as string;

    // Gate 1: Exact normalized match → 1.0, skip AI
    if (eqLoose(user, ref)) {
      correctCount++;
      totalScore += 1.0;
      breakdown.push({
        id: q.id,
        type: "short",
        prompt: q.prompt,
        user_answer: user,
        correct: true,
        score: 1.0,
        correct_answer: ref,
        feedback: "Perfect match.",
      });
      continue;
    }

    // Gate 2: High similarity → 0.85, shows as "Mostly Correct"
    // ✅ Safe - doesn't auto-claim perfect, covers edge cases
    if (jaccard(user, ref) >= 0.6) {
      totalScore += 0.85;
      // correct: false - similarity can be wrong in edge cases
      breakdown.push({
        id: q.id,
        type: "short",
        prompt: q.prompt,
        user_answer: user,
        correct: false, // Not auto-claiming perfect
        score: 0.85,
        correct_answer: ref,
        feedback: "Mostly correct (high similarity to reference).",
      });
      continue;
    }

    // Gate 3: AI semantic grading for non-obvious cases
    needsAiGrading.push(q);
  }

  // Also include questions without reference for AI grading
  const withoutRef = shorts.filter((q) => !q.answer || !q.answer.trim());
  needsAiGrading.push(...withoutRef);

  // Batch AI call only for needsAiGrading
  let aiVerdicts: Record<string, AIGradingResult> = {};
  try {
    aiVerdicts = await aiSemanticGradingBatch(needsAiGrading, responses, process.env.OPENAI_API_KEY);
  } catch (e) {
    // ✅ P1: If AI fails, throw retryable error (don't silently mark incorrect)
    const errorMessage = e instanceof Error ? e.message : String(e);
    if (errorMessage.includes('AI_GRADING_PARSE_ERROR')) {
      throw e; // Re-throw parse errors for retry
    }
    // For network errors etc., fall back to conservative grading
    console.warn('AI semantic grading failed, using fallback:', errorMessage);
  }

  // Process AI-graded questions
  for (const q of needsAiGrading) {
    const user = (responses[q.id] ?? "").toString();
    const ref = q.answer ?? "";
    const ai = aiVerdicts[q.id];

    if (ai) {
      // ✅ P1: Map AI score to correct boolean - STRICT mapping
      const isCorrect = ai.score >= 0.90;
      if (isCorrect) correctCount++;
      totalScore += ai.score;

      breakdown.push({
        id: q.id,
        type: "short",
        prompt: q.prompt,
        user_answer: user,
        correct: isCorrect,
        score: ai.score,
        correct_answer: ref || undefined,
        feedback: ai.why || "Graded by AI semantic analysis.",
        improvement: ai.improvements?.length
          ? ai.improvements.join(" ")
          : undefined,
        missing_terms: ai.missing_terms,
      });
    } else {
      // Fallback: no AI result, mark as needing review
      totalScore += 0.0;
      breakdown.push({
        id: q.id,
        type: "short",
        prompt: q.prompt,
        user_answer: user,
        correct: false,
        score: 0.0,
        correct_answer: ref || undefined,
        feedback: "Unable to grade semantically. Please review your answer.",
        improvement: "Structure your answer: definition → key points → brief example.",
      });
    }
  }

  const total = questions.length || 1;
  const percent = Math.max(0, Math.min(100, Math.round((totalScore / total) * 100)));

  // Build short overall summary
  const summary =
    percent >= 85
      ? "Great work — strong grasp overall. Skim the few missed concepts."
      : percent >= 70
      ? "Solid base — focus revisions on the questions you missed."
      : "You're close — review fundamentals and key terms, then retake a focused quiz.";

  return { percent, correctCount, total, breakdown, summary };
}
