/**
 * Supabase Admin Client
 *
 * Uses service_role key for admin operations
 * ONLY use server-side (API routes, Server Actions)
 * NEVER expose service_role key to client
 */

import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase credentials for admin client')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

/**
 * Use this for operations that bypass RLS
 * Examples:
 * - Stripe webhook handling (updating entitlements)
 * - Admin-only operations
 * - Cross-user queries (analytics, etc.)
 */
