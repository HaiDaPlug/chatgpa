/**
 * Section 4: Quiz Config Validation
 *
 * Zod schemas for quiz configuration with defaults and normalization.
 * Used by /api/generate-quiz to validate and normalize user config.
 */

import { z } from "zod";
import type { QuizConfig, QuestionCounts } from "../../shared/types.js";

// Zod schemas matching shared types
const questionTypeSchema = z.enum(["mcq", "typing", "hybrid"]);
const coverageStrategySchema = z.enum(["key_concepts", "broad_sample"]);
const difficultyLevelSchema = z.enum(["low", "medium", "high"]);

const questionCountsSchema = z.object({
  mcq: z.number().int().min(0),
  typing: z.number().int().min(0),
});

export const quizConfigSchema = z.object({
  question_type: questionTypeSchema,
  question_count: z.number().int().min(1).max(10),
  coverage: coverageStrategySchema,
  difficulty: difficultyLevelSchema,
  question_counts: questionCountsSchema.optional(),
}).refine(
  (data) => {
    // If hybrid, question_counts must be provided and sum to question_count
    if (data.question_type === "hybrid") {
      if (!data.question_counts) {
        return false;
      }
      const sum = data.question_counts.mcq + data.question_counts.typing;
      return sum === data.question_count;
    }
    return true;
  },
  {
    message: "For hybrid type, question_counts must be provided and sum to question_count",
    path: ["question_counts"],
  }
);

/**
 * Default config used when no config is provided
 */
export const DEFAULT_QUIZ_CONFIG: QuizConfig = {
  question_type: "mcq",
  question_count: 8,
  coverage: "key_concepts",
  difficulty: "medium",
};

/**
 * Normalize a partial config by applying defaults
 */
export function normalizeQuizConfig(partial?: Partial<QuizConfig>): QuizConfig {
  if (!partial) {
    return DEFAULT_QUIZ_CONFIG;
  }

  const normalized: QuizConfig = {
    question_type: partial.question_type ?? DEFAULT_QUIZ_CONFIG.question_type,
    question_count: partial.question_count ?? DEFAULT_QUIZ_CONFIG.question_count,
    coverage: partial.coverage ?? DEFAULT_QUIZ_CONFIG.coverage,
    difficulty: partial.difficulty ?? DEFAULT_QUIZ_CONFIG.difficulty,
  };

  // If hybrid and question_counts provided, include it
  if (normalized.question_type === "hybrid" && partial.question_counts) {
    normalized.question_counts = partial.question_counts;
  }

  return normalized;
}

/**
 * Validate config and return normalized version or throw
 */
export function validateAndNormalizeConfig(config?: unknown): QuizConfig {
  if (!config) {
    return DEFAULT_QUIZ_CONFIG;
  }

  const result = quizConfigSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Invalid quiz config: ${result.error.message}`);
  }

  return result.data;
}
