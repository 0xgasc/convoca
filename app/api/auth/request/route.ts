import { prisma } from '@/lib/db';
import { newToken, tokenExpiresAt, HAS_RESEND } from '@/lib/auth';
import { Resend } from 'resend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  sessionId: string;
  email: string;
  display_name?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  let body: Body;
  try { body = await req.json(); }
  catch { return Response.json({ error: 'invalid JSON' }, { status: 400 }); }

  const sessionId = body.sessionId?.trim();
  const email = body.email?.trim().toLowerCase();
  const displayName = body.display_name?.trim().slice(0, 60) || null;

  if (!sessionId) return Response.json({ error: 'sessionId required' }, { status: 400 });
  if (!email || !EMAIL_RE.test(email)) return Response.json({ error: 'valid email required' }, { status: 400 });

  // Ensure the session exists (orchestrator creates these lazily; we also create here).
  await prisma.userSession.upsert({
    where: { id: sessionId },
    create: { id: sessionId, email, display_name: displayName },
    update: { email, display_name: displayName ?? undefined },
  });

  if (!HAS_RESEND) {
    // Dev / un-configured fallback: trust the email immediately. The user
    // sees a "you're signed in" toast and can flag right away. Add
    // RESEND_API_KEY to upgrade to real magic-link verification.
    await prisma.userSession.update({
      where: { id: sessionId },
      data: { verified_at: new Date(), email_verification_token: null, email_verification_expires: null },
    });
    return Response.json({ status: 'verified', mode: 'auto', email });
  }

  const token = newToken();
  await prisma.userSession.update({
    where: { id: sessionId },
    data: {
      email_verification_token: token,
      email_verification_expires: tokenExpiresAt(),
      verified_at: null,
    },
  });

  const url = new URL(req.url);
  const origin = `${url.protocol}//${url.host}`;
  const link = `${origin}/api/auth/verify?token=${encodeURIComponent(token)}&sid=${encodeURIComponent(sessionId)}`;

  try {
    const resend = new Resend(process.env.RESEND_API_KEY!);
    await resend.emails.send({
      from: process.env.RESEND_FROM ?? 'Convoca <onboarding@resend.dev>',
      to: email,
      subject: 'Sign in to Convoca',
      text: `Click to sign in (expires in 30 minutes):\n\n${link}\n\nIf you didn't request this, ignore it.`,
    });
  } catch (err) {
    console.error('[auth] resend send failed', err);
    return Response.json({ error: 'failed to send sign-in email' }, { status: 500 });
  }

  return Response.json({ status: 'sent', mode: 'magic_link', email });
}
