// web/api/stripe-webhook.ts - Stripe webhook handler with signature verification
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

export const config = { api: { bodyParser: false } };

// Helper to read raw body
async function getRawBody(req: VercelRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = '';
    req.on('data', (chunk) => { buffer += chunk; });
    req.on('end', () => resolve(buffer));
    req.on('error', reject);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Select TEST or LIVE mode
  const mode = process.env.APP_MODE === "live" ? "LIVE" : "TEST";

  const STRIPE_SECRET = process.env[`STRIPE_SECRET_KEY_${mode}`];
  const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!STRIPE_SECRET || !WEBHOOK_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error(JSON.stringify({ scope: 'stripe-webhook', error: 'server_config_missing', mode, missing: !STRIPE_SECRET ? `STRIPE_SECRET_KEY_${mode}` : 'other' }));
    return res.status(500).json({ error: 'server_config_missing' });
  }

  const stripe = new Stripe(STRIPE_SECRET, { apiVersion: '2025-08-27.basil' });
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // 1) Verify signature
    const rawBody = await getRawBody(req);
    const sig = req.headers['stripe-signature'];

    if (!sig) {
      console.error('No stripe-signature header');
      return res.status(400).json({ error: 'No signature' });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, WEBHOOK_SECRET);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).json({ error: 'Invalid signature' });
    }

    // 2) Idempotency check
    const { data: existing } = await supabase
      .from('billing_events')
      .select('event_id')
      .eq('event_id', event.id)
      .maybeSingle();

    if (existing) {
      console.log(`Event ${event.id} already processed (idempotent)`);
      return res.status(200).json({ received: true, idempotent: true });
    }

    // 3) Log event to security_events for audit trail
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.headers['x-real-ip'] as string
      || 'stripe-webhook';

    await supabase.from('security_events').insert({
      ip: clientIp,
      bucket: 'stripe_webhook',
      metadata: { event_id: event.id, event_type: event.type },
    });

    // 4) Process event
    console.log(JSON.stringify({ scope: 'stripe-webhook', eventId: event.id, type: event.type }));

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const { userId, tier } = session.metadata || {};

        if (!userId || !tier) {
          console.warn(JSON.stringify({ scope: 'stripe-webhook', warning: 'missing_metadata', sessionId: session.id }));
          break;
        }

        // Get customer and subscription IDs
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        console.log(JSON.stringify({
          scope: 'stripe-webhook',
          event: 'checkout_completed',
          customerId: customerId?.substring(0, 12) + '...',
          subscriptionId: subscriptionId?.substring(0, 12) + '...',
          tier
        }));

        // Upsert billing record
        const { error: billingError } = await supabase
          .from('mvp_billing')
          .upsert({
            user_id: userId,
            customer_id: customerId,
            subscription_id: subscriptionId,
            tier,
            status: 'active',
          }, { onConflict: 'user_id' });

        if (billingError) {
          console.error(JSON.stringify({ scope: 'stripe-webhook', error: 'billing_upsert_failed', eventId: event.id, type: event.type, err: billingError.message }));
          return res.status(400).json({ error: 'billing_upsert_failed' });
        }

        // Call seed_after_purchase RPC
        const { error: seedError } = await supabase.rpc('seed_after_purchase', {
          p_user_id: userId,
          p_tier: tier,
        });

        if (seedError) {
          console.error(JSON.stringify({ scope: 'stripe-webhook', error: 'seed_failed', eventId: event.id, userId: userId.substring(0, 8) + '...', err: seedError.message }));
          // Log but don't fail - billing record was created
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as any;
        const subscriptionId = typeof invoice.subscription === 'string'
          ? invoice.subscription
          : invoice.subscription?.id;

        if (!subscriptionId) {
          console.warn('invoice.payment_succeeded without subscription ID');
          break;
        }

        // Update billing status to active
        const { error: updateError } = await supabase
          .from('mvp_billing')
          .update({
            status: 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('subscription_id', subscriptionId);

        if (updateError) {
          console.error(JSON.stringify({ scope: 'stripe-webhook', error: 'billing_update_failed', eventId: event.id, subscriptionId: subscriptionId?.substring(0, 12) + '...', err: updateError.message }));
        }

        // Optional: Reseed on renewal if policy requires it
        // const { data: billing } = await supabase
        //   .from('mvp_billing')
        //   .select('user_id, tier')
        //   .eq('subscription_id', subscriptionId)
        //   .single();
        // if (billing) {
        //   await supabase.rpc('seed_after_purchase', {
        //     p_user_id: billing.user_id,
        //     p_tier: billing.tier,
        //   });
        // }

        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as any;
        const subscriptionId = subscription.id;
        const status = subscription.status;

        const { error: updateError } = await supabase
          .from('mvp_billing')
          .update({
            status: status === 'active' ? 'active' : 'inactive',
            updated_at: new Date().toISOString(),
          })
          .eq('subscription_id', subscriptionId);

        if (updateError) {
          console.error(JSON.stringify({ scope: 'stripe-webhook', error: 'subscription_update_failed', eventId: event.id, subscriptionId, err: updateError.message }));
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.id;

        const { error: deleteError } = await supabase
          .from('mvp_billing')
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString(),
          })
          .eq('subscription_id', subscriptionId);

        if (deleteError) {
          console.error(JSON.stringify({ scope: 'stripe-webhook', error: 'subscription_cancel_failed', eventId: event.id, subscriptionId, err: deleteError.message }));
        }
        break;
      }

      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
        // Log but don't error - allows graceful handling of new event types
    }

    // 5) Record event for idempotency
    await supabase
      .from('billing_events')
      .insert({
        event_id: event.id,
        type: event.type,
      });

    return res.status(200).json({ received: true });
  } catch (err: any) {
    console.error(JSON.stringify({ scope: 'stripe-webhook', error: 'unhandled', message: err?.message, stack: err?.stack?.split('\n')[0] }));
    return res.status(500).json({ error: 'unhandled', message: err.message });
  }
}
