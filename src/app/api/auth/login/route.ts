import { NextResponse } from 'next/server';
import { isValidAccessCode, signSession } from '@/lib/auth';
import { assertServerConfig } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/login  { code: string }
 * Verifies the access code server-side. 403 on mismatch, otherwise returns a
 * short-lived session token. The code itself never leaves the server.
 */
export async function POST(req: Request) {
  const cfgErr = assertServerConfig();
  if (cfgErr) {
    return NextResponse.json({ error: cfgErr }, { status: 500 });
  }

  let code = '';
  try {
    const body = await req.json();
    code = typeof body?.code === 'string' ? body.code : '';
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  if (!isValidAccessCode(code)) {
    return NextResponse.json({ error: "Code d'accès incorrect." }, { status: 403 });
  }

  const token = await signSession();
  return NextResponse.json({ token });
}
