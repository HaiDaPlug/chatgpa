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
  score?: number | null;        // ✅ P1.2: 0-1 score, or null for Ungraded
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

// ✅ P1.2: Single-question JSON schema for per-question grading
const SINGLE_GRADING_RESPONSE_SCHEMA = {
  type: "object" as const,
  additionalProperties: false,
  properties: {
    score: { type: "number" as const },
    band: {
      type: "string" as const,
      enum: ["correct", "mostly_correct", "partial", "incorrect"]
    },
    why: { type: "string" as const },
    improvements: {
      type: "array" as const,
      items: { type: "string" as const }
    },
    missing_terms: {
      type: "array" as const,
      items: { type: "string" as const }
    },
    misconception: {
      anyOf: [{ type: "string" as const }, { type: "null" as const }]
    }
  },
  required: ["score", "band", "why", "improvements", "missing_terms", "misconception"]
};

// ✅ P1.1: Strict JSON schema for OpenAI Structured Outputs (DEPRECATED - kept for rollback)
const GRADING_RESPONSE_SCHEMA = {
  type: "object" as const,
  additionalProperties: false,
  properties: {
    results: {
      type: "array" as const,
      items: {
        type: "object" as const,
        additionalProperties: false,
        properties: {
          id: { type: "string" as const },
          score: { type: "number" as const },
          band: {
            type: "string" as const,
            enum: ["correct", "mostly_correct", "partial", "incorrect"]
          },
          why: { type: "string" as const },
          improvements: {
            type: "array" as const,
            items: { type: "string" as const }
          },
          missing_terms: {
            type: "array" as const,
            items: { type: "string" as const }
          },
          misconception: {
            anyOf: [{ type: "string" as const }, { type: "null" as const }]
          }
        },
        required: ["id", "score", "band", "why", "improvements", "missing_terms", "misconception"]
      }
    }
  },
  required: ["results"]
};

// ✅ P1.1: Strip outer markdown fences only (safer than global replace)
function stripMarkdownFences(raw: string): string {
  let s = raw.trim();
  // Only strip if starts with ``` and ends with ```
  if (s.startsWith('```')) {
    // Remove leading ```json or ```
    s = s.replace(/^```(?:json)?\s*\n?/, '');
  }
  if (s.endsWith('```')) {
    s = s.replace(/\n?```$/, '');
  }
  return s.trim();
}

// ✅ P1.2: Concurrency limiter for per-question grading
async function withConcurrencyLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = [];
  const executing: Promise<void>[] = [];

  for (const item of items) {
    const p = fn(item)
      .then((value) => ({ status: 'fulfilled' as const, value }))
      .catch((reason) => ({ status: 'rejected' as const, reason }));

    const e = p.then((result) => {
      results.push(result);
      executing.splice(executing.indexOf(e), 1);
    });
    executing.push(e);

    if (executing.length >= limit) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return results;
}

// ✅ P1.2: Per-question AI grading with retry
async function aiSemanticGradeSingle(
  question: ShortQ,
  userAnswer: string,
  apiKey: string,
  requestId?: string
): Promise<AIGradingResult | null> {
  const client = new OpenAI({ apiKey });
  const model = modelEnv("OPENAI_GRADE_MODEL", "gpt-4o-mini");
  const modelFamily = detectModelFamily(model);

  const systemPrompt = `Grade this answer semantically against the reference.
Return JSON: {
  "score": number (0-1),
  "band": "correct"|"mostly_correct"|"partial"|"incorrect",
  "why": string (1 sentence max),
  "improvements": string[] (max 2 items),
  "missing_terms": string[] (max 3 terms),
  "misconception": string|null
}

Scoring:
- 1.0: Perfect or near-perfect
- 0.75-0.99: Correct concept, minor gaps
- 0.30-0.74: Partial understanding
- 0.0-0.29: Wrong or off-topic`;

  const userContent = JSON.stringify({
    q: question.prompt,
    ref: question.answer ?? "",
    ans: userAnswer,
  });

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const isRetry = attempt > 0;

      const res = await client.chat.completions.create({
        model,
        ...buildOpenAIParams(modelFamily, 256, 0),
        messages: [
          {
            role: "system",
            content: isRetry
              ? systemPrompt + "\n\nCRITICAL: Return ONLY valid JSON. No markdown."
              : systemPrompt
          },
          { role: "user", content: userContent },
        ],
        response_format: isRetry
          ? { type: "json_object" as const }
          : {
              type: "json_schema" as const,
              json_schema: {
                name: "grading_response",
                strict: true,
                schema: SINGLE_GRADING_RESPONSE_SCHEMA
              }
            } as any,
      });

      let raw = res.choices[0]?.message?.content ?? "{}";

      if (raw.includes('```')) {
        raw = stripMarkdownFences(raw);
      }

      const parsed = JSON.parse(raw);

      // Validate required fields
      const rawScore = Number(parsed.score);
      const band = String(parsed.band ?? 'incorrect');
      const why = String(parsed.why ?? '');

      if (isNaN(rawScore)) throw new Error('Invalid score');

      const validBands = ['correct', 'mostly_correct', 'partial', 'incorrect'] as const;
      const validatedBand = validBands.includes(band as typeof validBands[number])
        ? (band as AIGradingResult['band'])
        : 'incorrect';

      return {
        id: question.id,
        score: clampScore(rawScore),
        band: validatedBand,
        why,
        improvements: Array.isArray(parsed.improvements)
          ? parsed.improvements.slice(0, 2).map(String)
          : [],
        missing_terms: Array.isArray(parsed.missing_terms)
          ? parsed.missing_terms.slice(0, 3).map(String)
          : [],
        misconception: typeof parsed.misconception === 'string' ? parsed.misconception : null,
      };

    } catch (e) {
      const lastError = e instanceof Error ? e : new Error(String(e));

      if (attempt === 0) {
        console.warn(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'warn',
          action: 'grade_single_retry',
          request_id: requestId,
          question_id: question.id,
          model,
          error: lastError.message,
          message: 'Per-question grading failed, retrying'
        }));
        continue;
      }

      // Both attempts failed - return null for partial success
      console.warn(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'warn',
        action: 'grade_single_failed',
        request_id: requestId,
        question_id: question.id,
        model,
        error: lastError.message,
        message: 'Per-question grading failed after retry, marking as Ungraded'
      }));
      return null;
    }
  }

  return null;
}

// ✅ P1.1: Process AI results with validation
function processAIResults(results: unknown[], requestId?: string): Record<string, AIGradingResult> {
  const out: Record<string, AIGradingResult> = {};

  for (const r of results) {
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

// ✅ P1 + P1.1: Semantic AI grading for short answers with retry logic
async function aiSemanticGradingBatch(
  shorts: ShortQ[],
  responses: Record<string, string>,
  apiKey?: string,
  requestId?: string
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
      request_id: requestId,
      question_count: shorts.length,
      prompt_chars: promptStr.length,
      estimated_tokens: Math.round(promptStr.length / 4),
      message: 'AI semantic grading short answers'
    })
  );

  const model = modelEnv("OPENAI_GRADE_MODEL", "gpt-4o-mini");
  const maxTokens = Math.min(1024, 128 + shorts.length * 128);
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

  // ✅ P1.1: Retry once on parse failure with stricter constraints
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const isRetry = attempt > 0;

      const res = await client.chat.completions.create({
        model,
        ...buildOpenAIParams(modelFamily, maxTokens, 0), // ✅ P1.1: temperature=0 for determinism
        messages: [
          {
            role: "system",
            content: isRetry
              ? systemPrompt + "\n\nCRITICAL: Return ONLY valid JSON. No markdown, no explanation."
              : systemPrompt
          },
          { role: "user", content: JSON.stringify(items) },
        ],
        response_format: isRetry
          ? { type: "json_object" as const } // Fallback to simpler mode on retry
          : {
              type: "json_schema" as const,
              json_schema: {
                name: "grading_response",
                strict: true,
                schema: GRADING_RESPONSE_SCHEMA
              }
            } as any, // Type assertion needed for json_schema
      });

      let raw = res.choices[0]?.message?.content ?? "{}";

      // ✅ P1.1: Strip markdown fences if present (last-resort repair)
      if (raw.includes('```')) {
        raw = stripMarkdownFences(raw);
      }

      // Parse and validate
      const parsed = JSON.parse(raw);
      if (!parsed?.results || !Array.isArray(parsed.results)) {
        throw new Error('Missing results array');
      }

      // Success - process results
      return processAIResults(parsed.results, requestId);

    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));

      // ✅ P1.1: Log failure with gated raw preview (contains user text)
      const shouldLogRaw = process.env.GRADING_DEBUG === '1';
      // Note: 'raw' may not be defined if error was in API call, so we guard
      const rawForLog = typeof (e as any).raw === 'string' ? (e as any).raw : '';

      if (attempt === 0) {
        // Log and retry
        console.warn(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'warn',
          action: 'grade_ai_retry',
          request_id: requestId,
          model,
          attempt: attempt + 1,
          error: lastError.message,
          message: 'AI grading failed, retrying with stricter constraints'
        }));
        continue;
      }

      // Both attempts failed - log detailed failure
      const rawPreview = shouldLogRaw && rawForLog
        ? (rawForLog.length > 500 ? rawForLog.slice(0, 500) + `...[truncated, total ${rawForLog.length} chars]` : rawForLog)
        : `[redacted, set GRADING_DEBUG=1 to see raw output]`;

      console.warn(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'warn',
        action: 'grade_ai_parse_failed',
        request_id: requestId,
        model,
        raw_preview: rawPreview,
        error: lastError.message,
        message: 'AI grading JSON parse failed after retry'
      }));

      throw new Error('AI_GRADING_PARSE_ERROR: ' + lastError.message);
    }
  }

  throw lastError || new Error('AI_GRADING_PARSE_ERROR: Unknown error');
}

export async function gradeSubmission(
  questions: Question[],
  responses: Record<string, string>,
  requestId?: string
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

  // ✅ P1.2: Per-question AI grading with concurrency limit (replaces batch)
  const aiVerdicts: Record<string, AIGradingResult> = {};
  const apiKey = process.env.OPENAI_API_KEY;

  if (apiKey && needsAiGrading.length > 0) {
    const CONCURRENCY_LIMIT = 2;

    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      action: 'grade_ai_per_question_start',
      request_id: requestId,
      question_count: needsAiGrading.length,
      concurrency: CONCURRENCY_LIMIT,
      message: 'Starting per-question AI grading'
    }));

    const results = await withConcurrencyLimit(
      needsAiGrading,
      CONCURRENCY_LIMIT,
      async (q) => {
        const userAnswer = (responses[q.id] ?? "").toString();
        const result = await aiSemanticGradeSingle(q, userAnswer, apiKey, requestId);
        return { questionId: q.id, result };
      }
    );

    // Process results - fulfilled results go into aiVerdicts, rejected/null become Ungraded
    let successCount = 0;
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.result) {
        aiVerdicts[r.value.questionId] = r.value.result;
        successCount++;
      }
      // Rejected or null result → question stays out of aiVerdicts → becomes Ungraded
    }

    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      action: 'grade_ai_per_question_complete',
      request_id: requestId,
      total: needsAiGrading.length,
      success: successCount,
      ungraded: needsAiGrading.length - successCount,
      message: 'Per-question AI grading complete'
    }));
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
      // ✅ P1.2: No AI result → mark as Ungraded (score: null sentinel)
      // Don't add to totalScore - excluded from percentage calculation
      breakdown.push({
        id: q.id,
        type: "short",
        prompt: q.prompt,
        user_answer: user,
        correct: false,
        score: null as any, // Ungraded sentinel - UI displays "Ungraded"
        correct_answer: ref || undefined,
        feedback: "Unable to grade this answer. You can retry grading.",
        improvement: "Structure your answer: definition → key points → brief example.",
      });
    }
  }

  const total = questions.length || 1;

  // ✅ P1.2: Count graded questions (exclude null scores) for accurate percentage
  const gradedCount = breakdown.filter(b => b.score !== null && b.score !== undefined).length;
  const ungradedCount = breakdown.filter(b => b.score === null).length;

  // Calculate percent based on graded questions only (if any)
  const percent = gradedCount > 0
    ? Math.max(0, Math.min(100, Math.round((totalScore / gradedCount) * 100)))
    : 0;

  // Build short overall summary
  let summary: string;
  if (ungradedCount > 0 && gradedCount === 0) {
    summary = "Grading encountered issues. Please try again.";
  } else if (ungradedCount > 0) {
    summary = `${ungradedCount} question(s) couldn't be graded. You can retry grading.`;
  } else if (percent >= 85) {
    summary = "Great work — strong grasp overall. Skim the few missed concepts.";
  } else if (percent >= 70) {
    summary = "Solid base — focus revisions on the questions you missed.";
  } else {
    summary = "You're close — review fundamentals and key terms, then retake a focused quiz.";
  }

  return { percent, correctCount, total, breakdown, summary };
}
