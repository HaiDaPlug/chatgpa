import { Routes, Route } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';

import Landing from './pages/Landing';
import QuizPage from './pages/QuizPage';
import DashboardPage from './pages/dashboard';
import GeneratePage from './pages/generate';
import ResultsPage from './pages/Results';
import ClassNotes from './pages/ClassNotes';
import { RequireAuth } from '../lib/authGuard';

// Study Tools
import Generate from './pages/tools/Generate';
import Flashcards from './pages/tools/Flashcards';
import Summarize from './pages/tools/Summarize';

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-grow">
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Landing />} />

          {/* Protected routes (require authentication) */}
          <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
          <Route path="/generate" element={<RequireAuth><Generate /></RequireAuth>} />
          <Route path="/results" element={<RequireAuth><ResultsPage /></RequireAuth>} />
          <Route path="/quiz/:id" element={<RequireAuth><QuizPage /></RequireAuth>} />
          <Route path="/classes/:id/notes" element={<RequireAuth><ClassNotes /></RequireAuth>} />

          {/* Study Tools routes */}
          <Route path="/tools/generate" element={<RequireAuth><Generate /></RequireAuth>} />
          <Route path="/tools/flashcards" element={<RequireAuth><Flashcards /></RequireAuth>} />
          <Route path="/tools/summarize" element={<RequireAuth><Summarize /></RequireAuth>} />

          {/* Fallback → root landing */}
          <Route path="*" element={<Landing />} />
        </Routes>
      </main>

      <Analytics />
    </div>
  );
}
