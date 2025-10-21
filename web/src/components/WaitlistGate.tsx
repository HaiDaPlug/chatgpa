import { useEffect, useState } from 'react';

export default function WaitlistGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<{ ready: boolean; allow: boolean }>({
    ready: false,
    allow: false,
  });

  useEffect(() => {
    fetch('/api/me', { credentials: 'include' })
      .then(r => r.json())
      .then(({ bypass, waitlist }) => {
        const allow = !waitlist || bypass;
        setStatus({ ready: true, allow });
      })
      .catch(() => setStatus({ ready: true, allow: true })); // fail-open locally
  }, []);

  if (!status.ready) return null; // could render a loader instead
  return status.allow ? <>{children}</> : (window.location.href = '/#fuel', null);
}
