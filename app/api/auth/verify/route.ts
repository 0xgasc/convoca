import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  const sid = url.searchParams.get('sid');
  if (!token || !sid) return new Response('Missing token or sid', { status: 400 });

  const session = await prisma.userSession.findUnique({
    where: { id: sid },
    select: { email_verification_token: true, email_verification_expires: true },
  });
  if (!session || session.email_verification_token !== token) {
    return new Response('Invalid or expired link', { status: 400 });
  }
  if (!session.email_verification_expires || session.email_verification_expires < new Date()) {
    return new Response('Sign-in link expired. Request a new one.', { status: 400 });
  }

  await prisma.userSession.update({
    where: { id: sid },
    data: { verified_at: new Date(), email_verification_token: null, email_verification_expires: null },
  });

  return Response.redirect(`${url.protocol}//${url.host}/?signed_in=1`, 302);
}
