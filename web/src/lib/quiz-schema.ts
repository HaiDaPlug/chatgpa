// Purpose: Zod schema for quiz validation
// Connects to: test-fixtures.ts, generateQuiz.ts, grader.ts

import { z } from 'zod'

// MCQ question schema with answer validation
const mcqQuestionSchema = z.object({
  id: z.string(),
  type: z.literal('mcq'),
  prompt: z.string().max(180),
  options: z.array(z.string()).min(3).max(5),
  answer: z.string(),
}).refine((data) => {
  // Ensure MCQ answer matches one of the options
  return data.options.includes(data.answer)
}, {
  message: 'MCQ answer must match one of the options',
})

// Short answer question schema
const shortQuestionSchema = z.object({
  id: z.string(),
  type: z.literal('short'),
  prompt: z.string().max(180),
  answer: z.string(),
})

// Long answer/typing question schema (for essays, paragraphs)
const longQuestionSchema = z.object({
  id: z.string(),
  type: z.literal('long'),
  prompt: z.string().max(300), // Longer prompts for essay questions
  answer: z.string(), // Reference answer for rubric-based grading
})

// Union of question types
const questionSchema = z.discriminatedUnion('type', [
  mcqQuestionSchema,
  shortQuestionSchema,
  longQuestionSchema,
])

// Quiz schema (array of questions) with unique ID validation
export const quizSchema = z.object({
  questions: z.array(questionSchema),
}).superRefine((data, ctx) => {
  // Ensure unique question IDs in the full quiz
  const ids = data.questions.map(q => q.id)
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Question IDs must be unique',
    })
  }
})

// TypeScript types
export type MCQQuestion = z.infer<typeof mcqQuestionSchema>
export type ShortQuestion = z.infer<typeof shortQuestionSchema>
export type LongQuestion = z.infer<typeof longQuestionSchema>
export type Question = z.infer<typeof questionSchema>
export type Quiz = z.infer<typeof quizSchema>
