// lib/admin.ts
// Tiny env-key gate for the admin endpoints. Not auth — enough to keep curious
// visitors out of an internal dashboard. Rotate ADMIN_KEY when needed.

export function isAuthorizedAdmin(req: Request): boolean {
  const expected = process.env.ADMIN_KEY;
  if (!expected) return false;
  const url = new URL(req.url);
  const provided = url.searchParams.get('key') ?? req.headers.get('x-admin-key') ?? '';
  return provided.length > 0 && provided === expected;
}
