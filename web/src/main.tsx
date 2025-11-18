import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import './theme-tokens.css';  // Design tokens V2 (theme system)
import './theme.css';         // Legacy base styles
import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { ToastProvider } from '@/lib/toast';

// ✅ Theme System V2: Apply data attributes on startup
function initializeTheme() {
  const root = document.documentElement;

  // Read preferences from localStorage (defaults: academic-dark, study-blue, inter, normal, full)
  const theme = localStorage.getItem('chatgpa.theme') || 'academic-dark';
  const accent = localStorage.getItem('chatgpa.accent') || 'study-blue';
  const font = localStorage.getItem('chatgpa.font') || 'inter';
  const contrast = localStorage.getItem('chatgpa.contrast') || 'normal';
  const motion = localStorage.getItem('chatgpa.motion') || 'full';

  // Set data attributes on <html>
  root.dataset.theme = theme;
  root.dataset.accent = accent;
  root.dataset.font = font;
  root.dataset.contrast = contrast;
  root.dataset.motion = motion;

  // Respect system motion preference
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches && motion !== 'full') {
    root.dataset.motion = 'reduced';
  }
}

// Apply theme before rendering
initializeTheme();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <ToastProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ToastProvider>
    </AppErrorBoundary>
  </React.StrictMode>
);
