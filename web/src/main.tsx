import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import './theme-tokens.css';  // Design tokens (WCAG AA compliant)
import './theme.css';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { ToastProvider } from '@/lib/toast';

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
