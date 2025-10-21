import { Routes, Route } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { Toaster } from 'sonner';

import Landing from './pages/Landing';
import QuizPage from './pages/QuizPage';
import WaitlistGate from './components/WaitlistGate';

export default function App() {
  return (
    <div className="min-h-screen flex flex-col"> {/* no bg/text here */}
      {/* Let each page control its own width/background */}
      <main className="flex-grow">
        <Routes>
          {/* */}

          {/* Root landing page (public, includes waitlist form) */}
          <Route path="/" element={<Landing />} />

          {/* Quiz page */}
          <Route path="/quiz/:id" element={<QuizPage />} />

          {/* Fallback → root landing */}
          <Route path="*" element={<Landing />} />
        </Routes>
      </main>

      <Analytics />
      <Toaster richColors position="top-center" />
    </div>
  );
}
