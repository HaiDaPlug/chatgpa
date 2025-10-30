// web/src/pages/dashboard.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CreateClassDialog } from "@/components/CreateClassDialog";
import { letterFromPct } from "@/lib/letter"; // small helper you already saw

type ClassRow = { id: string; name: string; description: string | null; };
type Attempt = { id: string; score: number; created_at: string; quizzes: { id: string } };

export default function Dashboard() {
  const [classes, setClasses] = useState<ClassRow[] | null>(null);
  const [attempts, setAttempts] = useState<Attempt[] | null>(null);
  const [open, setOpen] = useState(false);

  const canCreateClass = useMemo(() => (classes?.length ?? 0) < 1, [classes]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const { data: cls } = await supabase.from("classes").select("id,name,description").order("created_at", { ascending: false });
      setClasses(cls ?? []);

      const { data: atts } = await supabase
        .from("quiz_attempts")
        .select("id,score,created_at,quizzes!inner(id)")
        .order("created_at", { ascending: false })
        .limit(10);
      setAttempts(atts ?? []);
    })();
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-stone-100">Your Dashboard</h1>
        <p className="text-stone-400">Track classes and recent results.</p>
      </header>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium text-stone-200">Your Classes</h2>
        {canCreateClass && <Button onClick={()=>setOpen(true)}>+ Create Class</Button>}
      </div>

      {/* Classes Grid */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {classes === null && Array.from({ length: 3 }).map((_,i)=>
          <Card key={i} className="h-28 animate-pulse bg-stone-900/60" />
        )}
        {classes?.map(c =>
          <Card key={c.id} className="p-4">
            <div className="mb-1 text-stone-100">{c.name}</div>
            <div className="text-sm text-stone-400 line-clamp-2">{c.description || "No description"}</div>
          </Card>
        )}
        {classes && classes.length === 0 && (
          <Card className="p-4">
            <div className="mb-2 text-stone-100">No classes yet</div>
            <p className="mb-3 text-sm text-stone-400">Create your first class to start generating quizzes.</p>
            {canCreateClass && <Button onClick={()=>setOpen(true)}>Create Class</Button>}
          </Card>
        )}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium text-stone-200">Recent Results</h2>
      </div>

      {/* Results List */}
      <div className="space-y-3">
        {attempts === null && Array.from({ length: 4 }).map((_,i)=>
          <Card key={i} className="h-16 animate-pulse bg-stone-900/60" />
        )}
        {attempts?.map(a => {
          const pct = Math.round(a.score * 100);
          return (
            <Card key={a.id} className="flex items-center justify-between p-4">
              <div>
                <div className="text-stone-100">Quiz {a.quizzes.id.slice(0,8)}</div>
                <div className="text-xs text-stone-500">{new Date(a.created_at).toLocaleString()}</div>
              </div>
              <div className="rounded-xl bg-stone-800 px-3 py-1 text-sm text-stone-200">
                {letterFromPct(pct)} · {pct}%
              </div>
            </Card>
          );
        })}
        {attempts && attempts.length === 0 && (
          <Card className="p-4 text-stone-300">No results yet. Generate a quiz to see your progress.</Card>
        )}
      </div>

      <CreateClassDialog open={open} onClose={()=>setOpen(false)} onCreated={async ()=>{
        const { data } = await supabase.from("classes").select("id,name,description").order("created_at", { ascending: false });
        setClasses(data ?? []);
      }} />
    </div>
  );
}
