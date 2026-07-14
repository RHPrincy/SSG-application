import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-guard';
import { getSite } from '@/lib/store';
import { createJob } from '@/lib/jobs';
import { runPrerenderJob } from '@/lib/prerender';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/sites/:id/prerender → start a pre-render + deploy job.
 * Returns immediately with a job id; the client polls /api/jobs/:id.
 */
export async function POST(req: Request, { params }: Ctx) {
  const denied = await requireAuth(req);
  if (denied) return denied;
  const { id } = await params;

  const site = await getSite(id);
  if (!site) return NextResponse.json({ error: 'Site introuvable.' }, { status: 404 });

  const job = createJob(site.id, site.name);
  // Fire-and-forget: the pipeline streams progress into the job registry.
  void runPrerenderJob(job.id, site);

  return NextResponse.json({ jobId: job.id }, { status: 202 });
}
