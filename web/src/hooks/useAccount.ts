/**
 * @stable V16 — Supabase breakdown (personal/reserve/pool). Keep for FuelMeter/Account.
 */

// src/hooks/useAccount.ts
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

export type AccountData = {
  user_id: string;
  personal_tokens: number;
  reserve_tokens: number;
  pool_bonus_tokens: number;
  total_available: number;
};

/**
 * Hook to fetch and poll account data from v_account view
 * Polls every 5 seconds to keep balance fresh
 */
export function useAccount(userId?: string | null) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [account, setAccount] = useState<AccountData | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  const fetchAccount = useCallback(async () => {
    // If no userId provided, try to get from auth
    let uid = userId;
    if (!uid) {
      const { data: auth } = await supabase.auth.getUser();
      uid = auth.user?.id ?? null;
    }

    if (!uid) {
      if (isMountedRef.current) {
        setLoading(false);
        setAccount(null);
      }
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('v_account')
        .select('user_id, personal_tokens, reserve_tokens, pool_bonus_tokens')
        .eq('user_id', uid)
        .maybeSingle();

      if (!isMountedRef.current) return;

      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      if (data) {
        const accountData: AccountData = {
          user_id: data.user_id,
          personal_tokens: data.personal_tokens ?? 0,
          reserve_tokens: data.reserve_tokens ?? 0,
          pool_bonus_tokens: data.pool_bonus_tokens ?? 0,
          total_available:
            (data.personal_tokens ?? 0) +
            (data.reserve_tokens ?? 0) +
            (data.pool_bonus_tokens ?? 0),
        };
        setAccount(accountData);
        setError(null);
      } else {
        // No account found - user has no fuel records yet
        setAccount(null);
      }
      setLoading(false);
    } catch (err: any) {
      if (isMountedRef.current) {
        setError(err?.message || 'Failed to fetch account');
        setLoading(false);
      }
    }
  }, [userId]);

  useEffect(() => {
    isMountedRef.current = true;

    // Initial fetch
    fetchAccount();

    // Poll every 5 seconds
    intervalRef.current = setInterval(() => {
      fetchAccount();
    }, 5000);

    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchAccount]);

  return {
    account,
    loading,
    error,
    refresh: fetchAccount,
  };
}
