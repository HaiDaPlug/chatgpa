import { supabase } from "./supabase";

/** Returns the current user id (or null if signed out). */
export async function getUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user?.id ?? null;
}

/** Returns the current session (or null). */
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

/** Sign out and (optionally) redirect after. */
export async function signOut(redirectTo?: string) {
  await supabase.auth.signOut();
  if (redirectTo) location.href = redirectTo;
}

/** Subscribe to auth changes; returns an unsubscribe fn. */
export function onAuthChange(cb: (authed: boolean) => void) {
  const sub = supabase.auth.onAuthStateChange((_e, session) => cb(!!session));
  // also emit current
  supabase.auth.getSession().then(({ data }) => cb(!!data.session));
  return () => sub.data.subscription.unsubscribe();
}

/** Guard: resolves when a session exists; rejects if none. */
export async function requireSession() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Not authenticated");
  return data.session;
}
