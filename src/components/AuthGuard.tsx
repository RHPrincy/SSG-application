'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthed } from '@/lib/client';

/**
 * Client-side navigation guard. Real security is enforced by the API routes
 * (every protected endpoint verifies the JWT); this only prevents rendering the
 * shell without a token and bounces to /login.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isAuthed()) {
      router.replace('/login');
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        <span className="animate-pulse-soft font-mono text-sm">chargement…</span>
      </div>
    );
  }
  return <>{children}</>;
}
