import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-guard';
import { addSite, getSites, slugify } from '@/lib/store';
import type { Site } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/sites → list all managed sites. */
export async function GET(req: Request) {
  const denied = await requireAuth(req);
  if (denied) return denied;
  return NextResponse.json({ sites: await getSites() });
}

/** POST /api/sites → add a site { name, lovableUrl, vercelUrl, vercelProject? }. */
export async function POST(req: Request) {
  const denied = await requireAuth(req);
  if (denied) return denied;

  let body: Partial<Site>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  const name = (body.name || '').trim();
  const lovableUrl = (body.lovableUrl || '').trim();
  const vercelUrl = (body.vercelUrl || '').trim();
  const vercelProject = (body.vercelProject || '').trim() || undefined;

  if (!name || !lovableUrl) {
    return NextResponse.json(
      { error: 'Le nom et l’URL Lovable sont obligatoires.' },
      { status: 400 },
    );
  }
  try {
    // Validate URLs early with a clear message.
    new URL(lovableUrl);
    if (vercelUrl) new URL(vercelUrl);
  } catch {
    return NextResponse.json({ error: 'URL invalide.' }, { status: 400 });
  }

  const site: Site = {
    id: slugify(name) || slugify(new URL(lovableUrl).hostname),
    name,
    lovableUrl,
    vercelUrl,
    vercelProject,
  };

  try {
    await addSite(site);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
  return NextResponse.json({ site }, { status: 201 });
}
