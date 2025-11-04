// Purpose: Flashcards tool stub - coming soon placeholder
// Connects to: Study Tools sidebar

import { PageShell } from "@/components/PageShell";
import { Card } from "@/components/Card";

export default function Flashcards() {
  return (
    <PageShell>
      <div className="mb-6">
        <h2 className="text-[32px] font-semibold tracking-[-.2px] m-0 mb-2">Flashcards</h2>
        <p className="text-muted m-0">Create interactive flashcards from your notes.</p>
      </div>

      <Card>
        <div className="p-8 text-center">
          <div className="text-[48px] mb-4">🃏</div>
          <h3 className="text-[18px] font-semibold m-0 mb-2">Coming Soon</h3>
          <p className="text-muted m-0">
            Flashcards feature is under development. Stay tuned!
          </p>
        </div>
      </Card>
    </PageShell>
  );
}
