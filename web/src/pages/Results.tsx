// Purpose: Display quiz attempts and results
// Connects to: Dashboard, quizzes table, PageShell

import { PageShell } from "@/components/PageShell";
import { Card } from "@/components/Card";

export default function ResultsPage() {
  // TODO: Fetch real quiz attempts from Supabase
  const mockAttempts = Array.from({ length: 6 }).map((_, i) => ({
    id: `quiz-${i}`,
    title: `Quiz #${i + 1}`,
    score: "—",
    takenAt: "—",
  }));

  return (
    <PageShell>
      <section className="mb-6">
        <div className="flex items-baseline gap-2 mb-4">
          <h2 className="text-[32px] font-semibold tracking-[-.2px] m-0">Results</h2>
          <small className="text-muted">Your quiz history and scores</small>
        </div>

        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {mockAttempts.map((attempt) => (
            <Card key={attempt.id} title={attempt.title} meta={`Score: ${attempt.score} • Taken: ${attempt.takenAt}`}>
              <div className="flex gap-2 mt-2">
                <button className="btn text-sm">View</button>
                <button className="btn text-sm">Retake</button>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
