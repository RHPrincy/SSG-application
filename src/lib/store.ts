/**
 * Tiny JSON-file persistence for the site list and their metadata.
 *
 * A single JSON file (data/state.json) is enough here: the app runs as one
 * instance on a VPS and writes are infrequent (a deploy finishing, a site being
 * added). Writes are serialised through an in-process promise chain to avoid
 * interleaved reads/writes corrupting the file.
 */
import { promises as fs } from 'node:fs';
import { DATA_DIR, STATE_FILE, DEFAULT_SITES } from './config';
import type { AppState, Site } from './types';

let writeChain: Promise<void> = Promise.resolve();

async function ensureDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function readState(): Promise<AppState> {
  await ensureDir();
  try {
    const raw = await fs.readFile(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as AppState;
    if (!parsed.sites) parsed.sites = [];
    return parsed;
  } catch {
    // First run — seed with the default sites and persist them.
    const seed: AppState = { sites: DEFAULT_SITES };
    await writeState(seed);
    return seed;
  }
}

export async function writeState(state: AppState): Promise<void> {
  // Chain writes so concurrent callers can't clobber each other.
  writeChain = writeChain.then(async () => {
    await ensureDir();
    const tmp = `${STATE_FILE}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(state, null, 2), 'utf8');
    await fs.rename(tmp, STATE_FILE); // atomic replace
  });
  return writeChain;
}

export async function getSites(): Promise<Site[]> {
  return (await readState()).sites;
}

export async function getSite(id: string): Promise<Site | undefined> {
  return (await readState()).sites.find((s) => s.id === id);
}

/** Apply a partial patch to a single site and persist. Returns the updated site. */
export async function updateSite(
  id: string,
  patch: Partial<Site>,
): Promise<Site | undefined> {
  const state = await readState();
  const idx = state.sites.findIndex((s) => s.id === id);
  if (idx === -1) return undefined;
  state.sites[idx] = { ...state.sites[idx], ...patch, id };
  await writeState(state);
  return state.sites[idx];
}

export async function addSite(site: Site): Promise<Site> {
  const state = await readState();
  if (state.sites.some((s) => s.id === site.id)) {
    throw new Error(`Un site avec l'identifiant « ${site.id} » existe déjà.`);
  }
  state.sites.push(site);
  await writeState(state);
  return site;
}

export async function removeSite(id: string): Promise<boolean> {
  const state = await readState();
  const before = state.sites.length;
  state.sites = state.sites.filter((s) => s.id !== id);
  if (state.sites.length === before) return false;
  await writeState(state);
  return true;
}

/** Slugify a free-text name into a stable, filesystem-safe id. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
