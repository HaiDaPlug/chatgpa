// Purpose: Zod schemas for utility gateway validation
// Covers: Telemetry tracking, token spending

import { z } from 'zod';

// ===== Track Schemas =====

export const TrackInput = z.object({
  event: z.string().min(1).max(64),
  data: z.record(z.string(), z.any()).optional(),
});

// ===== Use Tokens Schemas =====

export const UseTokensInput = z.object({
  userId: z.string().uuid(),
  tokens: z.number().int().positive(),
});

// ===== Health Query =====

export const HealthQuery = z.object({
  details: z.enum(['true', 'false']).optional(),
});

// ===== Client Log Schemas (Task C) =====

export const ClientLogInput = z.object({
  level: z.enum(['info', 'warn', 'error']).default('info'),
  message: z.string().min(1).max(200),
  source: z.string().max(50).optional(),  // e.g. "generate_page" for searchability
  gen_request_id: z.string().optional(),  // Correlate with server generation
  data: z.record(z.string(), z.any()).optional(),
});
