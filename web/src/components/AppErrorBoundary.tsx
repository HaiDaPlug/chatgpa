// src/components/AppErrorBoundary.tsx
import { Component, ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { hasError: boolean };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err: any) { console.error('AppErrorBoundary:', err); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen grid place-items-center p-6" style={{ background: 'var(--bg)' }}>
          <div className="max-w-md text-center space-y-4">
            <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Something went wrong</h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              An unexpected error occurred. You can try reloading or return to the dashboard.
            </p>
            {/* ✅ Add escape route - user should never be trapped */}
            <div className="flex gap-3 justify-center">
              <button
                className="btn primary px-6 py-2"
                onClick={() => window.location.href = '/dashboard'}
              >
                Back to Dashboard
              </button>
              <button
                className="btn ghost px-6 py-2"
                onClick={() => location.reload()}
              >
                Reload
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
