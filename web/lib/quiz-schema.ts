import { z } from "zod";

export const Question = z.discriminatedUnion("kind", [
  z.object({
    id: z.string().uuid(),
    kind: z.literal("mcq"),
    prompt: z.string().min(1).max(400),
    options: z.array(z.string().min(1)).length(4),
    answer: z.string().min(1), // must equal one of options (validate later)
    meta: z.object({ difficulty: z.number().int().min(1).max(5) }).partial(),
  }),
  z.object({
    id: z.string().uuid(),
    kind: z.literal("short"),
    prompt: z.string().min(1).max(400),
    answer: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
    meta: z.object({ difficulty: z.number().int().min(1).max(5) }).partial(),
  }),
]);
export type Question = z.infer<typeof Question>;

export const QuestionArray = z.array(Question).min(1);

export const GradeResult = z.object({
  score: z.number().min(0).max(1),
  perQuestion: z.array(
    z.object({
      questionId: z.string().uuid(),
      score: z.number().min(0).max(1),
      comment: z.string().min(1).max(200),
    })
  ).min(1),
  summary: z.object({
    strengths: z.array(z.string()).max(3),
    gaps: z.array(z.string()).max(3),
    nextSteps: z.array(z.string()).max(3),
  }),
});
export type GradeResult = z.infer<typeof GradeResult>;
