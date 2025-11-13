// Purpose: Create Stripe billing portal session (MODE-AWARE)
// Migrated from: /api/router?action=stripe-portal
// Features: Test/Live mode switching, customer lookup, portal URL generation

import type { GatewayContext } from '../../_types';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { PortalInput } from '../schemas';

export async function portal(
  data: unknown,
  context: GatewayContext
): Promise<any> {
  const { request_id } = context;

  // Select TEST or LIVE mode
  const mode = process.env.APP_MODE === 'live' ? 'LIVE' : 'TEST';

  const STRIPE_SECRET = process.env[`STRIPE_SECRET_KEY_${mode}`];
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!STRIPE_SECRET) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        request_id,
        action: 'portal',
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
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        request_id,
        action: 'portal',
        error: 'missing_supabase_config',
        message: 'Supabase configuration missing'
      })
    );
    throw {
      code: 'SERVER_CONFIG_MISSING',
      message: 'server_config_missing',
      status: 500,
      missing: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
    };
  }

  const parseResult = PortalInput.safeParse(data);
  if (!parseResult.success) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        request_id,
        action: 'portal',
        error: 'invalid_body',
        message: 'Invalid portal request'
      })
    );
    throw {
      code: 'INVALID_INPUT',
      message: 'invalid_body',
      status: 400
    };
  }

  const { userId } = parseResult.data;

  try {
    // Fetch customer_id from mvp_billing (using SERVICE_ROLE_KEY)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: billing, error: billingError } = await supabase
      .from('mvp_billing')
      .select('customer_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (billingError || !billing?.customer_id) {
      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'warn',
          request_id,
          action: 'portal',
          error: 'no_customer',
          userId: userId.substring(0, 8) + '...',
          message: 'No customer found for user'
        })
      );
      throw {
        code: 'NO_CUSTOMER',
        message: 'no_customer_for_user',
        status: 404
      };
    }

    const stripe = new Stripe(STRIPE_SECRET, { apiVersion: '2025-08-27.basil' });

    const session = await stripe.billingPortal.sessions.create({
      customer: billing.customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.carpoolai.app'}/account`,
    });

    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        request_id,
        action: 'portal',
        customerId: billing.customer_id.substring(0, 12) + '...',
        sessionId: session.id,
        message: 'Portal session created'
      })
    );

    return { url: session.url };
  } catch (err: any) {
    // Re-throw structured errors
    if (err.code) throw err;

    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        request_id,
        action: 'portal',
        error: 'unhandled',
        message: err?.message
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
