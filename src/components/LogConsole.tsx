'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { JobStatus } from '@/lib/types';

const STATUS_LABEL: Record<JobStatus, { text: string; dot: string }> = {
  running: { text: 'En cours', dot: 'bg-accent animate-pulse-soft' },
  success: { text: 'Succès', dot: 'bg-ok' },
  failed: { text: 'Échec', dot: 'bg-stale' },
};

export function LogConsole({ logs, status }: { logs: string[]; status: JobStatus }) {
  const ref = useRef<HTMLDivElement>(null);

  // Keep the newest line in view as logs stream in.
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [logs]);

  const meta = STATUS_LABEL[status];

  return (
    <div className="mt-4 overflow-hidden rounded-[var(--radius)] border border-border bg-bg">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className={cn('h-2 w-2 rounded-full', meta.dot)} />
        <span className="font-mono text-xs text-muted">{meta.text}</span>
        <span className="ml-auto font-mono text-xs text-faint">{logs.length} lignes</span>
      </div>
      <div
        ref={ref}
        className="scroll-thin max-h-56 overflow-y-auto px-3 py-2 font-mono text-xs leading-relaxed text-muted"
      >
        {logs.length === 0 ? (
          <span className="text-faint">initialisation…</span>
        ) : (
          logs.map((l, i) => (
            <div
              key={i}
              className={cn(
                'whitespace-pre-wrap break-words',
                /✖|ÉCHEC|Erreur|FAILED/i.test(l) && 'text-stale',
                /✔|Terminé|Succès|OK/i.test(l) && 'text-ok',
                /^\$ /.test(l) && 'text-accent',
              )}
            >
              {l}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
