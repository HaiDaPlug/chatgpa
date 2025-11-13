// web/src/pages/Dashboard.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useQueryNumber, useQueryParam } from "@/lib/useQueryParam";
import { useToast } from "@/lib/toast";
import { PageShell } from "@/components/PageShell";
import { Card } from "@/components/Card";
import { Tabs } from "@/components/Tabs";
import { CreateClassDialog } from "@/components/CreateClassDialog"; // ← use your dialog
import type { ClassRow } from "@/types";

const PAGE_SIZE = 10;

export default function DashboardPage() {
  const { push } = useToast();
  const [q, setQ] = useQueryParam("q", "");
  const [page, setPage] = useQueryNumber("page", 1);
  const [view, setView] = useState<"Grid" | "List">("Grid");

  const [rows, setRows] = useState<ClassRow[] | null>(null);
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  async function fetchClasses() {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    try {
      let query = supabase
        .from("classes")
        .select("*", { count: "exact" })
        .order("updated_at", { ascending: false, nullsFirst: false })
        .range(from, to);

      if (q.trim()) query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);

      const { data, count: c, error } = await query;
      if (error) throw error;
      if (ac.signal.aborted) return;

      setRows((data ?? []) as ClassRow[]);
      setCount(c ?? 0);
    } catch {
      push({ kind: "error", text: "Couldn’t load classes. Try again." });
    } finally {
      if (!abortRef.current?.signal.aborted) setLoading(false);
    }
  }

  useEffect(() => { fetchClasses(); }, [q, page]);

  return (
    <PageShell>
      {/* Title */}
      <section className="mb-6">
        <div className="flex items-baseline gap-2 mb-4">
          <h2 className="text-[32px] font-semibold tracking-[-.2px] m-0">Your Dashboard</h2>
          <small className="text-muted">Overview of your study activity</small>
        </div>

        {/* Metrics */}
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4 mb-8">
          <Metric label="Total Classes" value={String(count)} loading={loading} />
          <Metric label="Quizzes Taken" value="—" />
          <Metric label="Study Streak" value="—" />
          <Metric label="Next Exam" value="—" />
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Tabs value={view} onChange={(v)=>setView(v as any)} items={["Grid","List"]}/>
            <div className="surface bdr radius px-2 py-1 ml-2">
              <input
                className="bg-transparent outline-none text-sm"
                placeholder="Search classes…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn" onClick={fetchClasses}>Refresh</button>
            <button className="btn primary" onClick={()=>setShowCreate(true)}>Create Class</button>
          </div>
        </div>

        {/* Content */}
        {loading && !rows && <SkeletonGrid/>}
        {!loading && rows && rows.length === 0 && (
          <EmptyState
            title={q ? "No classes match your search" : "No classes yet"}
            hint={q ? "Try a different keyword." : "Create your first class to get started."}
            onPrimary={!q ? ()=>setShowCreate(true) : undefined}
          />
        )}
        {rows && rows.length > 0 && (
          <div className={view==="Grid"
            ? "grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
            : "grid gap-2"}>
            {rows.map((c) => (
              <Card key={c.id} title={c.name} meta={c.description ?? "—"}>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Chip>Add Notes</Chip>
                  <Chip>Generate Quiz</Chip>
                  <Chip>View Progress</Chip>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-muted">Page {page} / {totalPages} • {count} total</div>
          <div className="flex items-center gap-2">
            <button className="btn" disabled={page<=1} onClick={()=>setPage(page-1)}>Prev</button>
            <button className="btn" disabled={page>=totalPages} onClick={()=>setPage(page+1)}>Next</button>
          </div>
        </div>
      </section>

      {/* Your modal: onCreated → refetch + toast is handled inside your file */}
      <CreateClassDialog
        open={showCreate}
        onClose={()=>setShowCreate(false)}
        onCreated={()=>{
          // return to first page and refetch so the new class is visible immediately
          if (page !== 1) setPage(1);
          fetchClasses();
          // optional: local success toast here if your dialog didn't already push
          // push({ kind:"success", text:"Class created." });
        }}
      />
    </PageShell>
  );
}

function Metric({label,value,loading}:{label:string;value:string;loading?:boolean}) {
  return (
    <div className="surface bdr radius elev-1 p-6 transition-transform hover:-translate-y-[2px]">
      <div className="text-[12px] text-muted mb-1">{label}</div>
      <div className="text-[24px] font-semibold tracking-[-.3px]">{loading ? "…" : value}</div>
    </div>
  );
}
function Chip({children}:{children:React.ReactNode}) {
  return <button className="text-[12px] px-3 py-1 radius surface-2 bdr">{children}</button>;
}
function SkeletonGrid(){
  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 mb-8">
      {Array.from({length:6}).map((_,i)=>(
        <div key={i} className="surface bdr radius elev-1 p-6 animate-pulse">
          <div className="h-4 w-24 surface-2 radius mb-2"></div>
          <div className="h-7 w-32 surface-2 radius"></div>
        </div>
      ))}
    </div>
  );
}
function EmptyState({ title, hint, onPrimary }:{
  title:string; hint:string; onPrimary?:()=>void;
}){
  return (
    <div className="surface bdr radius elev-1 p-8 flex items-center justify-between">
      <div>
        <h3 className="text-[18px] font-semibold m-0 mb-1">{title}</h3>
        <p className="text-sm text-muted m-0">{hint}</p>
      </div>
      {onPrimary && <button className="btn" onClick={onPrimary}>Create Class</button>}
    </div>
  );
}
