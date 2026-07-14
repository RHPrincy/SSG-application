'use client';

import { RefreshCw, RotateCw, ExternalLink, Globe, Cloud, Clock, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/StatusBadge';
import { LogConsole } from '@/components/LogConsole';
import { formatDate, timeAgo } from '@/lib/utils';
import type { Job, Site } from '@/lib/types';

export interface CardJob {
  status: Job['status'];
  logs: string[];
  deploymentUrl?: string;
  error?: string;
}

export function SiteCard({
  site,
  job,
  checking,
  onPrerender,
  onCheck,
}: {
  site: Site;
  job?: CardJob;
  checking?: boolean;
  onPrerender: () => void;
  onCheck: () => void;
}) {
  const running = job?.status === 'running';
  const displayStatus = checking ? 'checking' : site.lastStatus ?? 'unknown';

  return (
    <Card className="animate-in overflow-hidden">
      <CardContent className="p-5">
        {/* Header: name + status */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-display text-lg font-semibold">{site.name}</h3>
            <p className="mt-0.5 font-mono text-xs text-faint">{site.id}</p>
          </div>
          <StatusBadge status={displayStatus} />
        </div>

        {/* URLs */}
        <div className="mt-4 space-y-2 text-sm">
          <a
            href={site.lovableUrl}
            target="_blank"
            rel="noreferrer"
            className="group flex items-center gap-2 text-muted transition-colors hover:text-ink"
          >
            <Globe className="h-4 w-4 shrink-0 text-faint" />
            <span className="truncate font-mono text-xs">{site.lovableUrl}</span>
            <ExternalLink className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
          </a>
          {site.vercelUrl ? (
            <a
              href={site.vercelUrl}
              target="_blank"
              rel="noreferrer"
              className="group flex items-center gap-2 text-muted transition-colors hover:text-ink"
            >
              <Cloud className="h-4 w-4 shrink-0 text-faint" />
              <span className="truncate font-mono text-xs">{site.vercelUrl}</span>
              <ExternalLink className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
            </a>
          ) : (
            <div className="flex items-center gap-2 text-faint">
              <Cloud className="h-4 w-4 shrink-0" />
              <span className="font-mono text-xs">cible Vercel non configurée</span>
            </div>
          )}
        </div>

        {/* Last deploy */}
        <div className="mt-4 flex items-center gap-2 border-t border-border pt-4 text-xs text-muted">
          <Clock className="h-3.5 w-3.5 text-faint" />
          <span>
            Dernier pré-rendu :{' '}
            <span className="font-mono text-ink">{formatDate(site.lastDeploy)}</span>
          </span>
          {site.lastCheckedAt && !checking && (
            <span className="ml-auto font-mono text-faint">vérifié {timeAgo(site.lastCheckedAt)}</span>
          )}
        </div>

        {/* Error banner */}
        {site.lastError && !running && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-stale/30 bg-stale-soft px-3 py-2 text-xs text-stale">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="break-words">{site.lastError}</span>
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={onPrerender} loading={running} disabled={running}>
            <RotateCw className={running ? 'hidden' : 'h-4 w-4'} />
            {running ? 'Mise à jour…' : 'Mettre à jour'}
          </Button>
          <Button size="sm" variant="outline" onClick={onCheck} loading={checking} disabled={checking || running}>
            <RefreshCw className={checking ? 'hidden' : 'h-4 w-4'} />
            Vérifier le statut
          </Button>
          {(job?.deploymentUrl || site.lastDeployUrl) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => window.open(job?.deploymentUrl || site.lastDeployUrl, '_blank')}
            >
              <ExternalLink className="h-4 w-4" />
              Voir le déploiement
            </Button>
          )}
        </div>

        {/* Live logs */}
        {job && <LogConsole logs={job.logs} status={job.status} />}
      </CardContent>
    </Card>
  );
}
