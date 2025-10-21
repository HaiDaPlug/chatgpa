import { supabase } from '@/lib/supabase';

export default function AuthTest() {
  if (!supabase) {
    return <div className="text-sm opacity-70 p-4">Loading auth…</div>;
  }

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google' });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleGetUser = async () => {
    const { data } = await supabase.auth.getUser();
    console.log(data);
  };

  return (
    <div className="p-4 space-y-2">
      <button onClick={handleLogin} className="rounded bg-white text-black px-3 py-2">Login</button>
      <button onClick={handleLogout} className="rounded bg-white/10 px-3 py-2">Logout</button>
      <button onClick={handleGetUser} className="rounded bg-white/10 px-3 py-2">Get user</button>
    </div>
  );
}
