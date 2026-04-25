// lib/auth.ts
// Light session-based identity: a session row is "verified" once it has
// a confirmed email. Magic-link verification when RESEND_API_KEY is set;
// otherwise the request immediately marks the session verified (dev mode).

import { prisma } from '@/lib/db';
import crypto from 'crypto';

export const HAS_RESEND = !!process.env.RESEND_API_KEY;

export interface SessionAuth {
  id: string;
  email: string | null;
  display_name: string | null;
  verified: boolean;
}

export async function getSessionAuth(sessionId: string | null | undefined): Promise<SessionAuth | null> {
  if (!sessionId) return null;
  const s = await prisma.userSession.findUnique({
    where: { id: sessionId },
    select: { id: true, email: true, display_name: true, verified_at: true },
  });
  if (!s) return null;
  return {
    id: s.id,
    email: s.email,
    display_name: s.display_name,
    verified: !!s.verified_at,
  };
}

export async function requireVerifiedSession(req: Request): Promise<{ ok: true; session: SessionAuth } | { ok: false; status: number; error: string }> {
  const sessionId = req.headers.get('x-session-id') ?? '';
  if (!sessionId) return { ok: false, status: 401, error: 'Missing session id' };
  const session = await getSessionAuth(sessionId);
  if (!session) return { ok: false, status: 401, error: 'Unknown session' };
  if (!session.verified) return { ok: false, status: 401, error: 'Sign-in required' };
  return { ok: true, session };
}

export function newToken(): string {
  return crypto.randomBytes(20).toString('base64url');
}

export function tokenExpiresAt(): Date {
  return new Date(Date.now() + 30 * 60 * 1000);
}
