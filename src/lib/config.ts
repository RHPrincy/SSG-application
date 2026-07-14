/**
 * Server-side configuration. Reads secrets from environment variables ONLY.
 * This module must never be imported from a Client Component.
 */
import path from 'node:path';
import type { Site } from './types';

export const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');
export const STATE_FILE = path.join(DATA_DIR, 'state.json');
export const OUTPUT_DIR = path.join(DATA_DIR, 'output');

export const CLONE_SCRIPT = path.resolve(process.env.CLONE_SCRIPT || './scripts/clone.js');

export const AUTH_SECRET = process.env.AUTH_SECRET || '';
export const ACCESS_CODE = process.env.ACCESS_CODE || '';
export const TOKEN_TTL = process.env.TOKEN_TTL || '8h';

export const VERCEL_TOKEN = process.env.VERCEL_TOKEN || '';
export const VERCEL_BIN = process.env.VERCEL_BIN || 'vercel';
export const VERCEL_ORG_ID = process.env.VERCEL_ORG_ID || '';
export const VERCEL_SCOPE = process.env.VERCEL_SCOPE || '';

/** Default sites seeded on first run (editable afterwards via Settings). */
export const DEFAULT_SITES: Site[] = [
  {
    id: 'comparateur-agent-ia',
    name: 'Comparateur Agent IA',
    lovableUrl: 'https://comparateur-agent-ia.lovable.app',
    vercelUrl: '',
  },
  {
    id: 'generateur-ai',
    name: 'Générateur AI',
    lovableUrl: 'https://generateur-ai.lovable.app',
    vercelUrl: '',
  },
  {
    id: 'mak-agency',
    name: 'MAK Agency',
    lovableUrl: 'https://mak-agency.lovable.app',
    vercelUrl: '',
  },
];

/** Fail fast if critical secrets are missing (called from sensitive routes). */
export function assertServerConfig(): string | null {
  if (!ACCESS_CODE) return 'ACCESS_CODE manquant dans la configuration serveur (.env).';
  if (!AUTH_SECRET) return 'AUTH_SECRET manquant dans la configuration serveur (.env).';
  return null;
}
