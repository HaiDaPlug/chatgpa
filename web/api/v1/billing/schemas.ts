// Purpose: Zod schemas for billing gateway validation
// Covers: Stripe checkout, billing portal

import { z } from 'zod';

// ===== Checkout Schemas =====

export const CreateCheckoutInput = z.object({
  tier: z.enum(['Cruiser', 'Power', 'Pro']),
  userId: z.string().uuid(),
  email: z.string().email(),
});

// ===== Portal Schemas =====

export const PortalInput = z.object({
  userId: z.string().uuid(),
});
