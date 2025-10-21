import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

export const config = { runtime: 'nodejs' };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Determine mode
    const mode = process.env.APP_MODE === "live" ? "LIVE" : "TEST";

    // Check environment variables
    const envCheck = {
      appMode: process.env.APP_MODE || 'not set',
      mode,
      hasSupabaseUrl: !!process.env.VITE_SUPABASE_URL,
      hasSupabaseServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasLsApiKey: !!process.env.LS_API_KEY,
      hasLsStoreId: !!process.env.LS_STORE_ID,
      hasLsWebhookSecret: !!process.env.LS_WEBHOOK_SECRET,
      hasLsVariantCruiser: !!process.env.LS_VARIANT_CRUISER,
      hasLsVariantPower: !!process.env.LS_VARIANT_POWER,
      hasLsVariantPro: !!process.env.LS_VARIANT_PRO,
      hasOpenAiKeyTest: !!process.env.OPENAI_API_KEY_TEST,
      hasOpenAiKeyLive: !!process.env.OPENAI_API_KEY_LIVE,
      hasStripeSecretTest: !!process.env.STRIPE_SECRET_KEY_TEST,
      hasStripeSecretLive: !!process.env.STRIPE_SECRET_KEY_LIVE,
      hasResendKey: !!process.env.RESEND_API_KEY,
      billingMode: process.env.VITE_BILLING_MODE || 'not set',
      earlyAccess: process.env.VITE_EARLY_ACCESS || 'not set',
      supabaseUrlPreview: process.env.VITE_SUPABASE_URL?.substring(0, 30) + '...' || 'NOT SET',
      nodeEnv: process.env.NODE_ENV || 'unknown'
    };

    // Test Supabase connection
    let supabaseTest: { success: boolean, error: string | null, hasData: boolean } = { success: false, error: 'Not tested', hasData: false };

    if (envCheck.hasSupabaseUrl && envCheck.hasSupabaseServiceRole) {
      try {
        const supa = createClient(
          process.env.VITE_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Try to query the mvp_fuel table
        const { data, error } = await supa.from('mvp_fuel').select('user_id').limit(1);
        supabaseTest = {
          success: !error,
          error: error?.message || null,
          hasData: Array.isArray(data) && data.length > 0
        };
      } catch (e: any) {
        supabaseTest = { success: false, error: e.message, hasData: false };
      }
    }

    // Test mvp_billing table access
    let billingTest: { success: boolean, error: string | null, hasData: boolean } = { success: false, error: 'Not tested', hasData: false };
    if (supabaseTest.success) {
      try {
        const supa = createClient(
          process.env.VITE_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        const { data, error } = await supa.from('mvp_billing').select('*').limit(1);
        billingTest = {
          success: !error,
          error: error?.message || null,
          hasData: Array.isArray(data) && data.length > 0
        };
      } catch (e: any) {
        billingTest = { success: false, error: e.message, hasData: false };
      }
    }

    // Test v_account view access
    let viewTest: { success: boolean, error: string | null } = { success: false, error: 'Not tested' };
    if (supabaseTest.success) {
      try {
        const supa = createClient(
          process.env.VITE_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        const { data, error } = await supa.from('v_account').select('*').limit(1);
        viewTest = {
          success: !error,
          error: error?.message || null
        };
      } catch (e: any) {
        viewTest = { success: false, error: e.message };
      }
    }

    return res.status(200).json({
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
      envCheck,
      supabaseTest,
      billingTest,
      viewTest,
      status: envCheck.hasSupabaseUrl && envCheck.hasSupabaseServiceRole && supabaseTest.success ? 'healthy' : 'needs_attention'
    });
  } catch (error: any) {
    return res.status(500).json({ 
      error: 'Debug endpoint failed', 
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}