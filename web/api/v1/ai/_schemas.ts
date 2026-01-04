// Purpose: Shared Zod schemas for AI gateway validation
// Connects to: generate, grade actions

import { z } from 'zod';
import { quizConfigSchema } from '../../_lib/quiz-config-schema.js';

// ===== Generate Quiz Schemas =====

export const GenerateQuizInput = z.object({
  class_id: z.string().uuid().nullable().optional(), // Optional - standalone quizzes allowed
  notes_text: z
    .string()
    .trim()
    .min(20, 'Notes text must be at least 20 characters')
    .max(50000, 'Notes text too long (max 50,000 characters)'),
  config: quizConfigSchema.optional() // Section 4: Optional quiz config
});

export type GenerateQuizInputType = z.infer<typeof GenerateQuizInput>;

export const GenerateQuizOutput = z.object({
  quiz_id: z.string().uuid(),
  config: quizConfigSchema.optional(),
  actual_question_count: z.number().optional(),
  // P0-B Phase 7: Optional debug timing payload (only when X-Debug-Timing header sent)
  debug: z.object({
    timings: z.object({
      validation_ms: z.number(),
      prompt_build_ms: z.number(),
      openai_ms: z.number(),
      db_insert_ms: z.number(),
      overhead_ms: z.number(),
      total_ms: z.number()
    }),
    model_used: z.string(),
    fallback_triggered: z.boolean(),
    tokens_total: z.number()
  }).optional()
});

export type GenerateQuizOutputType = z.infer<typeof GenerateQuizOutput>;

// ===== Quiz Question Schemas (from legacy generate-quiz.ts) =====

export const mcqQuestionSchema = z
  .object({
    id: z.string(),
    type: z.literal('mcq'),
    prompt: z.string().max(180),
    options: z.array(z.string()).min(3).max(5),
    answer: z.string()
  })
  .refine((data) => data.options.includes(data.answer), {
    message: 'MCQ answer must match one of the options'
  });

export const shortQuestionSchema = z.object({
  id: z.string(),
  type: z.literal('short'),
  prompt: z.string().max(180),
  answer: z.string()
});

export const questionSchema = z.discriminatedUnion('type', [
  mcqQuestionSchema,
  shortQuestionSchema
]);

export const quizResponseSchema = z.object({
  questions: z.array(questionSchema).min(1).max(10) // Align with quiz config: 1-10 questions allowed
});

// ===== Grade Schemas =====

export const GradeInput = z.object({
  quiz_id: z.string().uuid().optional(), // For demo mode (instant grade)
  attempt_id: z.string().uuid().optional(), // For Section 3 flow (submit existing)
  responses: z.record(z.string(), z.string()) // { questionId: userAnswer }
}).refine(
  (data) => data.quiz_id || data.attempt_id,
  {
    message: 'Must provide either quiz_id or attempt_id'
  }
);

export type GradeInputType = z.infer<typeof GradeInput>;

export const GradeOutput = z.object({
  attempt_id: z.string().uuid(),
  score: z.number().min(0).max(100),
  letter: z.enum(['F', 'D', 'C', 'B', 'A', 'A+']),
  summary: z.string(),
  breakdown: z.array(z.any()) // Per-question feedback (loose typing for now)
});

export type GradeOutputType = z.infer<typeof GradeOutput>;

// ===== Health Schemas =====

export const HealthOutput = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  router: z.object({
    config: z.record(z.string(), z.any()),
    recent_fallbacks: z.array(z.any()),
    metrics_24h: z.object({
      generation: z.any(),
      grading: z.any()
    })
  })
});

export type HealthOutputType = z.infer<typeof HealthOutput>;
