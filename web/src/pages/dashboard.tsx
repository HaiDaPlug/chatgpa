import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { letterFromPct } from "@/lib/letter";
import { friendlyError } from "@/lib/error-messages";
import { log } from "@/lib/telemetry";

// Your existing toast util (same one used elsewhere)
import { push } from "@/lib/toast"; // adjust path if needed

type ClassRow = { id: string; name: string; description: string | null };
type Attempt = { id: string; score: number; created_at: string; quizzes: { id: string } | null };

// ---- Create Class Dialog (optimistic, guarded, double-submit protected)
function CreateClassDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        push({ type: "error", message: friendlyError(null, "auth") });
        return;
      }
      // Free plan: max 1 class (UI hint; RLS/enforcement still on server)
      const { count, error: countErr } = await supabase
        .from("classes").select("id", { count: "exact", head: true });
      if (countErr) {
        console.error(countErr);
        push({ type: "error", message: friendlyError(countErr, "classes") });
        return;
      }
      if ((count ?? 0) >= 1) {
        push({ type: "error", message: "Free plan allows 1 class. Upgrade to add more." });
        return;
      }

      const { error } = await supabase.from("classes").insert({ name: name.trim(), description: desc.trim() || null });
      if (error) {
        console.error(error);
        log("create_class_error", { message: error.message });
        push({ type: "error", message: friendlyError(error, "classes") });
        return;
      }
      log("create_class_success");
      push({ type: "success", message: "Class created" });
      setName(""); setDesc("");
      await onCreated(); // refresh list; errors handled upstream
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={() => !busy && onClose()}>
      <h3 className="mb-2 text-lg font-semibold text-stone-100">Create Class</h3>
      <div className="space-y-3">
        <input
          className="w-full rounded-xl bg-stone-800 px-3 py-2 text-stone-100 outline-none ring-1 ring-stone-700"
          placeholder="Class name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={busy}
        />
        <textarea
          className="w-full rounded-xl bg-stone-800 px-3 py-2 text-stone-100 outline-none ring-1 ring-stone-700"
          placeholder="Description (optional)"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          disabled={busy}
        />
        <div className="flex justify-end gap-2">
          <Button className="bg-stone-700 hover:bg-stone-600" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!name.trim() || busy}>
            {busy ? "Creating…" : "Create"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

// ---- Dashboard Page
export default function Dashboard() {
  const [classes, setClasses] = useState<ClassRow[] | null>(null);
  const [attempts, setAttempts] = useState<Attempt[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authMissing, setAuthMissing] = useState(false);
  const [creating, setCreating] = useState(false);

  // pagination (load more)
  const [page, setPage] = useState(0); // 0-based pages of 10
  const pageSize = 10;
  const loadingRef = useRef(false);

  // Abort in-flight requests when navigating away
  const abortRef = useRef<AbortController | null>(null);

  const canCreateClass = useMemo(() => (classes?.length ?? 0) < 1, [classes]);

  async function loadData({ reset = false, retries = 0 }: { reset?: boolean; retries?: number } = {}) {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setError(null);

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setAuthMissing(true);
        log("auth_missing");
        return;
      }
      setAuthMissing(false);

      // Load classes
      const { data: cls, error: clsErr } = await supabase
        .from("classes")
        .select("id,name,description")
        .order("created_at", { ascending: false })
        .abortSignal?.(signal as any) ?? { data: null, error: null }; // TS appeasement for older supabase versions

      if (clsErr) {
        console.error(clsErr);
        setError(friendlyError(clsErr, "classes"));
        log("dashboard_error", { source: "classes", message: clsErr.message });
        return;
      }
      setClasses(cls ?? []);
      log("classes_loaded", { count: (cls ?? []).length });

      // Load attempts (paged)
      const from = 0;
      const to = (page + 1) * pageSize - 1;
      const { data: atts, error: attErr } = await supabase
        .from("quiz_attempts")
        .select("id,score,created_at,quizzes!inner(id)")
        .order("created_at", { ascending: false })
        .range(from, to);

      if (attErr) {
        console.error(attErr);
        setError(friendlyError(attErr, "attempts"));
        log("dashboard_error", { source: "attempts", message: attErr.message });
        return;
      }
      setAttempts((atts ?? []) as Attempt[]);
      log("attempts_loaded", { count: (atts ?? []).length });
      log("dashboard_loaded");
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      console.error(err);
      const msg = friendlyError(err, /auth/i.test(String(err)) ? "auth" : "unknown");
      setError(msg);
      log("dashboard_error", { source: "unknown", message: String(err?.message || err) });
      // simple backoff: retry up to 2 more times
      if (retries < 2) {
        const delay = 1000 * (retries + 1);
        await new Promise((r) => setTimeout(r, delay));
        await loadData({ reset, retries: retries + 1 });
      }
    } finally {
      loadingRef.current = false;
    }
  }

  useEffect(() => {
    loadData({ reset: true });
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // Auth action (button): send user to your Landing (auth entry)
  function handleSignIn() {
    // Keep it simple for now (routes to your Landing.tsx)
    window.location.href = "/";
  }

  const hasError = Boolean(error);
  const isLoading = classes === null || attempts === null;

  return (
    <div className="relative z-0 mx-auto max-w-6xl px-4 py-8" aria-live="polite">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-stone-100">Your Dashboard</h1>
        <p className="text-stone-400">Track classes and recent results.</p>
      </header>

      {/* Auth missing banner */}
      {authMissing && (
        <Card className="mb-4 p-4">
          <div className="flex items-center justify-between">
            <div className="text-stone-200">Please log in to continue.</div>
            <Button onClick={handleSignIn}>Sign in</Button>
          </div>
        </Card>
      )}

      {/* Top actions */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium text-stone-200">Your Classes</h2>
        {canCreateClass ? (
          <Button onClick={() => setCreating(true)}>+ Create Class</Button>
        ) : (
          <span className="text-sm text-stone-400">Free plan: 1 class</span>
        )}
      </div>

      {/* Classes grid */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading &&
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="h-28 animate-pulse bg-stone-900/60" />
          ))}

        {!isLoading &&
          classes?.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="mb-1 text-stone-100">{c.name}</div>
              <div className="text-sm text-stone-400 line-clamp-2">
                {c.description || "No description"}
              </div>
            </Card>
          ))}

        {!isLoading && (classes?.length ?? 0) === 0 && (
          <Card className="p-4">
            <div className="mb-2 text-stone-100">No classes yet</div>
            <p className="mb-3 text-sm text-stone-400">
              Create your first class to start generating quizzes.
            </p>
            {canCreateClass && <Button onClick={() => setCreating(true)}>Create Class</Button>}
          </Card>
        )}
      </div>

      {/* Results header with Refresh + Load More */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium text-stone-200">Recent Results</h2>
        <div className="flex items-center gap-2">
          <Button onClick={() => { log("refresh_clicked"); loadData({ reset: true }); }} disabled={loadingRef.current}>
            Refresh
          </Button>
          <Button
            onClick={() => setPage((p) => p + 1)}
            disabled={loadingRef.current || (attempts?.length ?? 0) < (page + 1) * pageSize}
          >
            Load more
          </Button>
        </div>
      </div>

      {/* Results list */}
      <div className="space-y-3">
        {isLoading &&
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="h-16 animate-pulse bg-stone-900/60" />
          ))}

        {!isLoading &&
          attempts?.map((a) => {
            const pctRaw = Number.isFinite(a.score) ? Math.round((a.score as number) * 100) : 0;
            const pct = Math.max(0, Math.min(100, pctRaw));
            const quizId = a.quizzes?.id ? a.quizzes.id.slice(0, 8) : "unknown";
            return (
              <Card key={a.id} className="flex items-center justify-between p-4">
                <div>
                  <div className="text-stone-100">Quiz {quizId}</div>
                  <div className="text-xs text-stone-500">
                    {new Date(a.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="rounded-xl bg-stone-800 px-3 py-1 text-sm text-stone-200">
                  {letterFromPct(pct)} · {pct}%
                </div>
              </Card>
            );
          })}

        {!isLoading && (attempts?.length ?? 0) === 0 && (
          <Card className="p-4 text-stone-300">
            No results yet. Generate a quiz to see your progress.
          </Card>
        )}
      </div>

      {/* Error state (distinct from empty) */}
      {hasError && (
        <Card className="mt-4 flex items-center justify-between p-4">
          <div className="text-stone-200">{error}</div>
          <Button
            onClick={() => {
              log("retry_clicked");
              loadData({ reset: true });
            }}
            disabled={loadingRef.current}
          >
            Retry
          </Button>
        </Card>
      )}

      {/* Create Class dialog */}
      <CreateClassDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={async () => {
          try {
            const { data } = await supabase
              .from("classes")
              .select("id,name,description")
              .order("created_at", { ascending: false });
            setClasses(data ?? []);
          } catch (e) {
            console.error(e);
            push({ type: "error", message: friendlyError(e, "classes") });
          }
        }}
      />
    </div>
  );
}
