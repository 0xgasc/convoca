// lib/supabase.ts
// Server-side Supabase client. Uses service role for trusted server contexts.
// For browser-side reads (event listings, flags), use the anon client instead.

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL not set');

// Server client — never import this into a client component
export const supabase = createClient(url, serviceKey || anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Browser client — safe to use from client components
export const supabaseBrowser = () => createClient(url, anonKey);
