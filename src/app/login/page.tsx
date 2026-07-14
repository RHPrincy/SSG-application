'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Zap, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { setToken, isAuthed } from '@/lib/client';

export default function LoginPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Already authenticated → skip login.
  useEffect(() => {
    if (isAuthed()) router.replace('/dashboard');
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Code d'accès incorrect.");
        return;
      }
      setToken(data.token);
      router.replace('/dashboard');
    } catch {
      setError('Impossible de contacter le serveur.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm animate-in">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-fg">
            <Zap className="h-6 w-6" strokeWidth={2.5} />
          </span>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Prerender Manager
          </h1>
          <p className="mt-1 text-sm text-muted">
            Pilotage du pré-rendu des sites Lovable
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-[var(--radius)] border border-border bg-surface/80 p-6 backdrop-blur-sm"
        >
          <div className="space-y-2">
            <Label htmlFor="code">Code d&apos;accès</Label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
              <Input
                id="code"
                type="password"
                autoFocus
                autoComplete="off"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Saisissez votre code"
                className="pl-9 font-mono"
              />
            </div>
          </div>

          {error && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <Button type="submit" className="mt-5 w-full" size="lg" loading={loading} disabled={!code}>
            {loading ? 'Vérification…' : 'Se connecter'}
          </Button>
        </form>

        <p className="mt-6 text-center font-mono text-xs text-faint">
          accès protégé · vérification côté serveur
        </p>
      </div>
    </main>
  );
}
