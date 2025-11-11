// Purpose: Shared Zod schemas for attempts gateway validation
// Connects to: start, autosave, update_meta actions

import { z } from 'zod';

// ===== Start Action Schemas =====

export const StartInput = z.object({
  quiz_id: z.string().uuid(),
  idempotency_key: z.string().uuid().optional() // Optional: for handling double-clicks
});

export type StartInputType = z.infer<typeof StartInput>;

export const StartOutput = z.object({
  attempt_id: z.string().uuid(),
  status: z.literal('in_progress'),
  title: z.string(),
  subject: z.string(),
  started_at: z.string(),
  updated_at: z.string(),
  autosave_version: z.number(),
  resumed: z.boolean() // Flag indicating if this is a resume (true) or new start (false)
});

export type StartOutputType = z.infer<typeof StartOutput>;

// ===== Autosave Action Schemas =====

export const AutosaveInput = z.object({
  attempt_id: z.string().uuid(),
  responses: z.record(z.string(), z.string()) // { questionId: userAnswer }
});

export type AutosaveInputType = z.infer<typeof AutosaveInput>;

export const AutosaveOutput = z.object({
  ok: z.literal(true),
  autosave_version: z.number(),
  updated_at: z.string()
});

export type AutosaveOutputType = z.infer<typeof AutosaveOutput>;

// ===== Update Meta Action Schemas =====

export const UpdateMetaInput = z
  .object({
    attempt_id: z.string().uuid(),
    title: z.string().trim().min(1).max(100).optional(),
    subject: z.string().trim().min(1).max(50).optional()
  })
  .refine((data) => data.title !== undefined || data.subject !== undefined, {
    message: 'At least one of title or subject must be provided'
  });

export type UpdateMetaInputType = z.infer<typeof UpdateMetaInput>;

export const UpdateMetaOutput = z.object({
  ok: z.literal(true),
  title: z.string(),
  subject: z.string(),
  autosave_version: z.number(),
  updated_at: z.string()
});

export type UpdateMetaOutputType = z.infer<typeof UpdateMetaOutput>;
