/** Shared domain types (used by both server and client). */

/** Synchronisation status of a Vercel copy vs. its live Lovable source. */
export type SyncStatus = 'up-to-date' | 'obsolete' | 'unknown';

export interface Site {
  id: string;
  /** Human-friendly name shown in the UI. */
  name: string;
  /** Source SPA on Lovable, e.g. https://mak-agency.lovable.app */
  lovableUrl: string;
  /** Public target where the static copy is served, e.g. https://mak-agency.com */
  vercelUrl: string;
  /** Optional Vercel project name (informational / legacy). */
  vercelProject?: string;
  /**
   * Vercel project ID to deploy into (e.g. prj_xxx). Combined with the org id
   * from the environment, this targets an existing project instead of letting
   * the CLI create a new one. This is the reliable way to update a project on
   * modern Vercel CLI (the old `--name` flag is deprecated).
   */
  vercelProjectId?: string;
  /** Hash of the live Lovable render captured during the last successful prerender. */
  baselineHash?: string;
  /** ISO date of the last successful prerender + deploy. */
  lastDeploy?: string;
  /** Deployment URL returned by the Vercel CLI on the last deploy. */
  lastDeployUrl?: string;
  /** Result of the most recent obsolescence check (cached for display). */
  lastStatus?: SyncStatus;
  /** ISO date of the most recent obsolescence check. */
  lastCheckedAt?: string;
  /** Last error message (prerender/deploy), if any. */
  lastError?: string;
}

export type JobStatus = 'running' | 'success' | 'failed';

export interface Job {
  id: string;
  siteId: string;
  siteName: string;
  status: JobStatus;
  /** Chronological log lines (stdout/stderr of the pipeline). */
  logs: string[];
  startedAt: string;
  finishedAt?: string;
  error?: string;
  /** Deployment URL once the deploy step succeeds. */
  deploymentUrl?: string;
}

/** Persisted application state (secrets are NEVER stored here — only in env). */
export interface AppState {
  sites: Site[];
}

/** Site shape returned to the client (identical here — no server-only fields). */
export type SitePublic = Site;
