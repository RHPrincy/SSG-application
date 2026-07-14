/**
 * Guard helper for protected API routes. Returns a 403 NextResponse when the
 * request carries no valid session token, otherwise null (caller proceeds).
 */
import { NextResponse } from 'next/server';
import { bearerFrom, verifySession } from './auth';

export async function requireAuth(req: Request): Promise<NextResponse | null> {
  const token = bearerFrom(req);
  const ok = await verifySession(token);
  if (!ok) {
    return NextResponse.json(
      { error: 'Accès refusé : jeton de session absent ou invalide.' },
      { status: 403 },
    );
  }
  return null;
}
