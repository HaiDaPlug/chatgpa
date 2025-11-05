// Purpose: Summarize tool stub - coming soon placeholder
// Connects to: Study Tools sidebar

import { PageShell } from "@/components/PageShell";

export default function Summarize() {
  return (
    <PageShell>
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h2 className="text-[32px] font-semibold tracking-[-.2px] m-0 mb-2">Summarize</h2>
          <p className="text-muted m-0">Generate AI-powered summaries of your notes.</p>
        </div>

        <div className="surface bdr radius p-8 text-center">
          <div className="text-[48px] mb-4">📝</div>
          <h3 className="text-[18px] font-semibold m-0 mb-2">Coming Soon</h3>
          <p className="text-muted m-0 max-w-md mx-auto">
            Summarize feature is under development. Focus on Generate → Take → Results for Alpha.
          </p>
        </div>
      </div>
    </PageShell>
  );
}
