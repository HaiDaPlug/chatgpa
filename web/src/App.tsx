import { Routes, Route } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { Toaster } from 'sonner';

import Landing from './pages/Landing';
import Chat from './pages/Chat';
import Account from './pages/Account';
import Debug from './pages/Debug';
import Pricing from './pages/Pricing';
import WaitlistGate from './components/WaitlistGate';

export default function App() {
  return (
    <div className="min-h-screen flex flex-col"> {/* no bg/text here */}
      {/* Let each page control its own width/background */}
      <main className="flex-grow">
        <Routes>
          {/* Debug page (first, to test if React works at all) */}
          <Route path="/debug" element={<Debug />} />

          {/* Root landing page (public, includes waitlist form) */}
          <Route path="/" element={<Landing />} />

          {/* Gated app pages */}
          <Route path="/chat" element={<WaitlistGate><Chat /></WaitlistGate>} />
          <Route path="/account" element={<WaitlistGate><Account /></WaitlistGate>} />
          <Route path="/pricing" element={<Pricing />} />

          {/* Fallback → root landing */}
          <Route path="*" element={<Landing />} />
        </Routes>
      </main>

      <Analytics />
      <Toaster richColors position="top-center" />
    </div>
  );
}
