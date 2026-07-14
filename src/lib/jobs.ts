/**
 * In-memory job registry for pre-render / deploy runs.
 *
 * Jobs are kept in a module-level Map. The app runs as a single instance
 * (see README / pm2 config), so in-memory state is shared across all API
 * routes in the same process. A `globalThis` stash keeps the registry alive
 * across Next.js dev hot-reloads.
 */
import { randomUUID } from 'node:crypto';
import type { Job } from './types';

type Registry = Map<string, Job>;

const g = globalThis as unknown as { __prJobs?: Registry };
const jobs: Registry = g.__prJobs ?? (g.__prJobs = new Map());

const MAX_LOG_LINES = 2000;

export function createJob(siteId: string, siteName: string): Job {
  const job: Job = {
    id: randomUUID(),
    siteId,
    siteName,
    status: 'running',
    logs: [],
    startedAt: new Date().toISOString(),
  };
  jobs.set(job.id, job);
  return job;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

/** Most recent job for a given site (used to resume log polling after reload). */
export function latestJobForSite(siteId: string): Job | undefined {
  let latest: Job | undefined;
  for (const j of jobs.values()) {
    if (j.siteId !== siteId) continue;
    if (!latest || j.startedAt > latest.startedAt) latest = j;
  }
  return latest;
}

export function appendLog(id: string, line: string): void {
  const job = jobs.get(id);
  if (!job) return;
  for (const l of line.split(/\r?\n/)) {
    if (l.length) job.logs.push(l);
  }
  if (job.logs.length > MAX_LOG_LINES) {
    job.logs.splice(0, job.logs.length - MAX_LOG_LINES);
  }
}

export function finishJob(
  id: string,
  status: 'success' | 'failed',
  extra?: { error?: string; deploymentUrl?: string },
): void {
  const job = jobs.get(id);
  if (!job) return;
  job.status = status;
  job.finishedAt = new Date().toISOString();
  if (extra?.error) job.error = extra.error;
  if (extra?.deploymentUrl) job.deploymentUrl = extra.deploymentUrl;
}
