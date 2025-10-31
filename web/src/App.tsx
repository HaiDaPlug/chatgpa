import { Routes, Route } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';

import Landing from './pages/Landing';
import QuizPage from './pages/QuizPage';
import DashboardPage from './pages/dashboard';
import GeneratePage from './pages/generate';
import { RequireAuth } from '../lib/authGuard';

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-stone-950 text-stone-100">
      <main className="flex-grow">
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Landing />} />

          {/* Protected routes (require authentication) */}
          <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
          <Route path="/generate" element={<RequireAuth><GeneratePage /></RequireAuth>} />
          <Route path="/quiz/:id" element={<RequireAuth><QuizPage /></RequireAuth>} />

          {/* Fallback → root landing */}
          <Route path="*" element={<Landing />} />
        </Routes>
      </main>

      <Analytics />
    </div>
  );
}
