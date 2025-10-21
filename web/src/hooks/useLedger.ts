/**
 * @stable V16 — balance, bump, polling. Preferred for new code.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { IS_TEST } from '@/config/appMode';

export type LedgerData = {
  balance: number | null;
  tierCap?: number;
};

/**
 * Full return type of useLedger hook
 */
export type LedgerState = {
  balance: number | null;
  tierCap?: number | null;
  loading: boolean;
  refresh: () => Promise<void>;
  bump: (delta: number) => void;
};

/**
 * Hook to fetch and poll user fuel balance
 *
 * - Polls every 20-30s in test mode
 * - Provides refresh() for manual updates (e.g., after purchase)
 * - Provides bump() for optimistic balance updates
 * - Fallback to stub data if API not available
 *
 * Note: New code should use useLedger for balance tracking.
 * useAccount remains for account breakdown (personal/reserve/pool) used by FuelMeter.
 * We may consolidate these hooks in V17.
 */
export function useLedger(): LedgerState {
  const [balance, setBalance] = useState<number | null>(null);
  const [tierCap, setTierCap] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  const fetchBalance = useCallback(async () => {
    try {
      // Try to fetch from /api/account endpoint
      const response = await fetch('/api/account', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();

        if (isMountedRef.current) {
          setBalance(data.balance ?? data.total_available ?? null);
          setTierCap(data.tierCap ?? data.tier_cap);
          setLoading(false);

          if (IS_TEST) {
            console.log('[useLedger] Fetched balance:', {
              balance: data.balance ?? data.total_available,
              tierCap: data.tierCap ?? data.tier_cap,
            });
          }
        }
      } else {
        // API not available or error - use stub data
        if (isMountedRef.current) {
          setBalance(200_000);
          setTierCap(356_000);
          setLoading(false);

          if (IS_TEST) {
            console.log('[useLedger] Using stub data (API unavailable):', {
              balance: 200_000,
              tierCap: 356_000,
            });
          }
        }
      }
    } catch (err) {
      // Network error - use stub data
      if (isMountedRef.current) {
        setBalance(200_000);
        setTierCap(356_000);
        setLoading(false);

        if (IS_TEST) {
          console.log('[useLedger] Using stub data (fetch error):', err);
        }
      }
    }
  }, []);

  // Manual refresh function
  const refresh = useCallback(async () => {
    if (IS_TEST) {
      console.log('[useLedger] Manual refresh triggered');
    }
    await fetchBalance();
  }, [fetchBalance]);

  // Optimistic balance update (e.g., after spending tokens)
  const bump = useCallback((amount: number) => {
    setBalance((prev) => {
      if (prev === null) return prev;
      const newBalance = Math.max(0, prev + amount);

      if (IS_TEST) {
        console.log('[useLedger] Optimistic bump:', {
          previous: prev,
          change: amount,
          new: newBalance,
        });
      }

      return newBalance;
    });
  }, []);

  // Setup polling in test mode
  useEffect(() => {
    isMountedRef.current = true;

    // Initial fetch
    fetchBalance();

    // Poll every 20-30s in test mode
    if (IS_TEST) {
      // Random interval between 20-30 seconds to avoid thundering herd
      const pollInterval = 20_000 + Math.random() * 10_000;

      console.log(`[useLedger] Starting polling every ${Math.round(pollInterval / 1000)}s`);

      intervalRef.current = setInterval(() => {
        if (IS_TEST) {
          console.log('[useLedger] Polling for balance update...');
        }
        fetchBalance();
      }, pollInterval);
    }

    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        if (IS_TEST) {
          console.log('[useLedger] Polling stopped');
        }
      }
    };
  }, [fetchBalance]);

  return {
    balance,
    tierCap,
    loading,
    refresh,
    bump,
  };
}
