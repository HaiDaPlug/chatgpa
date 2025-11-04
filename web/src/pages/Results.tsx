// Purpose: Display quiz attempts and results
// Connects to: Dashboard, quizzes table, PageShell

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "@/components/PageShell";
import { Card } from "@/components/Card";
import { supabase } from "@/lib/supabase";
import { log } from "@/lib/telemetry";

type AttemptRow = {
  id: string;
  score: number | null;
  created_at: string;
  quiz: {
    id: string;
    class: {
      name: string;
    }[];
  }[];
};

export default function ResultsPage() {
  const navigate = useNavigate();
  const [attempts, setAttempts] = useState<AttemptRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { data, error: fetchError } = await supabase
          .from('quiz_attempts')
          .select(`
            id,
            score,
            created_at,
            quiz:quizzes (
              id,
              class:classes ( name )
            )
          `)
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;

        setAttempts(data as AttemptRow[]);
        log("attempts_loaded", { count: data?.length ?? 0 });
      } catch (e: any) {
        setError(e.message || "Failed to load quiz attempts");
        log("dashboard_error", { error: e.message });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const formatScore = (score: number | null) => {
    if (score === null || score === undefined) return "—";
    return `${Math.round(score * 100)}%`;
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return "—";
    }
  };

  return (
    <PageShell>
      <section className="mb-6">
        <div className="flex items-baseline gap-2 mb-4">
          <h2 className="text-[32px] font-semibold tracking-[-.2px] m-0">Results</h2>
          <small className="text-muted">Your quiz history and scores</small>
        </div>

        {loading && (
          <div className="surface bdr radius elev-1 p-8 text-center">
            <p className="text-muted m-0">Loading quiz attempts...</p>
          </div>
        )}

        {error && (
          <div className="surface bdr radius elev-1 p-8 text-center">
            <p className="text-muted m-0">{error}</p>
            <button className="btn mt-4" onClick={() => window.location.reload()}>Retry</button>
          </div>
        )}

        {!loading && !error && attempts && attempts.length === 0 && (
          <div className="surface bdr radius elev-1 p-8 text-center">
            <h3 className="text-[18px] font-semibold m-0 mb-1">No quiz attempts yet</h3>
            <p className="text-sm text-muted m-0 mb-4">Generate a quiz from your classes to get started.</p>
            <button className="btn" onClick={() => navigate('/dashboard')}>Go to Dashboard</button>
          </div>
        )}

        {!loading && !error && attempts && attempts.length > 0 && (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {attempts.map((attempt) => {
              const quiz = attempt.quiz?.[0];
              const className = quiz?.class?.[0]?.name || "Unknown Class";
              const title = `${className} Quiz`;
              const meta = `Score: ${formatScore(attempt.score)} • ${formatDate(attempt.created_at)}`;
              const quizId = quiz?.id;

              return (
                <Card key={attempt.id} title={title} meta={meta}>
                  <div className="flex gap-2 mt-2">
                    <button
                      className="btn text-sm"
                      onClick={() => quizId && navigate(`/quiz/${quizId}`)}
                      disabled={!quizId}
                    >
                      View
                    </button>
                    <button
                      className="btn text-sm"
                      onClick={() => quizId && navigate(`/quiz/${quizId}`)}
                      disabled={!quizId}
                    >
                      Retake
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </PageShell>
  );
}
