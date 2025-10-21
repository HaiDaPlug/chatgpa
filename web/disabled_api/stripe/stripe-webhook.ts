import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { TOKEN_FORMULA_V2_1 } from "../../shared/tokens";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-08-27.basil" as any,
});

/**
 * Read raw request body for Stripe signature verification.
 */
async function readRawBody(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/**
 * Map a Stripe Price ID -> our tier enum.
 */
function mapPriceToTier(priceId?: string | null): "cruiser" | "power" | "pro" | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_CRUISER) return "cruiser";
  if (priceId === process.env.STRIPE_PRICE_POWER) return "power";
  if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // --- Build Supabase client (server-side key) ---
  const supaUrl = process.env.VITE_SUPABASE_URL!;
  const supaRole = process.env.SUPABASE_SERVICE_ROLE!;
  const supa = createClient(supaUrl, supaRole);

  // --- Verify Stripe event (or allow dev skip) ---
  const sig = req.headers["stripe-signature"] as string | undefined;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const skipVerify = process.env.STRIPE_SKIP_VERIFY === "1";

  let event: Stripe.Event;

  try {
    if (!skipVerify) {
      if (!sig || !webhookSecret) {
        return res.status(400).json({ error: "Missing Stripe signature or webhook secret" });
      }
      const raw = await readRawBody(req);
      event = stripe.webhooks.constructEvent(raw, sig, webhookSecret);
    } else {
      // Dev helper: accept JSON body without signature
      const raw = await readRawBody(req);
      const json = JSON.parse(raw.toString("utf8"));
      event = json as Stripe.Event;
    }
  } catch (err: any) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;

        const customerId = sub.customer as string;
        const item = sub.items?.data?.[0];
        const priceId = item?.price?.id;
        const tier = mapPriceToTier(priceId);
        if (!tier) break;

        // We need to find which user this customerId belongs to.
        // Assumes you already create a row in `subscriptions` (or another mapping table)
        // with stripe_customer_id when the checkout completes.
        const { data: existing, error: fetchErr } = await supa
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (fetchErr || !existing) {
          // If you haven’t inserted this mapping yet, you can also try to look up by customer email:
          // const cust = await stripe.customers.retrieve(customerId) as Stripe.Customer;
          // and then match by email in your user/profiles table.
          console.warn("No subscription mapping found for customer:", customerId);
          break;
        }

        const userId = existing.user_id;
        const periodStart = new Date((sub as any).current_period_start * 1000);
        const periodEnd = new Date((sub as any).current_period_end * 1000);

        // Upsert subscription record
        await supa.from("subscriptions").upsert({
          user_id: userId,
          tier,
          status: sub.status,
          current_period_start: periodStart.toISOString().slice(0, 10),
          current_period_end: periodEnd.toISOString().slice(0, 10),
          stripe_customer_id: customerId,
          stripe_subscription_id: sub.id,
        });

        // Allocate monthly tokens + buffer contribution to pool
        const alloc = TOKEN_FORMULA_V2_1[tier];
        const { error: allocErr } = await supa.rpc("apply_monthly_allocation", {
          p_user_id: userId,
          p_personal: alloc.personal,
          p_pool_contrib: alloc.bufferToPool,
        });
        if (allocErr) {
          console.error("apply_monthly_allocation failed:", allocErr.message);
        }

        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await supa
          .from("subscriptions")
          .update({ status: "canceled" })
          .eq("stripe_subscription_id", sub.id);
        break;
      }

      // Optional: handle checkout.session.completed to insert stripe_customer_id -> user mapping
      // case "checkout.session.completed": { ... }
      default:
        // It’s fine to ignore events you don’t use yet.
        break;
    }

    return res.status(200).json({ received: true });
  } catch (e: any) {
    console.error("Webhook handler error:", e);
    return res.status(500).json({ error: "Internal error" });
  }
}
