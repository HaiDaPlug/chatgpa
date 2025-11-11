// Purpose: Create Stripe checkout session (MODE-AWARE)
// Migrated from: /api/router?action=stripe-checkout (and /api/create-checkout-session)
// Features: Test/Live mode switching, tier-based pricing, metadata tracking

import type { GatewayContext } from '../../_types';
import Stripe from 'stripe';
import { CreateCheckoutInput } from '../schemas';

export async function create_checkout(
  data: unknown,
  context: GatewayContext
): Promise<any> {
  const { request_id } = context;

  // Select TEST or LIVE mode
  const mode = process.env.APP_MODE === 'live' ? 'LIVE' : 'TEST';

  const STRIPE_SECRET = process.env[`STRIPE_SECRET_KEY_${mode}`];
  if (!STRIPE_SECRET) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        request_id,
        action: 'create_checkout',
        error: 'missing_stripe_key',
        mode,
        message: 'Stripe secret key not configured'
      })
    );
    throw {
      code: 'SERVER_CONFIG_MISSING',
      message: 'server_config_missing',
      status: 500,
      missing: [`STRIPE_SECRET_KEY_${mode}`]
    };
  }

  // Validate input
  const parseResult = CreateCheckoutInput.safeParse(data);
  if (!parseResult.success) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        request_id,
        action: 'create_checkout',
        error: 'invalid_body',
        details: parseResult.error.issues,
        message: 'Invalid checkout request'
      })
    );
    throw {
      code: 'INVALID_INPUT',
      message: 'invalid_body',
      status: 400
    };
  }

  const { tier, userId, email } = parseResult.data;

  // Normalize tier to lowercase for env lookup (mode-aware)
  const tierLower = tier.toLowerCase();
  const PRICE_ID = tierLower === 'cruiser'
    ? process.env[`STRIPE_PRICE_CRUISER_${mode}`]
    : tierLower === 'power'
    ? process.env[`STRIPE_PRICE_POWER_${mode}`]
    : tierLower === 'pro'
    ? process.env[`STRIPE_PRICE_PRO_${mode}`]
    : null;

  if (!PRICE_ID) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        request_id,
        action: 'create_checkout',
        error: 'price_not_configured',
        tier,
        message: 'Price ID not configured for tier'
      })
    );
    throw {
      code: 'PRICE_NOT_CONFIGURED',
      message: 'price_not_configured',
      status: 400,
      tier
    };
  }

  try {
    const stripe = new Stripe(STRIPE_SECRET, { apiVersion: '2025-08-27.basil' });

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      customer_email: email,
      metadata: { userId, tier },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.carpoolai.app'}/chat?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.carpoolai.app'}/#pricing`,
    });

    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        request_id,
        action: 'create_checkout',
        tier,
        priceId: PRICE_ID.substring(0, 15) + '...',
        sessionId: session.id,
        message: 'Checkout session created'
      })
    );

    return { url: session.url };
  } catch (err: any) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        request_id,
        action: 'create_checkout',
        error: 'stripe_api_error',
        message: err?.message,
        tier
      })
    );
    throw {
      code: 'STRIPE_API_ERROR',
      message: 'unhandled',
      status: 500,
      detail: err?.message
    };
  }
}
