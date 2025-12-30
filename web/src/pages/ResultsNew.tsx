/**
 * Results Page (Section 3) - Two-column layout
 * Ongoing (in_progress) | Results (submitted)
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { track } from "@/lib/telemetry";
import { PageShell } from "@/components/PageShell";
import { isValidUuid } from "@/lib/uuid";
import { useToast } from "@/lib/toast";

interface Attempt {
  id: string;
  quiz_id: string;
  title: string;
  subject: string;
  status: string;
  updated_at?: string;
  submitted_at?: string;
  score?: number;
  class_name?: string;
}

export default function ResultsPage() {
  const navigate = useNavigate();
  const { push } = useToast();
  const [ongoing, setOngoing] = useState<Attempt[]>([]);
  const [results, setResults] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    track("results_page_viewed");
    fetchAttempts();
  }, []);

  async function fetchAttempts() {
    try {
      const [ongoingRes, resultsRes] = await Promise.all([
        supabase
          .from("quiz_attempts")
          .select("id, quiz_id, title, subject, status, updated_at, class:classes(name)")
          .eq("status", "in_progress")
          .order("updated_at", { ascending: false })
          .limit(20),
        supabase
          .from("quiz_attempts")
          .select("id, title, subject, status, submitted_at, score, class:classes(name)")
          .eq("status", "submitted")
          .order("submitted_at", { ascending: false })
          .limit(20),
      ]);

      setOngoing((ongoingRes.data || []).map((a: any) => ({
        ...a,
        class_name: a.class?.name,
      })));

      setResults((resultsRes.data || []).map((a: any) => ({
        ...a,
        class_name: a.class?.name,
      })));
    } catch (error) {
      console.error("Failed to fetch attempts:", error);
    } finally {
      setLoading(false);
    }
  }

  const formatTime = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  if (loading) {
    return (
      <PageShell>
        <div className="p-8">
          <h1 className="text-2xl font-bold mb-6">Results</h1>
          <p className="text-muted">Loading...</p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-6">Results</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Ongoing */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Ongoing</h2>
            {ongoing.length === 0 ? (
              <div className="surface bdr radius p-6 text-center">
                <p className="text-muted mb-3">No ongoing quizzes.</p>
                <button className="btn" onClick={() => navigate("/tools/generate")}>
                  Generate Quiz
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {ongoing.map((a) => (
                  <div key={a.id} className="surface bdr radius p-4">
                    <h3 className="font-semibold mb-1">{a.title || "Untitled"}</h3>
                    <div className="text-sm text-muted mb-2">
                      {a.subject} • {formatTime(a.updated_at!)}
                    </div>
                    <button
                      className="btn btn-sm w-full"
                      onClick={() => {
                        // GUARD: Validate IDs before navigation
                        if (!isValidUuid(a.quiz_id) || !isValidUuid(a.id)) {
                          console.error('Invalid IDs in attempt:', {
                            quiz_id: a.quiz_id,
                            attempt_id: a.id
                          });
                          push({
                            kind: 'error',
                            text: 'This attempt has invalid data. Please contact support.'
                          });
                          return;
                        }
                        track("attempt_resume_clicked", { attempt_id: a.id });
                        navigate(`/quiz/${a.quiz_id}?attempt=${a.id}`);
                      }}
                    >
                      Resume
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Results */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Results</h2>
            {results.length === 0 ? (
              <div className="surface bdr radius p-6 text-center text-muted">
                No results yet.
              </div>
            ) : (
              <div className="space-y-3">
                {results.map((a) => {
                  const score = Math.round((a.score || 0) * 100);
                  const letter =
                    score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";

                  return (
                    <div key={a.id} className="surface bdr radius p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold">{a.title || "Untitled"}</h3>
                          <div className="text-sm text-muted">
                            {a.subject} • {formatTime(a.submitted_at!)}
                          </div>
                        </div>
                        <div className="text-2xl font-bold">{letter}</div>
                      </div>
                      <button
                        className="btn btn-sm btn-ghost w-full"
                        onClick={() => {
                          track("result_opened", { attempt_id: a.id });
                          navigate(`/attempts/${a.id}`);
                        }}
                      >
                        View Details
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
