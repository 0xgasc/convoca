// lib/turnstile.ts
// Optional Cloudflare Turnstile verification. If TURNSTILE_SECRET_KEY is unset,
// verifyTurnstile is a no-op so deploys work without it; the UI also hides
// the widget if NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset.

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export const TURNSTILE_ENABLED = !!process.env.TURNSTILE_SECRET_KEY;

export async function verifyTurnstile(token: string | null | undefined, ip?: string | null): Promise<boolean> {
  if (!TURNSTILE_ENABLED) return true;
  if (!token) return false;
  try {
    const body = new URLSearchParams();
    body.set('secret', process.env.TURNSTILE_SECRET_KEY!);
    body.set('response', token);
    if (ip) body.set('remoteip', ip);
    const res = await fetch(VERIFY_URL, { method: 'POST', body });
    if (!res.ok) return false;
    const json = await res.json();
    return !!json.success;
  } catch {
    return false;
  }
}
