// src/pages/Account.tsx
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { FuelMeter } from '../components/FuelMeter';
import { useAccount } from '../hooks/useAccount';
import Chat from '../components/Chat';
import { IS_TEST } from '@/config/appMode';

type LogRow = {
  created_at: string;
  message_id: string | null;
  tokens_spent: number;
};

export default function Account() {
  const [userId, setUserId] = useState<string | null>(null);
  const [session, setSession] = useState<any>(null);
  const { account, loading, error, refresh } = useAccount(userId);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [logsErr, setLogsErr] = useState<string | null>(null);
  const [billingInfo, setBillingInfo] = useState<any>(null);

  useEffect(() => {
    // Get current session
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      const uid = data.session?.user?.id ?? null;
      setUserId(uid);
      if (uid) console.log('🔑 USER ID:', uid);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUserId(session?.user?.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const [logsLoading, setLogsLoading] = useState(false);

  useEffect(() => {
    async function fetchData() {
      if (!userId) return;

      // Fetch billing info
      const { data: billing } = await supabase
        .from('mvp_billing')
        .select('tier, status, customer_id, subscription_id')
        .eq('user_id', userId)
        .maybeSingle();
      setBillingInfo(billing);

      // Fetch usage logs
      setLogsLoading(true);
      const { data, error } = await supabase
        .from('mvp_usage_logs')
        .select('created_at,message_id,tokens_spent')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) setLogsErr(error.message);
      else setLogs(data as any);
      setLogsLoading(false);
    }
    fetchData();
  }, [userId]);

  if (!session) return <div className="p-6 text-white/70">Sign in to view your account.</div>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 space-y-8">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-white">Account</h1>
        {IS_TEST && (
          <span className="text-xs text-yellow-400 px-2 py-0.5 rounded border border-yellow-400/30 bg-yellow-400/10">
            Test Mode
          </span>
        )}
      </div>

      {/* Account Overview & Fuel */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-6">
          <div>
            <div className="text-white/60 mb-1">Tier</div>
            <div className="font-medium text-white capitalize">{billingInfo?.tier ?? 'Free'}</div>
          </div>
          <div>
            <div className="text-white/60 mb-1">Status</div>
            <div className="font-medium text-white capitalize">{billingInfo?.status ?? 'inactive'}</div>
          </div>
        </div>

        <div className="mt-6">
          {loading ? (
            <div className="text-white/60 text-sm">Loading fuel…</div>
          ) : error ? (
            <div className="text-red-400 text-sm">Error: {error}</div>
          ) : (
            <FuelMeter
              userId={userId}
              personal={account?.personal_tokens}
              reserve={account?.reserve_tokens}
              pool={account?.pool_bonus_tokens}
              total={account?.total_available}
            />
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={refresh}
            className="px-4 py-2 text-sm text-white/70 hover:text-white transition-colors"
          >
            Refresh
          </button>
          {/* Refuel buttons */}
          {!billingInfo && (
            <>
              <button
                onClick={async () => {
                  if (!userId) return;
                  try {
                    const res = await fetch('/api/create-checkout-session', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ userId, tier: 'cruiser' }),
                    });
                    const data = await res.json();
                    if (data.url) window.location.href = data.url;
                  } catch (err) {
                    console.error('Checkout failed:', err);
                    alert('Failed to create checkout session');
                  }
                }}
                className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                Cruiser ($9.99/mo)
              </button>
              <button
                onClick={async () => {
                  if (!userId) return;
                  try {
                    const res = await fetch('/api/create-checkout-session', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ userId, tier: 'power' }),
                    });
                    const data = await res.json();
                    if (data.url) window.location.href = data.url;
                  } catch (err) {
                    console.error('Checkout failed:', err);
                    alert('Failed to create checkout session');
                  }
                }}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Power ($19.99/mo)
              </button>
              <button
                onClick={async () => {
                  if (!userId) return;
                  try {
                    const res = await fetch('/api/create-checkout-session', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ userId, tier: 'pro' }),
                    });
                    const data = await res.json();
                    if (data.url) window.location.href = data.url;
                  } catch (err) {
                    console.error('Checkout failed:', err);
                    alert('Failed to create checkout session');
                  }
                }}
                className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                Pro ($39.99/mo)
              </button>
            </>
          )}
          {billingInfo && (
            <button
              onClick={async () => {
                if (!userId) return;
                try {
                  const res = await fetch('/api/router?action=stripe-portal', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId }),
                  });
                  const data = await res.json();
                  if (!res.ok) {
                    console.error('Portal error:', data);
                    alert(`Error: ${data.error || 'Failed to open billing portal'}`);
                    return;
                  }
                  if (data.url) window.location.href = data.url;
                } catch (err) {
                  console.error('Portal request failed:', err);
                  alert('Failed to open billing portal');
                }
              }}
              className="px-4 py-2 text-sm bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
            >
              Manage Billing
            </button>
          )}
        </div>
      </div>

      {/* Recent Usage */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="mb-4 text-sm text-white/60">Recent usage</div>
        {logsErr && <div className="text-red-400 text-sm mb-3">Error: {logsErr}</div>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-white/60">
              <tr>
                <th className="text-left py-2 px-2">Time</th>
                <th className="text-left py-2 px-2">Message</th>
                <th className="text-right py-2 px-2">Tokens</th>
              </tr>
            </thead>
            <tbody className="text-white/80">
              {logsLoading ? (
                <>
                  {[1, 2, 3].map((i) => (
                    <tr key={i} className="border-t border-white/10">
                      <td className="py-2 px-2"><div className="skel h-4 w-20"></div></td>
                      <td className="py-2 px-2"><div className="skel h-4 w-16"></div></td>
                      <td className="py-2 px-2"><div className="skel h-4 w-16 ml-auto"></div></td>
                    </tr>
                  ))}
                </>
              ) : (
                <>
                  {logs.map((r) => (
                    <tr key={`${r.created_at}-${r.message_id ?? ''}`} className="border-t border-white/10">
                      <td className="py-2 px-2">{new Date(r.created_at).toLocaleTimeString()}</td>
                      <td className="py-2 px-2 font-mono text-xs text-white/60">
                        {r.message_id ? r.message_id.slice(0, 8) : '—'}
                      </td>
                      <td className="py-2 px-2 text-right font-medium">{r.tokens_spent?.toLocaleString() ?? 0}</td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr>
                      <td className="py-4 text-white/60 text-center" colSpan={3}>
                        No usage yet.
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chat Interface */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-4">Chat</h2>
        <Chat />
      </div>
    </div>
  );
}
