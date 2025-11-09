/**
 * Attempt Detail Page (Section 3)
 * /attempts/:id - View/edit attempt with autosave
 * Features: Resume in_progress, view submitted, autosave, conflict resolution
 */

import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useBlocker } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { track } from "@/lib/telemetry";
import { useToast } from "@/lib/toast";
import { PageShell } from "@/components/PageShell";

interface Attempt {
  id: string;
  quiz_id: string;
  title: string;
  subject: string;
  status: "in_progress" | "submitted";
  responses: Record<string, string>;
  autosave_version: number;
  started_at: string;
  updated_at: string;
  submitted_at?: string;
  score?: number;
  grading?: any;
  class_id?: string;
  class_name?: string;
  questions: any[];
}

const AUTOSAVE_INTERVAL = 5000; // 5 seconds
const LS_KEY_PREFIX = "attempt_autosave_";

export default function AttemptDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { push } = useToast();

  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const autosaveTimer = useRef<number | null>(null);
  const lastAutosaveVersion = useRef<number>(0);

  // Blocker to prevent navigation when dirty
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && attempt?.status === "in_progress" && currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    if (id) {
      fetchAttempt();
    }

    return () => {
      if (autosaveTimer.current) {
        window.clearTimeout(autosaveTimer.current);
      }
    };
  }, [id]);

  // Autosave on change
  useEffect(() => {
    if (!isDirty || !attempt || attempt.status !== "in_progress") return;

    if (autosaveTimer.current) {
      window.clearTimeout(autosaveTimer.current);
    }

    autosaveTimer.current = window.setTimeout(() => {
      performAutosave();
    }, AUTOSAVE_INTERVAL);

    return () => {
      if (autosaveTimer.current) {
        window.clearTimeout(autosaveTimer.current);
      }
    };
  }, [answers, isDirty]);

  // Beforeunload handler
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty && attempt?.status === "in_progress") {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Save before leaving?";
        performAutosave(); // Try to save on exit
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty, attempt]);

  async function fetchAttempt() {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("quiz_attempts")
        .select(`
          id,
          quiz_id,
          title,
          subject,
          status,
          responses,
          autosave_version,
          started_at,
          updated_at,
          submitted_at,
          score,
          grading,
          class_id,
          class:classes(name),
          quiz:quizzes(questions)
        `)
        .eq("id", id!)
        .single();

      if (error || !data) {
        push({ kind: "error", text: "Attempt not found" });
        navigate("/results");
        return;
      }

      const attemptData: Attempt = {
        ...data,
        class_name: (data.class as any)?.name,
        questions: (data.quiz as any)?.questions || [],
      };

      setAttempt(attemptData);
      lastAutosaveVersion.current = attemptData.autosave_version;

      // Check for local backup (conflict resolution)
      const lsKey = LS_KEY_PREFIX + id;
      const localBackup = localStorage.getItem(lsKey);

      if (localBackup && attemptData.status === "in_progress") {
        try {
          const backup = JSON.parse(localBackup);

          // Bidirectional conflict check
          if (backup.autosave_version > attemptData.autosave_version) {
            // Local is newer
            if (confirm("Found newer local answers. Use local version?")) {
              setAnswers(backup.responses);
              setIsDirty(true);
            } else {
              setAnswers(attemptData.responses || {});
            }
          } else if (backup.autosave_version < attemptData.autosave_version) {
            // Server is newer
            if (confirm("Server has newer version. Keep server version?")) {
              setAnswers(attemptData.responses || {});
              localStorage.removeItem(lsKey); // Clear old backup
            } else {
              setAnswers(backup.responses);
              setIsDirty(true);
            }
          } else {
            // Equal versions
            setAnswers(attemptData.responses || {});
          }
        } catch {
          setAnswers(attemptData.responses || {});
        }
      } else {
        setAnswers(attemptData.responses || {});
      }
    } catch (error) {
      console.error("Failed to fetch attempt:", error);
      push({ kind: "error", text: "Failed to load attempt" });
    } finally {
      setLoading(false);
    }
  }

  async function performAutosave() {
    if (!attempt || attempt.status !== "in_progress") return;

    try {
      // Save to localStorage first (instant backup)
      const lsKey = LS_KEY_PREFIX + id;
      localStorage.setItem(
        lsKey,
        JSON.stringify({
          responses: answers,
          autosave_version: lastAutosaveVersion.current + 1,
          updated_at: new Date().toISOString(),
        })
      );

      // Save to server
      const response = await fetch("/api/attempts/autosave", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          attempt_id: id,
          responses: answers,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        lastAutosaveVersion.current = data.autosave_version;
        setLastSaved(new Date());
        setIsDirty(false);
        track("attempt_autosave_success", { attempt_id: id });
      } else {
        throw new Error("Autosave failed");
      }
    } catch (error) {
      console.error("Autosave error:", error);
      track("attempt_autosave_fail", { attempt_id: id });
      // Keep local backup, don't clear it
    }
  }

  async function handleSubmit() {
    if (!attempt) return;

    track("attempt_submit_clicked", { attempt_id: id });
    setIsSubmitting(true);

    try {
      // Save any pending changes first
      if (isDirty) {
        await performAutosave();
      }

      const response = await fetch("/api/grade", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          attempt_id: id,
          responses: answers,
        }),
      });

      if (response.ok) {
        track("attempt_submit_success", { attempt_id: id });

        // Clear local backup
        localStorage.removeItem(LS_KEY_PREFIX + id);

        push({ kind: "success", text: "Quiz submitted!" });

        // Refresh to show results
        await fetchAttempt();
      } else {
        const error = await response.json();
        throw new Error(error.message || "Submit failed");
      }
    } catch (error: any) {
      track("attempt_submit_fail", { attempt_id: id });
      push({ kind: "error", text: error.message || "Failed to submit quiz" });
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleAnswerChange(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setIsDirty(true);
  }

  if (loading) {
    return (
      <PageShell>
        <div className="p-8">Loading...</div>
      </PageShell>
    );
  }

  if (!attempt) {
    return (
      <PageShell>
        <div className="p-8">Attempt not found</div>
      </PageShell>
    );
  }

  const isInProgress = attempt.status === "in_progress";
  const isSubmitted = attempt.status === "submitted";

  return (
    <PageShell>
      {/* Blocker Dialog */}
      {blocker.state === "blocked" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="surface bdr radius p-6 max-w-md">
            <h2 className="text-xl font-bold mb-4">Unsaved Changes</h2>
            <p className="text-muted mb-6">You have unsaved answers. What would you like to do?</p>
            <div className="flex gap-3">
              <button
                className="btn flex-1"
                onClick={async () => {
                  await performAutosave();
                  blocker.proceed();
                }}
              >
                Save & Leave
              </button>
              <button className="btn btn-ghost flex-1" onClick={() => blocker.reset()}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="text-sm text-muted mb-2">
            {attempt.class_name || "Uncategorized"} › Results › Attempt
          </div>
          <h1 className="text-2xl font-bold mb-2">{attempt.title}</h1>
          <div className="flex items-center gap-3 text-sm">
            <span className="px-2 py-1 bg-accent/10 text-accent rounded">{attempt.subject}</span>
            {isInProgress && lastSaved && (
              <span className="text-muted">
                Saved {Math.floor((Date.now() - lastSaved.getTime()) / 1000)}s ago
              </span>
            )}
            {isSubmitted && attempt.score !== undefined && (
              <span className="font-semibold">Score: {Math.round(attempt.score * 100)}%</span>
            )}
          </div>
        </div>

        {/* Questions */}
        <div className="space-y-6">
          {attempt.questions.map((q: any, idx: number) => (
            <div key={q.id} className="surface bdr radius p-6">
              <div className="font-semibold mb-3">
                {idx + 1}. {q.prompt}
              </div>

              {q.type === "mcq" && (
                <div className="space-y-2">
                  {q.options.map((opt: string) => (
                    <label key={opt} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name={q.id}
                        value={opt}
                        checked={answers[q.id] === opt}
                        onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                        disabled={isSubmitted}
                        className="cursor-pointer"
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              )}

              {(q.type === "short" || q.type === "long") && (
                <textarea
                  className="w-full p-3 border rounded resize-none"
                  rows={q.type === "long" ? 6 : 3}
                  value={answers[q.id] || ""}
                  onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                  disabled={isSubmitted}
                  placeholder="Your answer..."
                />
              )}

              {isSubmitted && attempt.grading?.[q.id] && (
                <div className="mt-3 p-3 bg-accent/5 rounded text-sm">
                  <div className="font-semibold mb-1">
                    {attempt.grading[q.id].score > 0 ? "✓" : "✗"} Score: {attempt.grading[q.id].score}
                  </div>
                  {attempt.grading[q.id].feedback && (
                    <div className="text-muted">{attempt.grading[q.id].feedback}</div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="mt-8 flex gap-3">
          {isInProgress && (
            <>
              <button
                className="btn flex-1"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Submitting..." : "Submit Quiz"}
              </button>
              <button className="btn btn-ghost" onClick={() => navigate("/results")}>
                Save & Exit
              </button>
            </>
          )}

          {isSubmitted && (
            <button className="btn btn-ghost" onClick={() => navigate("/results")}>
              Back to Results
            </button>
          )}
        </div>
      </div>
    </PageShell>
  );
}
