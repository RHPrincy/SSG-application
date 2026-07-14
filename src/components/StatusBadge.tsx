import { CheckCircle2, AlertTriangle, HelpCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SyncStatus } from '@/lib/types';

type Display = SyncStatus | 'checking';

const MAP: Record<Display, { label: string; className: string; Icon: typeof CheckCircle2; spin?: boolean }> = {
  'up-to-date': {
    label: 'À jour',
    className: 'text-ok bg-ok-soft border-ok/30',
    Icon: CheckCircle2,
  },
  obsolete: {
    label: 'Obsolète',
    className: 'text-stale bg-stale-soft border-stale/30',
    Icon: AlertTriangle,
  },
  unknown: {
    label: 'Statut inconnu',
    className: 'text-unknown bg-unknown-soft border-unknown/30',
    Icon: HelpCircle,
  },
  checking: {
    label: 'Vérification…',
    className: 'text-muted bg-unknown-soft border-border',
    Icon: Loader2,
  },
};

export function StatusBadge({ status, className }: { status: Display; className?: string }) {
  const { label, className: c, Icon } = MAP[status];
  const spin = status === 'checking';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
        c,
        className,
      )}
    >
      <Icon className={cn('h-3.5 w-3.5', spin && 'animate-spin')} />
      {label}
    </span>
  );
}
