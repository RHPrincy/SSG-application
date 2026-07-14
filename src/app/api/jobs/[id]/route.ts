import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-guard';
import { getJob } from '@/lib/jobs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/jobs/:id → current status + logs of a running/finished job. */
export async function GET(req: Request, { params }: Ctx) {
  const denied = await requireAuth(req);
  if (denied) return denied;
  const { id } = await params;

  const job = getJob(id);
  if (!job) return NextResponse.json({ error: 'Tâche introuvable.' }, { status: 404 });
  return NextResponse.json({ job });
}
