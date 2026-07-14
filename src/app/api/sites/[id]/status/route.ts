import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-guard';
import { getSite, updateSite } from '@/lib/store';
import { computeLiveHash } from '@/lib/obsolescence';
import type { SyncStatus } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/sites/:id/status → re-check obsolescence.
 * Renders the live Lovable page, hashes its visible text and compares it to the
 * baseline captured at the last successful prerender.
 *   - no baseline .......... "unknown" (jamais prérendu)
 *   - render failed ........ "unknown"
 *   - hashes equal ......... "up-to-date"
 *   - hashes differ ........ "obsolete"
 */
export async function POST(req: Request, { params }: Ctx) {
  const denied = await requireAuth(req);
  if (denied) return denied;
  const { id } = await params;

  const site = await getSite(id);
  if (!site) return NextResponse.json({ error: 'Site introuvable.' }, { status: 404 });

  let status: SyncStatus;
  if (!site.baselineHash) {
    status = 'unknown';
  } else {
    const liveHash = await computeLiveHash(site.lovableUrl);
    if (!liveHash) status = 'unknown';
    else status = liveHash === site.baselineHash ? 'up-to-date' : 'obsolete';
  }

  const now = new Date().toISOString();
  const updated = await updateSite(id, { lastStatus: status, lastCheckedAt: now });
  return NextResponse.json({ status, checkedAt: now, site: updated });
}
