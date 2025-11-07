// Purpose: Generation analytics service with quality metrics calculation
// Connects to: generation_analytics table, ai-router, quiz validation

import { createClient } from "@supabase/supabase-js";
import type { RouterMetrics } from "./ai-router.js";

// ============================================================================
// Types
// ============================================================================

export interface Question {
  id: string;
  type: "mcq" | "short";
  prompt: string;
  options?: string[];
  answer?: string;
}

export interface QualityMetrics {
  concept_coverage_ratio: number; // 0-1: unique concepts / total concepts
  question_diversity_score: number; // 0-1: balance across question types
  duplicate_ratio: number; // 0-1: similarity between questions
  difficulty_balance?: {
    // Optional: if metadata includes difficulty
    easy: number;
    medium: number;
    hard: number;
  };
}

export interface SourceContext {
  type: "class" | "paste" | "file";
  note_size: number;
}

// ============================================================================
// Quality Metrics Calculation (Heuristics, No AI Calls)
// ============================================================================

// Module-level constant: stopwords set (created once, reused across all calls)
const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "can",
  "what",
  "which",
  "who",
  "when",
  "where",
  "why",
  "how",
  "of",
  "to",
  "in",
  "for",
  "on",
  "with",
  "as",
  "by",
  "from",
  "at",
  "this",
  "that",
  "these",
  "those",
]);

/**
 * Extract key concepts from question prompts.
 * Simple heuristic: lowercase, remove punctuation, split into words, filter stopwords.
 */
function extractConcepts(text: string): Set<string> {
  const normalized = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = normalized.split(" ").filter((w) => w.length > 2 && !STOPWORDS.has(w));

  return new Set(words);
}

/**
 * Calculate Jaccard similarity between two strings (0-1).
 * Used for duplicate detection.
 */
function jaccardSimilarity(a: string, b: string): number {
  const setA = extractConcepts(a);
  const setB = extractConcepts(b);

  if (setA.size === 0 && setB.size === 0) return 1.0;
  if (setA.size === 0 || setB.size === 0) return 0.0;

  const arrayA = Array.from(setA);
  const arrayB = Array.from(setB);
  const intersection = new Set(arrayA.filter((x) => setB.has(x)));
  const union = new Set([...arrayA, ...arrayB]);

  return intersection.size / union.size;
}

/**
 * Calculate concept coverage ratio.
 * Concept coverage = unique concepts across all questions / total concepts mentioned.
 */
function calculateConceptCoverage(questions: Question[]): number {
  if (questions.length === 0) return 0;

  const allConcepts = new Set<string>();
  let totalConceptMentions = 0;

  for (const q of questions) {
    const concepts = extractConcepts(q.prompt);
    concepts.forEach((c) => allConcepts.add(c));
    totalConceptMentions += concepts.size;
  }

  if (totalConceptMentions === 0) return 0;

  // Ratio of unique concepts to total mentions (higher = more diverse coverage)
  return allConcepts.size / totalConceptMentions;
}

/**
 * Calculate question type diversity score.
 * Target: ~40% MCQ, 60% short answer (balanced mix).
 * Score is 1.0 when distribution matches target, lower when imbalanced.
 */
function calculateDiversityScore(questions: Question[]): number {
  if (questions.length === 0) return 0;

  const mcqCount = questions.filter((q) => q.type === "mcq").length;
  const shortCount = questions.filter((q) => q.type === "short").length;
  const total = questions.length;

  const mcqRatio = mcqCount / total;
  const shortRatio = shortCount / total;

  // Target distribution
  const targetMcq = 0.4;
  const targetShort = 0.6;

  // Calculate deviation from target (0 = perfect, 1 = worst possible)
  const mcqDeviation = Math.abs(mcqRatio - targetMcq);
  const shortDeviation = Math.abs(shortRatio - targetShort);
  const avgDeviation = (mcqDeviation + shortDeviation) / 2;

  // Convert deviation to score (1 = perfect, 0 = worst)
  // Max deviation is 1.0 (all one type), so score = 1 - deviation
  return 1 - avgDeviation;
}

/**
 * Calculate duplicate ratio (0-1).
 * Checks pairwise similarity between question prompts.
 * Threshold: 0.7 Jaccard = duplicate.
 * Performance cap: O(n²) complexity limited to first 20 questions.
 */
function calculateDuplicateRatio(questions: Question[]): number {
  if (questions.length < 2) return 0;

  // Performance cap: limit duplicate detection to first 20 questions (O(n²) complexity)
  // 10 questions = 45 comparisons (fast)
  // 20 questions = 190 comparisons (acceptable)
  // 50 questions = 1,225 comparisons (would be slow)
  const questionsToCheck = questions.slice(0, 20);

  let duplicateCount = 0;
  const totalPairs = (questionsToCheck.length * (questionsToCheck.length - 1)) / 2;

  for (let i = 0; i < questionsToCheck.length; i++) {
    for (let j = i + 1; j < questionsToCheck.length; j++) {
      const similarity = jaccardSimilarity(questionsToCheck[i].prompt, questionsToCheck[j].prompt);
      if (similarity >= 0.7) {
        duplicateCount++;
      }
    }
  }

  return duplicateCount / totalPairs;
}

/**
 * Main quality metrics calculator.
 */
export function calculateQualityMetrics(questions: Question[]): QualityMetrics {
  const conceptCoverageRatio = calculateConceptCoverage(questions);
  const questionDiversityScore = calculateDiversityScore(questions);
  const duplicateRatio = calculateDuplicateRatio(questions);

  // Future: Parse difficulty metadata if present
  // For now, difficulty_balance is optional and omitted

  return {
    concept_coverage_ratio: Math.round(conceptCoverageRatio * 100) / 100,
    question_diversity_score: Math.round(questionDiversityScore * 100) / 100,
    duplicate_ratio: Math.round(duplicateRatio * 100) / 100,
  };
}

// ============================================================================
// Analytics Insertion
// ============================================================================

/**
 * Insert generation analytics into database (non-blocking).
 * Errors are logged but never thrown (analytics should not break quiz generation).
 */
export async function insertGenerationAnalytics(
  quizId: string,
  userId: string,
  routerMetrics: RouterMetrics,
  questions: Question[],
  sourceContext: SourceContext
): Promise<void> {
  try {
    // Create Supabase client (anon key is fine, RLS enforces user_id)
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn("ANALYTICS_INSERT_SKIPPED", {
        reason: "missing_supabase_config",
        quiz_id: quizId,
      });
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    });

    // Calculate quality metrics
    const qualityMetrics = calculateQualityMetrics(questions);

    // Count question types
    const mcqCount = questions.filter((q) => q.type === "mcq").length;
    const shortCount = questions.filter((q) => q.type === "short").length;

    // Build analytics record
    const analyticsRecord = {
      quiz_id: quizId,
      user_id: userId,
      request_id: routerMetrics.request_id,

      // Model & routing
      model_used: routerMetrics.model_used,
      model_family: routerMetrics.model_family,
      fallback_triggered: routerMetrics.fallback_triggered,
      attempt_count: routerMetrics.attempt_count,

      // Performance
      latency_ms: routerMetrics.latency_ms,
      tokens_prompt: routerMetrics.tokens_prompt,
      tokens_completion: routerMetrics.tokens_completion,
      tokens_total: routerMetrics.tokens_total,

      // Content
      question_count: questions.length,
      mcq_count: mcqCount,
      short_count: shortCount,

      // Quality
      quality_metrics: qualityMetrics,

      // Source
      source_type: sourceContext.type,
      note_size_chars: sourceContext.note_size,

      // No errors (this is success path)
      error_occurred: false,
    };

    // Insert (non-blocking fire-and-forget)
    const { error } = await supabase.from("generation_analytics").insert([analyticsRecord]);

    if (error) {
      console.error("ANALYTICS_INSERT_FAILED", {
        quiz_id: quizId,
        request_id: routerMetrics.request_id,
        error_code: error.code,
        error_message: error.message,
      });
    } else {
      console.log("ANALYTICS_INSERT_SUCCESS", {
        quiz_id: quizId,
        request_id: routerMetrics.request_id,
        model_used: routerMetrics.model_used,
        fallback_triggered: routerMetrics.fallback_triggered,
        quality_metrics: qualityMetrics,
      });
    }
  } catch (err: any) {
    // Swallow all errors (analytics must never break quiz generation)
    console.error("ANALYTICS_INSERT_EXCEPTION", {
      quiz_id: quizId,
      error_message: err?.message || "Unknown error",
    });
  }
}

/**
 * Insert analytics for failed generation attempts.
 * Similar to insertGenerationAnalytics but tracks error details.
 */
export async function insertGenerationFailure(
  userId: string,
  routerMetrics: RouterMetrics,
  errorCode: string,
  errorMessage: string,
  sourceContext: SourceContext
): Promise<void> {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return; // Silent skip
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    });

    const analyticsRecord = {
      user_id: userId,
      request_id: routerMetrics.request_id,

      // Model & routing
      model_used: routerMetrics.model_used,
      model_family: routerMetrics.model_family,
      fallback_triggered: routerMetrics.fallback_triggered,
      attempt_count: routerMetrics.attempt_count,

      // Performance
      latency_ms: routerMetrics.latency_ms,
      tokens_prompt: routerMetrics.tokens_prompt,
      tokens_completion: routerMetrics.tokens_completion,
      tokens_total: routerMetrics.tokens_total,

      // Source
      source_type: sourceContext.type,
      note_size_chars: sourceContext.note_size,

      // Error details
      error_occurred: true,
      error_code: errorCode,
      error_message: errorMessage,
    };

    await supabase.from("generation_analytics").insert([analyticsRecord]);
  } catch (err) {
    // Swallow (non-critical)
  }
}
