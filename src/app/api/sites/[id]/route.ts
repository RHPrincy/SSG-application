import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-guard';
import { getSite, removeSite, updateSite } from '@/lib/store';
import type { Site } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/sites/:id → edit a site's editable fields. */
export async function PATCH(req: Request, { params }: Ctx) {
  const denied = await requireAuth(req);
  if (denied) return denied;
  const { id } = await params;

  let body: Partial<Site>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  // Only allow editing user-facing fields (never baselineHash / timestamps).
  const patch: Partial<Site> = {};
  if (typeof body.name === 'string') patch.name = body.name.trim();
  if (typeof body.lovableUrl === 'string') patch.lovableUrl = body.lovableUrl.trim();
  if (typeof body.vercelUrl === 'string') patch.vercelUrl = body.vercelUrl.trim();
  if (typeof body.vercelProject === 'string')
    patch.vercelProject = body.vercelProject.trim() || undefined;

  const updated = await updateSite(id, patch);
  if (!updated) return NextResponse.json({ error: 'Site introuvable.' }, { status: 404 });
  return NextResponse.json({ site: updated });
}

/** DELETE /api/sites/:id → remove a site. */
export async function DELETE(req: Request, { params }: Ctx) {
  const denied = await requireAuth(req);
  if (denied) return denied;
  const { id } = await params;

  const exists = await getSite(id);
  if (!exists) return NextResponse.json({ error: 'Site introuvable.' }, { status: 404 });
  await removeSite(id);
  return NextResponse.json({ ok: true });
}
