// Purpose: Grading analytics tracking (fire-and-forget)
// Connects to: grade.ts, unified analytics approach (no separate table for now)

import { createClient } from "@supabase/supabase-js";
import type { RouterMetrics } from "./ai-router.js";
import type { CriteriaScores, ConceptHit, RUBRIC_VERSION } from "./rubric-engine.js";

// ============================================================================
// Types
// ============================================================================

export interface QuestionTypeBreakdown {
  mcq: number;
  short: number;
  long: number;
}

export interface CriteriaSummaries {
  coverage_avg: number;
  accuracy_avg: number;
  clarity_avg: number;
  conciseness_avg: number;
}

export interface ConceptStats {
  total_concepts_detected: number;
  total_concepts_hit: number;
  concept_coverage_ratio: number; // 0-1
}

export interface GradingResult {
  question_id: string;
  criteria_scores?: CriteriaScores;
  concept_hits?: ConceptHit[];
}

// ============================================================================
// Analytics Insertion
// ============================================================================

/**
 * Insert grading analytics (success path).
 * Fire-and-forget: errors logged but never thrown.
 */
export async function insertGradingAnalytics(
  attemptId: string,
  userId: string,
  quizId: string,
  routerMetrics: RouterMetrics,
  gradingResults: GradingResult[],
  questionTypeBreakdown: QuestionTypeBreakdown,
  rubricVersion: string
): Promise<void> {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn("GRADING_ANALYTICS_SKIPPED", {
        reason: "missing_supabase_config",
        attempt_id: attemptId,
      });
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    });

    // Calculate criteria summaries
    const criteriaSummaries = calculateCriteriaSummaries(gradingResults);

    // Calculate concept stats
    const conceptStats = calculateConceptStats(gradingResults);

    // Build analytics payload
    const analyticsPayload = {
      event: "grade_success",
      user_id: userId,
      data: {
        attempt_id: attemptId,
        quiz_id: quizId,
        request_id: routerMetrics.request_id,

        // Router metrics
        model_used: routerMetrics.model_used,
        model_family: routerMetrics.model_family,
        fallback_triggered: routerMetrics.fallback_triggered,
        attempt_count: routerMetrics.attempt_count,
        latency_ms: routerMetrics.latency_ms,
        tokens_prompt: routerMetrics.tokens_prompt,
        tokens_completion: routerMetrics.tokens_completion,
        tokens_total: routerMetrics.tokens_total,

        // Grading-specific
        rubric_version: rubricVersion,
        question_type_breakdown: questionTypeBreakdown,
        criteria_summaries: criteriaSummaries,
        concept_stats: conceptStats,
      },
    };

    // Insert (non-blocking fire-and-forget)
    const { error } = await supabase.from("analytics").insert([analyticsPayload]);

    if (error) {
      console.error("GRADING_ANALYTICS_INSERT_FAILED", {
        attempt_id: attemptId,
        request_id: routerMetrics.request_id,
        error_code: error.code,
        error_message: error.message,
      });
    } else {
      console.log("GRADING_ANALYTICS_INSERT_SUCCESS", {
        attempt_id: attemptId,
        request_id: routerMetrics.request_id,
        model_used: routerMetrics.model_used,
        fallback_triggered: routerMetrics.fallback_triggered,
        concept_coverage_ratio: conceptStats.concept_coverage_ratio,
      });
    }
  } catch (err: any) {
    // Swallow all errors (analytics must never break grading flow)
    console.error("GRADING_ANALYTICS_INSERT_EXCEPTION", {
      attempt_id: attemptId,
      error_message: err?.message || "Unknown error",
    });
  }
}

/**
 * Insert analytics for failed grading attempts.
 */
export async function insertGradingFailure(
  userId: string,
  quizId: string,
  routerMetrics: RouterMetrics,
  errorCode: string,
  errorMessage: string
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

    const analyticsPayload = {
      event: "grade_fail",
      user_id: userId,
      data: {
        quiz_id: quizId,
        request_id: routerMetrics.request_id,

        // Router metrics
        model_used: routerMetrics.model_used,
        model_family: routerMetrics.model_family,
        fallback_triggered: routerMetrics.fallback_triggered,
        attempt_count: routerMetrics.attempt_count,
        latency_ms: routerMetrics.latency_ms,
        tokens_prompt: routerMetrics.tokens_prompt,
        tokens_completion: routerMetrics.tokens_completion,
        tokens_total: routerMetrics.tokens_total,

        // Error details
        error_occurred: true,
        error_code: errorCode,
        error_message: errorMessage,
      },
    };

    await supabase.from("analytics").insert([analyticsPayload]);
  } catch (err) {
    // Swallow (non-critical)
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate average criteria scores across all graded questions.
 */
function calculateCriteriaSummaries(gradingResults: GradingResult[]): CriteriaSummaries {
  const resultsWithCriteria = gradingResults.filter((r) => r.criteria_scores);

  if (resultsWithCriteria.length === 0) {
    return {
      coverage_avg: 0,
      accuracy_avg: 0,
      clarity_avg: 0,
      conciseness_avg: 0,
    };
  }

  const totals = resultsWithCriteria.reduce(
    (acc, r) => {
      const scores = r.criteria_scores!;
      return {
        coverage: acc.coverage + scores.coverage,
        accuracy: acc.accuracy + scores.accuracy,
        clarity: acc.clarity + scores.clarity,
        conciseness: acc.conciseness + scores.conciseness,
      };
    },
    { coverage: 0, accuracy: 0, clarity: 0, conciseness: 0 }
  );

  const count = resultsWithCriteria.length;

  return {
    coverage_avg: Math.round((totals.coverage / count) * 100) / 100,
    accuracy_avg: Math.round((totals.accuracy / count) * 100) / 100,
    clarity_avg: Math.round((totals.clarity / count) * 100) / 100,
    conciseness_avg: Math.round((totals.conciseness / count) * 100) / 100,
  };
}

/**
 * Calculate aggregate concept statistics.
 */
function calculateConceptStats(gradingResults: GradingResult[]): ConceptStats {
  let totalConceptsDetected = 0;
  let totalConceptsHit = 0;

  for (const result of gradingResults) {
    if (result.concept_hits) {
      totalConceptsDetected += result.concept_hits.length;
      totalConceptsHit += result.concept_hits.filter((c) => c.hit).length;
    }
  }

  const conceptCoverageRatio =
    totalConceptsDetected > 0
      ? Math.round((totalConceptsHit / totalConceptsDetected) * 100) / 100
      : 0;

  return {
    total_concepts_detected: totalConceptsDetected,
    total_concepts_hit: totalConceptsHit,
    concept_coverage_ratio: conceptCoverageRatio,
  };
}
