// src/hooks/useFuel.ts
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export type Fuel = { personal: number; reserve: number; pool_bonus: number };

type Balances = { personal: number; reserve: number; pool_bonus: number };
type BillingInfo = {
  tier: string | null;
  status: string | null;
  customer_id: string | null;
  subscription_id: string | null;
};
type Account = BillingInfo & {
  personal_tokens: number;
  reserve_tokens: number;
  pool_bonus_tokens: number;
};

export function useFuel(userId?: string | null) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [balances, setBalances] = useState<Balances>({ personal: 0, reserve: 0, pool_bonus: 0 });
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
      if (isMountedRef.current) setLoading(false);
      return;
    }

    // Fetch balances from v_account view
    const { data: accountData, error: accountError } = await supabase
      .from('v_account')
      .select('user_id,personal_tokens,reserve_tokens,pool_bonus_tokens')
      .eq('user_id', uid)
      .maybeSingle();

    // Fetch billing info from mvp_billing table
    const { data: billingData, error: billingError } = await supabase
      .from('mvp_billing')
      .select('tier,status,customer_id,subscription_id')
      .eq('user_id', uid)
      .maybeSingle();

    if (!isMountedRef.current) return;

    if (accountError) {
      setError(accountError.message);
      setLoading(false);
      return;
    }

    // Merge both data sources
    if (accountData) {
      const acc: Account = {
        tier: billingData?.tier ?? null,
        status: billingData?.status ?? null,
        customer_id: billingData?.customer_id ?? null,
        subscription_id: billingData?.subscription_id ?? null,
        personal_tokens: accountData.personal_tokens ?? 0,
        reserve_tokens: accountData.reserve_tokens ?? 0,
        pool_bonus_tokens: accountData.pool_bonus_tokens ?? 0,
      };
      setAccount(acc);
      setBalances({
        personal: acc.personal_tokens,
        reserve: acc.reserve_tokens,
        pool_bonus: acc.pool_bonus_tokens,
      });
      setError(null);
    } else {
      // No account data yet
      setAccount(null);
      setBalances({ personal: 0, reserve: 0, pool_bonus: 0 });
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    isMountedRef.current = true;

    // Initial fetch
    fetchAccount();

    // Poll every 5 seconds for live updates
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

  const total = useMemo(() => balances.personal + balances.reserve + balances.pool_bonus, [balances]);

  // Legacy compatibility: also expose as 'fuel'
  const fuel = useMemo(() => ({
    personal: balances.personal,
    reserve: balances.reserve,
    pool_bonus: balances.pool_bonus
  }), [balances]);

  return {
    fuel, // legacy
    loading,
    error,
    account,
    balances,
    total,
    refresh: fetchAccount,
  };
}
