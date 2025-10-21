// web/api/create-checkout-session.ts - Create Stripe Checkout Session
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { z } from 'zod';

const requestSchema = z.object({
  userId: z.string().uuid(),
  tier: z.enum(['cruiser', 'power', 'pro']),
});

// Select TEST or LIVE mode
const mode = process.env.APP_MODE === "live" ? "LIVE" : "TEST";

// Mode-aware environment variables
const STRIPE_SECRET_KEY = process.env[`STRIPE_SECRET_KEY_${mode}`];
const PRICE_CRUISER = process.env[`STRIPE_PRICE_CRUISER_${mode}`];
const PRICE_POWER = process.env[`STRIPE_PRICE_POWER_${mode}`];
const PRICE_PRO = process.env[`STRIPE_PRICE_PRO_${mode}`];

// Tier-to-price-ID mapping
const TIER_PRICE_IDS = {
  cruiser: PRICE_CRUISER,
  power: PRICE_POWER,
  pro: PRICE_PRO,
} as const;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5173';

  // Validate configuration
  const missing: string[] = [];
  if (!STRIPE_SECRET_KEY) missing.push(`STRIPE_SECRET_KEY_${mode}`);
  if (!PRICE_CRUISER) missing.push(`STRIPE_PRICE_CRUISER_${mode}`);
  if (!PRICE_POWER) missing.push(`STRIPE_PRICE_POWER_${mode}`);
  if (!PRICE_PRO) missing.push(`STRIPE_PRICE_PRO_${mode}`);

  if (missing.length > 0) {
    console.error(`Missing configuration for ${mode} mode:`, missing.join(', '));
    return res.status(500).json({
      error: 'server_config_missing',
      detail: `Missing ${mode} mode config: ${missing.join(', ')}`,
      mode,
    });
  }

  try {
    // Validate request body
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_body', details: parsed.error.issues });
    }

    const { userId, tier } = parsed.data;

    const stripe = new Stripe(STRIPE_SECRET_KEY!, { apiVersion: '2025-08-27.basil' });

    // Get the price ID for the selected tier
    const priceId = TIER_PRICE_IDS[tier];
    if (!priceId) {
      return res.status(500).json({
        error: 'invalid_tier_config',
        detail: `No price ID configured for tier: ${tier}`,
      });
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: {
        userId,
        tier,
      },
      success_url: `${BASE_URL}/account?success=true`,
      cancel_url: `${BASE_URL}/account?canceled=true`,
      subscription_data: {
        metadata: {
          userId,
          tier,
        },
      },
    });

    console.log(JSON.stringify({
      scope: 'create-checkout-session',
      mode,
      userId: userId.substring(0, 8) + '...',
      tier,
      priceId,
      sessionId: session.id,
    }));

    return res.status(200).json({ url: session.url });
  } catch (err: any) {
    console.error(JSON.stringify({
      scope: 'create-checkout-session',
      error: 'unhandled',
      message: err?.message,
    }));
    return res.status(500).json({ error: 'unhandled', message: err.message });
  }
}
