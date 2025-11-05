import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useQueryNumber, useQueryParam } from "@/lib/useQueryParam";
import { useDebounce } from "@/lib/useDebounce";
import { useToast } from "@/lib/toast";
import { PageShell } from "@/components/PageShell";
import { Card } from "@/components/Card";
import { Tabs } from "@/components/Tabs";
import type { ClassRow } from "@/types";
import { track } from "@/lib/telemetry";

const PAGE_SIZE = 10;

export default function DashboardPage() {
  const navigate = useNavigate();
  const { push } = useToast();
  const [q, setQ] = useQueryParam("q", "");
  const [page, setPage] = useQueryNumber("page", 1);
  const [view, setView] = useState<"Grid" | "List">("Grid");

  const [rows, setRows] = useState<ClassRow[] | null>(null);
  const [count, setCount] = useState<number>(0);
  const [quizCount, setQuizCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const qDebounced = useDebounce(q, 200);

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  // ⌘K / Ctrl+K keyboard shortcut for search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mac = navigator.userAgent.toLowerCase().includes("mac");
      if ((mac && e.metaKey && e.key.toLowerCase() === "k") ||
          (!mac && e.ctrlKey && e.key.toLowerCase() === "k")) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Fetch quiz count for usage display
  useEffect(() => {
    (async () => {
      const { count, error } = await supabase
        .from("quizzes")
        .select("*", { count: "exact", head: true });

      if (!error && count !== null) {
        setQuizCount(count);
      }
    })();
  }, []);

  // Fetch classes with search + pagination (debounced)
  useEffect(() => {
    (async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      setLoading(true);
      track("dashboard_loaded", { q: qDebounced, page });
      try {
        let query = supabase
          .from("classes")
          .select("*", { count: "exact" })
          .order("updated_at", { ascending: false, nullsFirst: false })
          .range(from, to);

        if (qDebounced.trim()) {
          // case-insensitive match on name or description
          query = query.or(`name.ilike.%${qDebounced}%,description.ilike.%${qDebounced}%`);
        }

        const { data, count: c, error } = await query;
        if (error) throw error;
        if (ac.signal.aborted) return;

        setRows(data as ClassRow[]);
        setCount(c ?? 0);
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          push({ kind: "error", text: "Couldn't load classes. Try again." });
          track("dashboard_loaded", { error: e?.message });
        }
      } finally {
        if (!abortRef.current?.signal.aborted) setLoading(false);
      }
    })();
  }, [qDebounced, page]);

  // Create Class
  async function onCreate() {
    const name = prompt("Class name?");
    if (!name) return;
    const description = prompt("Description (optional)") || null;

    try {
      setBusyId("create");
      const { data, error } = await supabase
        .from("classes")
        .insert([{ name, description }])
        .select()
        .single();
      if (error) throw error;

      // Reset to page 1 and refetch
      setPage(1);
      push({ kind: "success", text: "Class created." });
      log("create_class_success", { class_id: data?.id });
    } catch {
      push({ kind: "error", text: "Create failed." });
      log("create_class_error");
    } finally {
      setBusyId(null);
    }
  }

  // Generate Quiz moved to /tools/generate page
  // Dashboard button now navigates to dedicated tool page

  // Derive metrics (mock + counts)
  const metrics = useMemo(
    () => [
      { label: "Total Classes", value: count.toString() },
      { label: "Quizzes Taken", value: "—" },
      { label: "Study Streak", value: "—" },
      { label: "Next Exam", value: "—" },
    ],
    [count]
  );

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
          {metrics.map((m) => (
            <div key={m.label}
                 className="surface bdr radius elev-1 p-6 transition-transform hover:-translate-y-[2px]"
                 aria-busy={loading && m.label === "Total Classes"}>
              <div className="text-[12px] text-muted mb-1">{m.label}</div>
              <div className="text-[24px] font-semibold tracking-[-.3px]">
                {loading && m.label === "Total Classes" ? "…" : m.value}
              </div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Tabs value={view} onChange={(v)=>setView(v as any)} items={["Grid","List"]}/>
            <div className="surface bdr radius px-2 py-1 ml-2">
              <input
                ref={searchRef}
                className="bg-transparent outline-none text-sm"
                placeholder="Search classes… (⌘K)"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Usage count display */}
            {quizCount !== null && (
              <div className="surface-2 bdr radius px-3 py-1 text-xs text-muted">
                Quizzes: {quizCount} / 5
              </div>
            )}
            <button className="btn" onClick={()=>location.reload()}>Refresh</button>
            <button className="btn" disabled={busyId==="create"} onClick={onCreate}>
              {busyId==="create" ? "Creating…" : "Create Class"}
            </button>
          </div>
        </div>

        {/* Content */}
        {loading && !rows && <SkeletonGrid />}
        {!loading && rows && rows.length === 0 && (
          <EmptyState
            title={q ? "No classes match your search" : "No classes yet"}
            hint={q ? "Try a different keyword." : "Create your first class to get started."}
            onPrimary={!q ? onCreate : undefined}
          />
        )}

        {rows && rows.length > 0 && (
          <div className={view === "Grid"
            ? "grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
            : "grid gap-2"}>
            {rows.map((c) => (
              <Card key={c.id}
                    title={c.name}
                    meta={c.description ?? "—"}>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Chip onClick={()=>navigate(`/classes/${c.id}/notes`)}>Add Notes</Chip>
                  <Chip onClick={()=>navigate(`/tools/generate`)}>
                    Generate Quiz
                  </Chip>
                  <Chip onClick={()=>alert("View Progress (stub)")}>View Progress</Chip>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-muted">
            Page {page} / {totalPages} • {count} total
          </div>
          <div className="flex items-center gap-2">
            <button className="btn" disabled={page<=1} onClick={()=>setPage(page-1)}>Prev</button>
            <button className="btn" disabled={page>=totalPages} onClick={()=>setPage(page+1)}>Next</button>
          </div>
        </div>
      </section>
    </PageShell>
  );
}

function Chip({ children, onClick, disabled }:{children:React.ReactNode; onClick?:()=>void; disabled?:boolean}) {
  return <button onClick={onClick} disabled={disabled} className="text-[12px] px-3 py-1 radius surface-2 bdr disabled:opacity-50 disabled:cursor-not-allowed">{children}</button>;
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
