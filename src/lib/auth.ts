/**
 * Server-side authentication helpers.
 *
 * Flow:
 *   1. Client posts the access code to /api/auth/login.
 *   2. We compare it (timing-safe) to ACCESS_CODE from the environment.
 *   3. On success we mint a short-lived HS256 JWT signed with AUTH_SECRET.
 *   4. The client stores the token in sessionStorage and sends it as a
 *      `Authorization: Bearer <token>` header on every protected request.
 *
 * ACCESS_CODE and AUTH_SECRET never leave the server.
 */
import { timingSafeEqual } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { AUTH_SECRET, ACCESS_CODE, TOKEN_TTL } from './config';

const secretKey = () => new TextEncoder().encode(AUTH_SECRET);

/** Constant-time comparison to avoid leaking the code length/prefix via timing. */
export function isValidAccessCode(candidate: string): boolean {
  if (!ACCESS_CODE) return false;
  const a = Buffer.from(String(candidate));
  const b = Buffer.from(ACCESS_CODE);
  if (a.length !== b.length) {
    // Still burn a comparison against a fixed buffer to keep timing flat.
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

/** Sign a session token. */
export async function signSession(): Promise<string> {
  return new SignJWT({ scope: 'prerender-manager' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(secretKey());
}

/** Verify a session token; returns true iff valid & unexpired. */
export async function verifySession(token: string | undefined | null): Promise<boolean> {
  if (!token || !AUTH_SECRET) return false;
  try {
    await jwtVerify(token, secretKey(), { algorithms: ['HS256'] });
    return true;
  } catch {
    return false;
  }
}

/** Extract the bearer token from a request's Authorization header. */
export function bearerFrom(req: Request): string | null {
  const h = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : null;
}
