// Purpose: Zod schemas for marketing gateway validation
// Covers: Waitlist signup with bot protection

import { z } from 'zod';

// ===== Waitlist Schemas =====

export const JoinWaitlistInput = z.object({
  email: z.string().email().max(120),
  name: z.string().max(80).optional(),
  source: z.string().max(64).optional(),
  trap: z.string().optional(), // Honeypot
  turnstileToken: z.string().min(10).max(10_000).optional(),
});
