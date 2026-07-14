'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCw, RefreshCw, Loader2 } from 'lucide-react';
import { AuthGuard } from '@/components/AuthGuard';
import { TopBar } from '@/components/TopBar';
import { SiteCard, type CardJob } from '@/components/SiteCard';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/client';
import type { Job, Site } from '@/lib/types';

type CardJobState = CardJob & { jobId: string };

function DashboardInner() {
  const [sites, setSites] = useState<Site[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Record<string, CardJobState>>({});
  const [checking, setChecking] = useState<Record<string, boolean>>({});

  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;

  const loadSites = useCallback(async () => {
    try {
      const data = await api<{ sites: Site[] }>('/api/sites');
      setSites(data.sites);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    loadSites();
  }, [loadSites]);

  // --- job polling ---------------------------------------------------------
  const hasRunning = Object.values(jobs).some((j) => j.status === 'running');
  useEffect(() => {
    if (!hasRunning) return;
    const interval = setInterval(async () => {
      const entries = Object.entries(jobsRef.current).filter(([, j]) => j.status === 'running');
      let anyFinished = false;
      for (const [siteId, j] of entries) {
        try {
          const { job } = await api<{ job: Job }>(`/api/jobs/${j.jobId}`);
          setJobs((prev) => ({
            ...prev,
            [siteId]: {
              jobId: j.jobId,
              status: job.status,
              logs: job.logs,
              deploymentUrl: job.deploymentUrl,
              error: job.error,
            },
          }));
          if (job.status !== 'running') anyFinished = true;
        } catch {
          /* keep polling; transient error */
        }
      }
      // A job just finished → refresh site metadata (status, dates).
      if (anyFinished) loadSites();
    }, 1400);
    return () => clearInterval(interval);
  }, [hasRunning, loadSites]);

  // --- actions -------------------------------------------------------------
  const prerender = useCallback(async (site: Site) => {
    try {
      const { jobId } = await api<{ jobId: string }>(`/api/sites/${site.id}/prerender`, {
        method: 'POST',
      });
      setJobs((prev) => ({
        ...prev,
        [site.id]: { jobId, status: 'running', logs: [] },
      }));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const checkStatus = useCallback(async (site: Site) => {
    setChecking((prev) => ({ ...prev, [site.id]: true }));
    try {
      const { site: updated } = await api<{ site: Site }>(`/api/sites/${site.id}/status`, {
        method: 'POST',
      });
      if (updated) {
        setSites((prev) => (prev ? prev.map((s) => (s.id === site.id ? updated : s)) : prev));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setChecking((prev) => ({ ...prev, [site.id]: false }));
    }
  }, []);

  const prerenderAll = useCallback(() => {
    sites?.forEach((s) => prerender(s));
  }, [sites, prerender]);

  const checkAll = useCallback(() => {
    sites?.forEach((s) => checkStatus(s));
  }, [sites, checkStatus]);

  const anyRunning = Object.values(jobs).some((j) => j.status === 'running');
  const anyChecking = Object.values(checking).some(Boolean);

  return (
    <div className="min-h-screen">
      <TopBar />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">Sites gérés</h1>
            <p className="mt-1 text-sm text-muted">
              Pré-rendu, déploiement Vercel et suivi de l&apos;obsolescence.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={checkAll} loading={anyChecking} disabled={!sites?.length}>
              <RefreshCw className={anyChecking ? 'hidden' : 'h-4 w-4'} />
              Tout vérifier
            </Button>
            <Button size="sm" onClick={prerenderAll} loading={anyRunning} disabled={!sites?.length}>
              <RotateCw className={anyRunning ? 'hidden' : 'h-4 w-4'} />
              Tout mettre à jour
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-[var(--radius)] border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        {sites === null ? (
          <div className="flex items-center justify-center py-24 text-muted">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            <span className="font-mono text-sm">chargement des sites…</span>
          </div>
        ) : sites.length === 0 ? (
          <div className="rounded-[var(--radius)] border border-dashed border-border py-24 text-center">
            <p className="text-muted">Aucun site configuré.</p>
            <p className="mt-1 text-sm text-faint">
              Ajoutez-en un depuis la page <span className="text-accent">Paramètres</span>.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {sites.map((site) => (
              <SiteCard
                key={site.id}
                site={site}
                job={jobs[site.id]}
                checking={checking[site.id]}
                onPrerender={() => prerender(site)}
                onCheck={() => checkStatus(site)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardInner />
    </AuthGuard>
  );
}
