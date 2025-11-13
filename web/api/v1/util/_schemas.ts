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
