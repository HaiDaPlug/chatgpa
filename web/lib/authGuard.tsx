// Purpose: Auth guard for protected routes (dashboard, generate, quiz)
// Connects to: App.tsx routing, Supabase Auth

import { supabase } from "@/lib/supabase";
import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

export function useSession() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session ?? null);
    });

    return () => authListener?.subscription?.unsubscribe?.();
  }, []);

  return { session, loading };
}

export function RequireAuth({ children }: { children: JSX.Element }) {
  const { session, loading } = useSession();
  const location = useLocation();

  // Show nothing while checking session (prevents flash)
  if (loading) return null;

  // Redirect to landing if not authenticated
  if (!session) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  return children;
}
